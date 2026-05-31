//! AURA Voice Commands — Phase 3D
//!
//! Tauri backend commands for OpenAI voice operations.
//! The API key is loaded from the process environment here in Rust,
//! so it is never returned or exposed to the frontend.
//!
//! Security invariants:
//!   - Key is never logged, returned, or serialized to frontend
//!   - Audio bytes are capped at 25 MB input (Whisper API actual limit)
//!   - Response tokens capped at 300 for chat (raised from 150 in Phase 3D)
//!   - Text input to TTS capped at 4096 chars
//!   - No source code or credentials in prompts
//!   - One call per command invocation; caller controls retries
//!
//! Key resolution order:
//!   1. VITE_OPENAI_API_KEY  (set in .env; loaded by dotenvy::dotenv() in lib.rs)
//!   2. OPENAI_API_KEY       (system environment fallback)
//!
//! Production note:
//!   For hardened production builds, replace env-based key loading with
//!   Tauri Stronghold / OS keychain access (tauri-plugin-stronghold).

use serde::{Deserialize, Serialize};

const MAX_AUDIO_BYTES: usize = 25 * 1024 * 1024; // 25 MB — Whisper API actual limit
/// Minimum viable audio size. A real webm/ogg container with even 100 ms of speech
/// is at least ~3 KB. Anything smaller is silence, a recording glitch, or an empty
/// MediaRecorder frame — do not waste an API call on it.
const MIN_AUDIO_BYTES: usize = 3_000;
const MAX_TEXT_LEN: usize = 4096;
const MAX_SYSTEM_PROMPT_LEN: usize = 8_000;
const MAX_RESPONSE_TOKENS: u32 = 1_000; // Phase 3K audit: raised from 300 — stop cutting off answers
/// Ultra-low token budget for fast acknowledgement reply (1 sentence, ≤12 words).
/// Cuts chat generation time from ~800-2000ms to ~200-500ms for the first spoken reply.
const MAX_FAST_TOKENS: u32 = 40;
// Phase 3K model audit — upgraded from weaker defaults:
//   whisper-1 → gpt-4o-transcribe: dramatically better on proper nouns and names
//   gpt-4o-mini → gpt-4o: reliable tool calling, proper reasoning, doesn't fake actions
//   tts-1 → tts-1-hd: better voice quality (ElevenLabs activates via VITE_ELEVENLABS_API_KEY)
const CHAT_MODEL: &str = "gpt-4o";
const TTS_MODEL: &str = "tts-1-hd";
const STT_MODEL: &str = "gpt-4o-transcribe";

/// Known hallucination substrings — Whisper/gpt-4o-transcribe on silence tends to
/// output YouTube/podcast phrases or short looping fillers.
/// Phase 3K+: expanded with gpt-4o-transcribe observed patterns on silence.
const HALLUCINATION_SUBSTRINGS: &[&str] = &[
    // YouTube/podcast hallucinations (Whisper training data)
    "thank you for watching",
    "thanks for watching",
    "please subscribe",
    "like and subscribe",
    "don't forget to subscribe",
    "see you in the next video",
    "see you next time",
    "you for watching",
    "subtitles by",
    "transcribed by",
    "captions by",
    "provided by",
    // gpt-4o-transcribe observed silence hallucinations
    "or a operator",
    "the operator",
    "or the operator",
    // Common near-silence hallucinations
    "[music]",
    "[silence]",
    "[applause]",
    "[laughter]",
    "[background noise]",
    "[no audio]",
    "[inaudible]",
    "(music)",
    "(silence)",
    "(applause)",
];

/// Returns true if the transcript is almost certainly a hallucination.
///
/// Checks (in order):
///   1. Known silence/podcast hallucination substrings
///   2. Repetitive phrase loop — same short phrase repeated 3+ times
///      (catches "or a operator or a operator..." regardless of exact phrase)
///   3. Pure non-alphabetic output (emoji/symbol noise)
fn is_likely_hallucination(text: &str) -> bool {
    let lower = text.to_lowercase();
    let trimmed = lower.trim();

    // 1. Known patterns
    for pattern in HALLUCINATION_SUBSTRINGS {
        if trimmed.contains(pattern) {
            return true;
        }
    }

    // 2. Repetitive phrase loop detector.
    //    Split into words, then look for any window of 2-5 words that repeats
    //    3 or more times consecutively — a strong sign of hallucination.
    let words: Vec<&str> = trimmed.split_whitespace().collect();
    let word_count = words.len();
    if word_count >= 6 {
        'repetition: for phrase_len in 2usize..=5 {
            if phrase_len * 3 > word_count { break 'repetition; }
            let mut i = 0;
            while i + phrase_len * 3 <= word_count {
                let phrase = &words[i..i + phrase_len];
                let mut repeats = 1usize;
                let mut j = i + phrase_len;
                while j + phrase_len <= word_count && &words[j..j + phrase_len] == phrase {
                    repeats += 1;
                    j += phrase_len;
                }
                if repeats >= 3 {
                    return true;
                }
                i += 1;
            }
        }
    }

    // 3. No alphabetic characters at all
    if !trimmed.is_empty() && !trimmed.chars().any(|c| c.is_alphabetic()) {
        return true;
    }

    false
}

// ─── System prompt ─────────────────────────────────────────────────────────────
// Phase 3D: improved voice-first prompt with no filler phrases

const AURA_SYSTEM_PROMPT_BASE: &str =
    "You are AURA, a concise voice assistant and AI desktop operator. \
     You are speaking directly to the user through audio. \
     Rules: \
     - Respond as if speaking naturally, not writing. \
     - Keep responses SHORT — 1 to 3 sentences maximum unless asked to elaborate. \
     - Never use markdown, bullet points, or formatted lists. \
     - Never say 'Certainly!' or 'Of course!' or similar filler phrases. \
     - Ask one clarifying question at a time if you need more information. \
     - Do not claim to perform actions you have not actually performed. \
     - If you do not know something, say so clearly and briefly.";

const RESPONSE_STYLE_BRIEF: &str = " Keep your response to 1 sentence. Be extremely concise.";
const RESPONSE_STYLE_NORMAL: &str = " Aim for 2 to 3 sentences.";
const RESPONSE_STYLE_DETAILED: &str = " You may use up to 5 sentences if the topic requires it.";

/// System prompt for the fast acknowledgement path.
/// Forces a single spoken sentence of ≤12 words. No markdown, no hedging.
const AURA_FAST_SYSTEM_PROMPT: &str =
    "You are AURA, a voice assistant. Reply in exactly ONE spoken sentence. \
     Maximum 12 words. No markdown. No filler phrases like 'Certainly' or 'Of course'. \
     If the request needs more work, say what you are doing in simple words.";

// ─── Shared types ─────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

// ─── Key helper ───────────────────────────────────────────────────────────────

fn get_openai_key() -> Result<String, String> {
    std::env::var("VITE_OPENAI_API_KEY")
        .or_else(|_| std::env::var("OPENAI_API_KEY"))
        .map_err(|_| {
            "OpenAI API key not configured. Save a key in Settings or set VITE_OPENAI_API_KEY/OPENAI_API_KEY.".to_string()
        })
}

fn truncate_utf8(text: &str, max_bytes: usize) -> &str {
    if text.len() <= max_bytes {
        return text;
    }

    let mut end = 0;
    for (idx, ch) in text.char_indices() {
        let next = idx + ch.len_utf8();
        if next > max_bytes {
            break;
        }
        end = next;
    }
    &text[..end]
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Transcribe audio bytes using OpenAI Whisper.
///
/// Three-layer hallucination defence:
///   1. Pre-flight: reject audio below MIN_AUDIO_BYTES (silence / empty recording)
///   2. API params: verbose_json + temperature=0 + language=en to minimise Whisper drift
///   3. Post-filter: reject transcripts whose no_speech_prob > threshold OR that match
///      known YouTube hallucination patterns (e.g. "thank you for watching")
///
/// Returns empty string ("") for silent/hallucinated audio so the caller can show
/// "No speech detected" rather than propagating garbage to the chat step.
/// Returns Err only for genuine API/network failures.
#[tauri::command]
pub async fn openai_transcribe_audio(
    audio_bytes: Vec<u8>,
    content_type: String,
    // Optional vocabulary/spelling hint (project terms + the user's name).
    // Whisper uses this as context to bias toward correct spellings.
    prompt: Option<String>,
) -> Result<String, String> {
    // ── Layer 1: Pre-flight size gate ─────────────────────────────────────────
    if audio_bytes.is_empty() {
        return Err("Audio bytes are empty".to_string());
    }
    if audio_bytes.len() < MIN_AUDIO_BYTES {
        // Too small to contain real speech — return empty rather than error
        // so the frontend shows "No speech detected" instead of an error banner.
        return Ok(String::new());
    }
    if audio_bytes.len() > MAX_AUDIO_BYTES {
        return Err(format!(
            "Recording too large ({} MB). Please keep recordings under 25 MB.",
            audio_bytes.len() / 1_048_576
        ));
    }

    let key = get_openai_key()?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let mime = if content_type.is_empty() {
        "audio/webm".to_string()
    } else {
        content_type
    };
    let ext = if mime.contains("mp4") || mime.contains("m4a") {
        "m4a"
    } else if mime.contains("ogg") {
        "ogg"
    } else if mime.contains("wav") {
        "wav"
    } else {
        "webm"
    };

    let file_part = reqwest::multipart::Part::bytes(audio_bytes)
        .file_name(format!("audio.{ext}"))
        .mime_str(&mime)
        .map_err(|e| e.to_string())?;

    // ── Layer 2: API params to reduce hallucination ───────────────────────────
    // verbose_json gives us no_speech_prob per segment.
    // temperature=0 is deterministic — much less likely to hallucinate.
    // language=en avoids cross-language drift on noisy input.
    // gpt-4o-transcribe only accepts "json" or "text" — not "verbose_json".
    // whisper-1 accepts verbose_json (gives per-segment no_speech_prob).
    // We detect which format to use based on the model name.
    let response_fmt = if STT_MODEL.starts_with("gpt-4o") { "json" } else { "verbose_json" };

    let mut form = reqwest::multipart::Form::new()
        .part("file", file_part)
        .text("model", STT_MODEL)
        .text("response_format", response_fmt)
        .text("temperature", "0")
        .text("language", "en");

    // Optional vocabulary/spelling hint. Capped well under Whisper's ~224-token
    // prompt budget so it biases spelling without crowding out the audio.
    if let Some(p) = prompt {
        let p = p.trim();
        if !p.is_empty() {
            form = form.text("prompt", truncate_utf8(p, 600).to_string());
        }
    }

    let res = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {key}"))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let status = res.status();
    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        let msg = body["error"]["message"]
            .as_str()
            .unwrap_or("Transcription failed");
        return Err(format!("OpenAI STT error: {msg}"));
    }

    let text = body["text"].as_str().unwrap_or("").trim().to_string();

    // ── Layer 3: hallucination filter + selective no_speech_prob check ────────
    //
    // IMPORTANT FIX (Phase 3E QA): For long speech (10–30s), a brief pause between
    // sentences creates one segment with high no_speech_prob (e.g., 0.65).
    // The old MAX approach discarded the ENTIRE transcript because of that one
    // pause segment. This silently killed all 20–25s recordings.
    //
    // New approach:
    //   1. Check hallucination patterns first — reject regardless of no_speech_prob.
    //   2. If text is NON-EMPTY and not a hallucination, ALWAYS return it.
    //      Whisper already transcribed real speech — trust it.
    //   3. Only apply no_speech_prob check when text IS EMPTY (to distinguish
    //      "silence" from "API returned empty for unknown reason").
    //      In that case use AVERAGE probability, not MAX, to avoid single-pause rejection.

    // Step 1: hallucination filter applies regardless of text emptiness
    if is_likely_hallucination(&text) {
        return Ok(String::new());
    }

    // Step 2: non-empty text from Whisper → return it (real speech was transcribed)
    if !text.is_empty() {
        return Ok(text);
    }

    // Step 3: empty text — use average no_speech_prob to confirm silence
    // (avoids treating an API quirk as silence)
    if let Some(segments) = body["segments"].as_array() {
        let probs: Vec<f64> = segments
            .iter()
            .filter_map(|s| s["no_speech_prob"].as_f64())
            .collect();
        if !probs.is_empty() {
            let avg = probs.iter().sum::<f64>() / probs.len() as f64;
            if avg < 0.50 {
                // Average no_speech_prob is low even though text is empty —
                // possible API issue rather than true silence. Return empty
                // so frontend shows a neutral message rather than "No speech."
                return Ok(String::new());
            }
        }
    }

    Ok(String::new())
}

/// Generate a short AURA chat response for a transcript.
/// History is an optional array of prior {role, content} messages (max 6 sent).
/// response_style controls response length: "brief" | "normal" | "detailed" (default "normal").
/// system_prompt_override: if provided by the frontend, replaces the hardcoded base prompt.
///   This allows personality config + injected memories to flow in from the frontend.
///   If not provided, falls back to the built-in AURA_SYSTEM_PROMPT_BASE.
/// Returns the response text or an error string.
#[tauri::command]
pub async fn openai_chat_response(
    transcript: String,
    history: Vec<ChatMessage>,
    response_style: Option<String>,
    system_prompt_override: Option<String>,
) -> Result<String, String> {
    if transcript.trim().is_empty() {
        return Err("Transcript is empty".to_string());
    }

    let key = get_openai_key()?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    // Use frontend-built prompt if provided (includes personality + memories),
    // otherwise fall back to built-in base + style suffix
    let system_prompt = if let Some(override_prompt) = system_prompt_override {
        if !override_prompt.trim().is_empty() {
            truncate_utf8(&override_prompt, MAX_SYSTEM_PROMPT_LEN).to_string()
        } else {
            let style_suffix = match response_style.as_deref().unwrap_or("normal") {
                "brief" => RESPONSE_STYLE_BRIEF,
                "detailed" => RESPONSE_STYLE_DETAILED,
                _ => RESPONSE_STYLE_NORMAL,
            };
            format!("{}{}", AURA_SYSTEM_PROMPT_BASE, style_suffix)
        }
    } else {
        let style_suffix = match response_style.as_deref().unwrap_or("normal") {
            "brief" => RESPONSE_STYLE_BRIEF,
            "detailed" => RESPONSE_STYLE_DETAILED,
            _ => RESPONSE_STYLE_NORMAL,
        };
        format!("{}{}", AURA_SYSTEM_PROMPT_BASE, style_suffix)
    };

    // Build messages — system + last 6 history turns + current user turn
    let mut messages: Vec<serde_json::Value> =
        vec![serde_json::json!({ "role": "system", "content": system_prompt })];
    for msg in history.iter().take(6) {
        messages.push(serde_json::json!({ "role": msg.role, "content": msg.content }));
    }
    messages.push(serde_json::json!({ "role": "user", "content": transcript.trim() }));

    let body = serde_json::json!({
        "model": CHAT_MODEL,
        "max_tokens": MAX_RESPONSE_TOKENS,
        "messages": messages,
    });

    let res = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let status = res.status();
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        let msg = data["error"]["message"].as_str().unwrap_or("Chat failed");
        return Err(format!("OpenAI chat error: {msg}"));
    }

    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string())
}

/// Ultra-fast single-sentence AURA reply for the Fast Mode first-audio path.
///
/// Key differences from openai_chat_response:
///   - max_tokens = 40 (vs 300) — forces 1 short sentence, cuts generation time 4–6x
///   - No conversation history — no extra context tokens, smaller request payload
///   - Dedicated system prompt demands ≤12 words, no hedging
///   - Same gpt-4o-mini model — already the fastest available
///
/// This command is only called by the fast mode first-reply path.
/// The full response is always fetched separately via openai_chat_response.
#[tauri::command]
pub async fn openai_fast_chat_response(transcript: String) -> Result<String, String> {
    if transcript.trim().is_empty() {
        return Err("Transcript is empty".to_string());
    }

    let key = get_openai_key()?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let messages = serde_json::json!([
        { "role": "system", "content": AURA_FAST_SYSTEM_PROMPT },
        { "role": "user", "content": transcript.trim() }
    ]);

    let body = serde_json::json!({
        "model": CHAT_MODEL,
        "max_tokens": MAX_FAST_TOKENS,
        "messages": messages,
    });

    let res = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let status = res.status();
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        let msg = data["error"]["message"]
            .as_str()
            .unwrap_or("Fast chat failed");
        return Err(format!("OpenAI fast chat error: {msg}"));
    }

    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string())
}

/// Chat response with optional OpenAI function calling (tool use).
///
/// Accepts a list of tool definitions in OpenAI format.
/// If the model returns a tool_call, this command returns a structured
/// JSON response instead of plain text so the frontend can dispatch the tool.
///
/// Return format:
///   { "type": "text",      "content": "..." }         — normal reply
///   { "type": "tool_call", "name": "...", "args": {...}, "call_id": "..." } — tool dispatch
///
/// Frontend must execute the tool, then call openai_chat_tool_result to get
/// the natural language follow-up.
#[tauri::command]
pub async fn openai_chat_with_tools(
    transcript: String,
    history: Vec<ChatMessage>,
    system_prompt_override: Option<String>,
    tools: Vec<serde_json::Value>,
) -> Result<String, String> {
    if transcript.trim().is_empty() {
        return Err("Transcript is empty".to_string());
    }

    let key = get_openai_key()?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let system_prompt = system_prompt_override
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| AURA_SYSTEM_PROMPT_BASE.to_string());

    let mut messages: Vec<serde_json::Value> = vec![
        serde_json::json!({ "role": "system", "content": system_prompt }),
    ];
    for msg in history.iter().take(6) {
        messages.push(serde_json::json!({ "role": msg.role, "content": msg.content }));
    }
    messages.push(serde_json::json!({ "role": "user", "content": transcript.trim() }));

    let mut body = serde_json::json!({
        "model": CHAT_MODEL,
        "max_tokens": MAX_RESPONSE_TOKENS,
        "messages": messages,
    });

    if !tools.is_empty() {
        body["tools"] = serde_json::json!(tools);
        body["tool_choice"] = serde_json::json!("auto");
    }

    let res = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let status = res.status();
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        let msg = data["error"]["message"].as_str().unwrap_or("Chat failed");
        return Err(format!("OpenAI chat error: {msg}"));
    }

    let choice = &data["choices"][0];
    let finish_reason = choice["finish_reason"].as_str().unwrap_or("");

    // Tool call response
    if finish_reason == "tool_calls" {
        if let Some(tool_calls) = choice["message"]["tool_calls"].as_array() {
            if let Some(tc) = tool_calls.first() {
                let name = tc["function"]["name"].as_str().unwrap_or("").to_string();
                let call_id = tc["id"].as_str().unwrap_or("").to_string();
                let args_str = tc["function"]["arguments"].as_str().unwrap_or("{}");
                let args: serde_json::Value = serde_json::from_str(args_str)
                    .unwrap_or(serde_json::json!({}));
                let result = serde_json::json!({
                    "type": "tool_call",
                    "name": name,
                    "args": args,
                    "call_id": call_id,
                });
                return Ok(result.to_string());
            }
        }
    }

    // Regular text response
    let text = choice["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    Ok(serde_json::json!({ "type": "text", "content": text }).to_string())
}

/// Send a tool result back to AURA and get the natural-language follow-up.
/// Called after the frontend executes a tool dispatched by openai_chat_with_tools.
#[tauri::command]
pub async fn openai_chat_tool_result(
    tool_name: String,
    tool_call_id: String,
    tool_result: String,
    history: Vec<ChatMessage>,
    system_prompt_override: Option<String>,
    original_user_message: String,
) -> Result<String, String> {
    let key = get_openai_key()?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let system_prompt = system_prompt_override
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| AURA_SYSTEM_PROMPT_BASE.to_string());

    let mut messages: Vec<serde_json::Value> = vec![
        serde_json::json!({ "role": "system", "content": system_prompt }),
    ];
    for msg in history.iter().take(6) {
        messages.push(serde_json::json!({ "role": msg.role, "content": msg.content }));
    }
    // Original user message
    messages.push(serde_json::json!({ "role": "user", "content": original_user_message.trim() }));
    // Assistant's tool call
    messages.push(serde_json::json!({
        "role": "assistant",
        "content": null,
        "tool_calls": [{
            "id": tool_call_id,
            "type": "function",
            "function": { "name": tool_name, "arguments": "{}" }
        }]
    }));
    // Tool result
    messages.push(serde_json::json!({
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": tool_result,
    }));

    let body = serde_json::json!({
        "model": CHAT_MODEL,
        "max_tokens": MAX_RESPONSE_TOKENS,
        "messages": messages,
    });

    let res = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let status = res.status();
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        let msg = data["error"]["message"].as_str().unwrap_or("Follow-up failed");
        return Err(format!("OpenAI error: {msg}"));
    }

    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string())
}

/// Extract memorable facts from a conversation turn.
///
/// Given a user message and AURA's response, asks gpt-4o-mini to extract
/// any facts worth remembering (personal facts about the user, or project/task decisions).
/// Returns a JSON array of { category: "personal"|"task", content: string } objects.
/// Returns "[]" if nothing is worth remembering.
///
/// This runs async after a turn completes so it never blocks voice response latency.
#[tauri::command]
pub async fn openai_extract_memory(user_text: String, aura_text: String) -> Result<String, String> {
    if user_text.trim().is_empty() {
        return Ok("[]".to_string());
    }

    let key = get_openai_key()?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let system = "You extract memorable facts from AI assistant conversations. \
        Given a user message and assistant reply, extract facts worth remembering long-term. \
        Personal facts: user's name, preferences, role, location, habits, recurring topics. \
        Task facts: decisions made, project names, technical choices, goals set, problems solved. \
        Ignore small talk, greetings, thanks, and ephemeral requests. \
        Respond ONLY with a JSON object: {\"facts\":[{\"category\":\"personal\"|\"task\",\"content\":\"fact\"}]}. \
        If nothing is worth remembering, respond with {\"facts\":[]}. \
        Keep each fact under 150 characters. Max 3 facts per turn.";

    let user_msg = format!(
        "User said: {}\nAssistant replied: {}",
        user_text.trim().chars().take(300).collect::<String>(),
        aura_text.trim().chars().take(300).collect::<String>(),
    );

    let messages = serde_json::json!([
        { "role": "system", "content": system },
        { "role": "user",   "content": user_msg }
    ]);

    let body = serde_json::json!({
        "model": CHAT_MODEL,
        "max_tokens": 200,
        "messages": messages,
        "response_format": { "type": "json_object" },
    });

    // Attempt extraction — return empty array on any failure so callers are never blocked
    let res = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await;

    let res = match res {
        Ok(r) => r,
        Err(_) => return Ok("[]".to_string()),
    };

    if !res.status().is_success() {
        return Ok("[]".to_string());
    }

    let data: serde_json::Value = match res.json().await {
        Ok(d) => d,
        Err(_) => return Ok("[]".to_string()),
    };

    let raw = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("[]")
        .trim()
        .to_string();

    // Parse and re-serialize to ensure it is valid JSON array
    // The model returns { "facts": [...] } or [...] depending on response_format
    let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap_or(serde_json::json!([]));
    let arr = if parsed.is_array() {
        parsed
    } else if let Some(arr) = parsed.get("facts").and_then(|v| v.as_array()) {
        serde_json::Value::Array(arr.clone())
    } else {
        serde_json::json!([])
    };

    Ok(arr.to_string())
}

/// Convert text to speech using OpenAI TTS.
/// Returns raw MP3 audio bytes. Caller converts to Blob URL for playback.
/// Voice options: alloy, echo, fable, onyx, nova, shimmer.
#[tauri::command]
pub async fn openai_synthesize_speech(
    text: String,
    voice: Option<String>,
) -> Result<Vec<u8>, String> {
    if text.trim().is_empty() {
        return Err("Text is empty".to_string());
    }

    let key = get_openai_key()?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let text = truncate_utf8(&text, MAX_TEXT_LEN);
    let voice = voice.unwrap_or_else(|| "alloy".to_string());

    let body = serde_json::json!({
        "model": TTS_MODEL,
        "input": text.trim(),
        "voice": voice,
    });

    let res = client
        .post("https://api.openai.com/v1/audio/speech")
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !res.status().is_success() {
        let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        let msg = data["error"]["message"].as_str().unwrap_or("TTS failed");
        return Err(format!("OpenAI TTS error: {msg}"));
    }

    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    Ok(bytes.to_vec())
}

// ─── Local STT (faster-whisper) ───────────────────────────────────────────────
//
// Calls the Python sidecar script scripts/local_stt.py with a temp audio file.
// On success, returns the transcript text (same shape as openai_transcribe_audio).
// On failure, returns Err so the frontend can fall back to the API path.
//
// AURA_STT_PROMPT env var is set before spawning so the script biases vocabulary.

#[tauri::command]
pub fn local_transcribe_audio(
    audio_bytes: Vec<u8>,
    content_type: String,
    prompt: Option<String>,
) -> Result<String, String> {
    use std::io::Write;

    if audio_bytes.is_empty() {
        return Err("Audio bytes are empty".to_string());
    }

    // Write audio to a temp file
    let ext = if content_type.contains("wav") { "wav" } else if content_type.contains("mp4") || content_type.contains("m4a") { "m4a" } else { "webm" };
    let tmp_path = std::env::temp_dir().join(format!("aura_stt_{}.{ext}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()));
    {
        let mut f = std::fs::File::create(&tmp_path).map_err(|e| format!("Cannot write temp audio: {e}"))?;
        f.write_all(&audio_bytes).map_err(|e| format!("Cannot write audio bytes: {e}"))?;
    }

    // Resolve path to local_stt.py relative to the executable (installed app)
    // or CWD (dev mode).
    let script = {
        let exe_rel = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("scripts").join("local_stt.py")))
            .filter(|p| p.exists());
        let cwd_rel = std::env::current_dir()
            .ok()
            .map(|d| d.join("scripts").join("local_stt.py"))
            .filter(|p| p.exists());
        exe_rel.or(cwd_rel)
    };

    let script = match script {
        Some(s) => s,
        None => {
            let _ = std::fs::remove_file(&tmp_path);
            return Err("local_stt.py not found — local STT unavailable".to_string());
        }
    };

    // Spawn python with the script
    let mut cmd = std::process::Command::new("python");
    cmd.arg(&script)
       .arg(tmp_path.to_string_lossy().as_ref())
       .arg("en");
    if let Some(p) = &prompt {
        cmd.env("AURA_STT_PROMPT", p);
    }

    let output = cmd
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output();

    let _ = std::fs::remove_file(&tmp_path); // always clean up

    match output {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout).trim().to_string();
            Ok(text)
        }
        Ok(o) => {
            let err = String::from_utf8_lossy(&o.stderr).trim().to_string();
            Err(format!("Local STT failed: {err}"))
        }
        Err(e) => Err(format!("Local STT spawn error: {e}")),
    }
}
