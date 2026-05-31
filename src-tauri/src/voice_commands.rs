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
const MAX_RESPONSE_TOKENS: u32 = 300; // Phase 3D: raised from 150 to support detailed responses
/// Ultra-low token budget for fast acknowledgement reply (1 sentence, ≤12 words).
/// Cuts chat generation time from ~800-2000ms to ~200-500ms for the first spoken reply.
const MAX_FAST_TOKENS: u32 = 40;
const CHAT_MODEL: &str = "gpt-4o-mini";
const TTS_MODEL: &str = "tts-1";
const STT_MODEL: &str = "whisper-1";

/// Known Whisper hallucination substrings. Whisper was trained on YouTube videos and
/// podcasts; when given silence or very low-energy audio it frequently hallucinates these.
/// We reject any transcript that contains these patterns.
const HALLUCINATION_SUBSTRINGS: &[&str] = &[
    "thank you for watching",
    "thanks for watching",
    "thank you for watching.",
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
    "[music]",
    "[silence]",
    "[applause]",
    "[laughter]",
];

/// Returns true if the transcript looks like a Whisper hallucination rather than
/// real speech. Checks two things:
///   1. Known YouTube/podcast hallucination patterns
///   2. No alphabetic characters at all (pure emoji / symbol output)
fn is_likely_hallucination(text: &str) -> bool {
    let lower = text.to_lowercase();
    for pattern in HALLUCINATION_SUBSTRINGS {
        if lower.contains(pattern) {
            return true;
        }
    }
    // If the entire output has no alphabetic characters it is almost certainly hallucinated
    // noise (e.g. a stream of emoji).
    let has_alpha = lower.chars().any(|c| c.is_alphabetic());
    if !has_alpha && !text.trim().is_empty() {
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
    let form = reqwest::multipart::Form::new()
        .part("file", file_part)
        .text("model", STT_MODEL)
        .text("response_format", "verbose_json")
        .text("temperature", "0")
        .text("language", "en");

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
