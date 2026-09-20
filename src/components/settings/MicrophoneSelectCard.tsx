/**
 * MicrophoneSelectCard — choose which audio input AURA records from.
 *
 * Exists because of ERR-0074: with no device selection, every capture path bound to the
 * OS default. On a machine with relay/virtual microphones that default can be a device
 * which opens successfully and returns pure digital silence, so voice failed permanently
 * with "No speech detected" and nothing in the app could fix it.
 *
 * The Test button matters as much as the picker: it distinguishes "you were too quiet"
 * from "this device is producing no signal at all", which is the distinction that made
 * the original fault so hard to diagnose.
 */

import { useCallback, useEffect, useState } from 'react';
import { Mic, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import {
  micDeviceService,
  SYSTEM_DEFAULT_DEVICE,
  type MicDevice,
} from '../../services/voice/MicDeviceService';

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'signal'; peak: number }
  | { kind: 'silent' }
  | { kind: 'error'; message: string };

/** Peak level below this over a ~1.2 s window means the device is producing nothing. */
const SILENCE_PEAK = 0.02;

export function MicrophoneSelectCard() {
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [selected, setSelected] = useState<string>(SYSTEM_DEFAULT_DEVICE);
  const [labelsHidden, setLabelsHidden] = useState(false);
  const [missing, setMissing] = useState(false);
  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' });

  const refresh = useCallback(async () => {
    const list = await micDeviceService.listInputs();
    setDevices(list);
    setSelected(micDeviceService.getSelectedDeviceId());
    setMissing(await micDeviceService.savedDeviceIsMissing());
    // Browsers withhold device labels until mic permission has been granted once.
    setLabelsHidden(list.some(d => !d.isSystemDefault && !d.label.startsWith('Microphone ')) === false
      && list.length > 1);
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
  }, [refresh]);

  const onSelect = (deviceId: string) => {
    micDeviceService.setSelectedDeviceId(deviceId);
    setSelected(deviceId);
    setProbe({ kind: 'idle' });
    setMissing(false);
  };

  const runTest = async () => {
    setProbe({ kind: 'testing' });
    try {
      const peak = await micDeviceService.probeSignalLevel(selected);
      setProbe(peak < SILENCE_PEAK ? { kind: 'silent' } : { kind: 'signal', peak });
      // Labels become available once permission is granted by the probe.
      void refresh();
    } catch (e) {
      setProbe({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="mx-5 mb-4 mt-1 p-4 rounded-lg border border-zinc-800/60 bg-zinc-900/40">
      <div className="flex items-start gap-3">
        <Mic className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-300 mb-0.5">Microphone input</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">
            Which device AURA records from. Applies to all voice capture.
          </p>

          <div className="flex items-center gap-2 mb-2">
            <select
              value={selected}
              onChange={e => onSelect(e.target.value)}
              className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.isSystemDefault ? 'System default' : d.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => void refresh()}
              title="Rescan devices"
              className="shrink-0 p-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => void runTest()}
              disabled={probe.kind === 'testing'}
              className="shrink-0 px-2.5 py-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 text-[11px] font-semibold hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
            >
              {probe.kind === 'testing' ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Listening…
                </span>
              ) : (
                'Test'
              )}
            </button>
          </div>

          {missing && (
            <p className="text-[11px] text-amber-400 flex items-start gap-1.5 mb-1">
              <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
              The saved microphone is no longer connected. AURA is falling back to the
              system default until you pick another.
            </p>
          )}

          {labelsHidden && (
            <p className="text-[11px] text-zinc-500 mb-1">
              Device names appear after microphone permission is granted — press Test once.
            </p>
          )}

          {probe.kind === 'signal' && (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              Signal detected — peak {(probe.peak * 100).toFixed(0)}%. This device is working.
            </p>
          )}

          {probe.kind === 'silent' && (
            <p className="text-[11px] text-red-400 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
              <span>
                <strong>No signal from this device.</strong> It opened successfully but
                produced silence. If it is a phone-relay microphone (WO Mic, AudioRelay),
                the phone is probably not connected. Pick a different input or reconnect it —
                speaking louder will not help.
              </span>
            </p>
          )}

          {probe.kind === 'error' && (
            <p className="text-[11px] text-red-400 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
              Could not open this device: {probe.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
