/**
 * MicDeviceService — explicit microphone input selection.
 *
 * Why this exists (ERR-0074):
 * Every voice capture path previously called `getUserMedia({ audio: true })` with no
 * device constraint, so the browser bound to whatever Windows reported as the default
 * input. On a machine with more than one capture device — common with phone-relay
 * virtual mics such as WO Mic or AudioRelay — that default can be a device which opens
 * successfully, negotiates a format, and returns pure digital silence. Voice then fails
 * permanently with "No speech detected" and the user has no way to reach the working
 * device from inside the app.
 *
 * This module gives the app a single place to:
 *   - enumerate available audio inputs
 *   - remember the user's chosen device
 *   - build the `getUserMedia` constraints every call site should use
 *   - fall back audibly (not silently) when the saved device disappears
 *
 * Device labels are only populated after microphone permission has been granted at
 * least once; before that the browser returns empty labels by design.
 */

const STORAGE_KEY = 'aura.voice.inputDeviceId';

/** Sentinel meaning "let the system decide" — the pre-ERR-0074 behaviour. */
export const SYSTEM_DEFAULT_DEVICE = 'default';

export interface MicDevice {
  deviceId: string;
  label: string;
  /** True when this is the entry representing the OS default rather than a real device. */
  isSystemDefault: boolean;
}

/** Audio processing applied to every capture, independent of which device is used. */
const AUDIO_PROCESSING: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

class MicDeviceServiceImpl {
  private lastResolvedLabel: string | null = null;
  private lastFellBackToDefault = false;

  /** The device id the user selected, or SYSTEM_DEFAULT_DEVICE when unset. */
  getSelectedDeviceId(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) || SYSTEM_DEFAULT_DEVICE;
    } catch {
      return SYSTEM_DEFAULT_DEVICE;
    }
  }

  setSelectedDeviceId(deviceId: string): void {
    try {
      if (!deviceId || deviceId === SYSTEM_DEFAULT_DEVICE) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, deviceId);
      }
    } catch {
      /* storage unavailable — selection simply will not persist */
    }
  }

  /** Human-readable label of the device actually used by the last successful capture. */
  getLastResolvedLabel(): string | null {
    return this.lastResolvedLabel;
  }

  /**
   * List selectable audio inputs, with a leading "system default" entry.
   * Returns only the default entry when enumeration is unsupported or denied.
   */
  async listInputs(): Promise<MicDevice[]> {
    const fallback: MicDevice[] = [
      { deviceId: SYSTEM_DEFAULT_DEVICE, label: 'System default', isSystemDefault: true },
    ];
    if (!navigator.mediaDevices?.enumerateDevices) return fallback;

    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter(d => d.kind === 'audioinput')
        // Chromium exposes its own synthetic 'default'/'communications' entries; the
        // explicit sentinel above already covers that case.
        .filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
          isSystemDefault: false,
        }));
      return [...fallback, ...inputs];
    } catch {
      return fallback;
    }
  }

  /** True when the saved device is no longer present. */
  async savedDeviceIsMissing(): Promise<boolean> {
    const saved = this.getSelectedDeviceId();
    if (saved === SYSTEM_DEFAULT_DEVICE) return false;
    const inputs = await this.listInputs();
    return !inputs.some(d => d.deviceId === saved);
  }

  /**
   * Constraints for `getUserMedia`.
   *
   * Uses `exact`, deliberately. `ideal` is only a hint: Chromium/WebView2 is free to
   * ignore it and hand back the OS default, which it does in practice — verified at
   * runtime, where selecting one device still produced a track labelled
   * "Default - <other device>". A soft constraint here silently reintroduces the exact
   * bug this service exists to fix.
   *
   * The cost of `exact` is that a disconnected device raises OverconstrainedError
   * instead of silently degrading. That is handled explicitly in `getStream()`, which
   * is better behaviour anyway: the user is told the device is gone rather than being
   * quietly recorded from somewhere else.
   */
  getAudioConstraints(deviceId?: string): MediaStreamConstraints {
    const saved = deviceId ?? this.getSelectedDeviceId();
    if (saved === SYSTEM_DEFAULT_DEVICE) {
      return { audio: { ...AUDIO_PROCESSING }, video: false };
    }
    return {
      audio: { ...AUDIO_PROCESSING, deviceId: { exact: saved } },
      video: false,
    };
  }

  /**
   * Acquire a microphone stream using the user's selected device.
   *
   * Every voice capture path should call this rather than `getUserMedia` directly, so
   * device selection stays consistent across the app.
   */
  async getStream(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is not supported in this environment');
    }
    const saved = this.getSelectedDeviceId();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(this.getAudioConstraints());
      this.lastResolvedLabel = stream.getAudioTracks()[0]?.label || null;
      this.lastFellBackToDefault = false;
      return stream;
    } catch (err) {
      // `exact` throws when the saved device is gone. Fall back to the system default so
      // the turn still works, but record that we did so — the UI surfaces it rather than
      // letting the user believe they are recording from their chosen device.
      const isOverconstrained =
        err instanceof DOMException &&
        (err.name === 'OverconstrainedError' || err.name === 'NotFoundError');
      if (!isOverconstrained || saved === SYSTEM_DEFAULT_DEVICE) throw err;

      const stream = await navigator.mediaDevices.getUserMedia(
        this.getAudioConstraints(SYSTEM_DEFAULT_DEVICE),
      );
      this.lastResolvedLabel = stream.getAudioTracks()[0]?.label || null;
      this.lastFellBackToDefault = true;
      return stream;
    }
  }

  /** True when the last capture could not use the selected device and used the default. */
  didFallBackToDefault(): boolean {
    return this.lastFellBackToDefault;
  }

  /**
   * Measure short-term input level, 0..1, for a device.
   *
   * Used to tell "you were too quiet" apart from "this device is producing no signal at
   * all" — the distinction that made ERR-0074 hard to diagnose. A disconnected relay mic
   * returns a flat 0 here while reporting itself perfectly healthy everywhere else.
   */
  async probeSignalLevel(deviceId?: string, durationMs = 1200): Promise<number> {
    const id = deviceId ?? this.getSelectedDeviceId();
    // Two things matter here and both were got wrong on the first attempt:
    //   1. `exact`, not `ideal` — a soft constraint silently measures the OS default
    //      instead, which reports every input as healthy and defeats the probe.
    //   2. Processing OFF — automatic gain control amplifies the noise floor, so a
    //      digitally silent device can register as having signal.
    const raw: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
    const constraints: MediaStreamConstraints =
      id === SYSTEM_DEFAULT_DEVICE
        ? { audio: raw, video: false }
        : { audio: { ...raw, deviceId: { exact: id } }, video: false };

    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      let peak = 0;
      const started = Date.now();
      while (Date.now() - started < durationMs) {
        analyser.getByteTimeDomainData(buf);
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        await new Promise(r => setTimeout(r, 50));
      }
      return peak;
    } finally {
      try { stream?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
      try { await ctx?.close(); } catch { /* ignore */ }
    }
  }
}

export const micDeviceService = new MicDeviceServiceImpl();
