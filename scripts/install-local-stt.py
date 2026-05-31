"""
install-local-stt.py — AURA Phase 3K local Whisper STT setup
Installs faster-whisper and pre-downloads the 'small.en' model.
Run once: python scripts/install-local-stt.py
"""
import subprocess
import sys
import os

def run(cmd, **kwargs):
    print(f">> {' '.join(cmd)}")
    result = subprocess.run(cmd, **kwargs)
    if result.returncode != 0:
        print(f"ERROR: exit {result.returncode}")
        sys.exit(result.returncode)
    return result

def main():
    print("=== AURA local STT setup ===")
    print("Installing faster-whisper...")
    run([sys.executable, "-m", "pip", "install", "faster-whisper", "--upgrade", "--quiet"])

    print("Pre-downloading Whisper 'small.en' model (will cache to ~/.cache/huggingface)...")
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("small.en", device="cpu", compute_type="int8")
        # Quick self-test: generate a tiny segment from silence
        import numpy as np
        silent = np.zeros(16000, dtype=np.float32)  # 1s of silence
        segs, _ = model.transcribe(silent, language="en")
        list(segs)  # consume iterator
        print("Model loaded and tested OK.")
    except Exception as e:
        print(f"Model load test failed: {e}")
        print("(This is non-fatal — the model will download on first use.)")

    print()
    print("Done. AURA will use local Whisper STT when available.")
    print("Fallback: OpenAI Whisper API (used when local STT is unavailable).")

if __name__ == "__main__":
    main()
