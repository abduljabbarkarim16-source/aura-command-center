"""
local_stt.py — AURA Phase 3K local Whisper STT sidecar
Called by Tauri via: python scripts/local_stt.py <audio_file> [language]

Reads audio bytes from a temp file, transcribes with faster-whisper,
prints the transcript text to stdout, exits 0 on success / 1 on error.

Model: small.en  (good accuracy on CPU, ~500MB, fast enough for real-time use)
Device: cpu  (always safe; GPU auto-selected if available via compute_type)
"""

import sys
import os
import json

def main():
    if len(sys.argv) < 2:
        print("ERROR: usage: local_stt.py <audio_file> [language=en]", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "en"

    if not os.path.exists(audio_path):
        print(f"ERROR: audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel

        # Use small.en for English — good balance of speed/accuracy on CPU.
        # int8 quantization runs on any CPU without AVX512.
        model = WhisperModel(
            "small.en" if language == "en" else "small",
            device="cpu",
            compute_type="int8",
        )

        # Optional: read a vocabulary prompt from env var (set by Rust caller)
        prompt = os.environ.get("AURA_STT_PROMPT", "")

        segments, info = model.transcribe(
            audio_path,
            language=language,
            beam_size=5,
            initial_prompt=prompt if prompt else None,
            vad_filter=True,          # built-in VAD — skips silence
            vad_parameters={"min_silence_duration_ms": 400},
        )

        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        full_text = " ".join(text_parts).strip()
        print(full_text)   # stdout → Rust captures this
        sys.exit(0)

    except ImportError:
        print("ERROR: faster-whisper not installed. Run: pip install faster-whisper", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
