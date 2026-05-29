/// AURA Voice Commands — Phase 3C
///
/// Tauri backend commands for OpenAI voice operations.
/// The API key is loaded from the process environment here in Rust,
/// so it is never returned or exposed to the frontend.
///
/// Security invariants:
///   - Key is never logged, returned, or serialized to frontend
///   - Audio bytes are capped at 10 MB input
///   - Response tokens capped at 150 for chat
///   - Text input to TTS capped at 4096 chars
///   - No source code or credentials in prompts
///   - One call per command invocation; caller controls retries
///
/// Key resolution order:
///   1. VITE_OPENAI_API_KEY  (set in .env; loaded by dotenvy::dotenv() in lib.rs)
///   2. OPENAI_API_KEY       (system environment fallback)
///
/// Production note:
///   For hardened production builds, replace env-based key loading with
///   Tauri Stronghold / OS keychain access (tauri-plugin-stronghold).

use serde::{Deserialize, Serialize};

const MAX_AUDIO_BYTES: usize = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_LEN: usize = 4096;
const MAX_RESPONSE_TOKENS: u32 = 150;
const CHAT_MODEL: &str = "gpt-4o-mini";
const TTS_MODEL: &str = "tts-1";
const STT_MODEL: &str = "whisper-1";

const AURA_SYSTEM_PROMPT: &str =
    "You are AURA, a concise desktop operator assistant. \
     Speak naturally, keep responses short (1-3 sentences), \
     and ask before taking actions. \
     Do not claim to perform actions you have not performed.";

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
            "OpenAI API key not configured. Set VITE_OPENAI_API_KEY in .env.".to_string()
        })
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Transcribe audio bytes using OpenAI Whisper.
/// Accepts raw audio bytes and the MIME type (e.g. "audio/webm").
/// Returns the transcript text or an error string.
#[tauri::command]
pub async fn openai_transcribe_audio(
    audio_bytes: Vec<u8>,
    content_type: String,
) -> Result<String, String> {
    if audio_bytes.is_empty() {
        return Err("Audio bytes are empty".to_string());
    }
    if audio_bytes.len() > MAX_AUDIO_BYTES {
        return Err(format!("Audio exceeds {MAX_AUDIO_BYTES} byte limit"));
    }

    let key = get_openai_key()?;
    let client = reqwest::Client::new();

    let mime = if content_type.is_empty() { "audio/webm".to_string() } else { content_type };
    let ext = if mime.contains("mp4") || mime.contains("m4a") { "m4a" }
              else if mime.contains("ogg") { "ogg" }
              else if mime.contains("wav") { "wav" }
              else { "webm" };

    let file_part = reqwest::multipart::Part::bytes(audio_bytes)
        .file_name(format!("audio.{ext}"))
        .mime_str(&mime)
        .map_err(|e| e.to_string())?;

    let form = reqwest::multipart::Form::new()
        .part("file", file_part)
        .text("model", STT_MODEL);

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
        let msg = body["error"]["message"].as_str().unwrap_or("Transcription failed");
        return Err(format!("OpenAI STT error: {msg}"));
    }

    Ok(body["text"].as_str().unwrap_or("").trim().to_string())
}

/// Generate a short AURA chat response for a transcript.
/// History is an optional array of prior {role, content} messages (max 6 sent).
/// Returns the response text or an error string.
#[tauri::command]
pub async fn openai_chat_response(
    transcript: String,
    history: Vec<ChatMessage>,
) -> Result<String, String> {
    if transcript.trim().is_empty() {
        return Err("Transcript is empty".to_string());
    }

    let key = get_openai_key()?;
    let client = reqwest::Client::new();

    // Build messages — system + last 6 history turns + current user turn
    let mut messages: Vec<serde_json::Value> = vec![
        serde_json::json!({ "role": "system", "content": AURA_SYSTEM_PROMPT }),
    ];
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
    let client = reqwest::Client::new();

    let text = if text.len() > MAX_TEXT_LEN { &text[..MAX_TEXT_LEN] } else { &text };
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
