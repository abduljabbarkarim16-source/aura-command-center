# AURA Voice Runtime Architecture

**Phase:** 2F — Voice Runtime Foundation  
**Branch:** `phase-2f-voice-runtime-foundation`  
**Status:** Mock/local events only — no real audio, no real APIs

---

## Overview

Phase 2F introduces a central event-driven runtime layer that replaces the
scattered hardcoded state previously embedded in UI components. The Voice Core
is now a pure consumer of runtime snapshots; all mutable state lives in the
`VoiceRuntimeService` singleton.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         VoiceRuntimeService                           │
│                                                                        │
│  _state (VoiceRuntimeState)         _pendingApprovals[]               │
│  _activeSpeaker (VoiceSpeaker)      _recentEvents[]                   │
│  _mission (VoiceMission)            _isMuted, _isSafeMode             │
│                                                                        │
│  startListening()  stopListening()  requestApproval()                 │
│  startThinking()   startSpeaking()  resolveApproval()                 │
│  stopSpeaking()    setMuted()       setSafeMode()                     │
│  runDemoSequence() clearRuntime()   simulateApproval()                │
│                                                                        │
│  emit(event) ──▶ handleNotificationBridge() ──▶ NotificationService  │
│              └──▶ broadcast() ──▶ all SnapshotListeners              │
└──────────────────────────────────────────────────────────────────────┘
                          │ subscribe(fn) → unsubscribe
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       useVoiceRuntime() hook                          │
│  useState(snapshot) + useEffect(subscribe)                            │
│  Returns: VoiceRuntimeSnapshot + bound action methods                 │
└──────────────────────────────────────────────────────────────────────┘
                          │ useVoiceRuntime()
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        AuraVoiceCore                                  │
│  Maps runtime.state → VisualizerState                                 │
│  Maps runtime.activeSpeaker → visualizerSource                        │
│  Maps runtime.isMuted → adminVoiceState                               │
│  Renders ApprovalTray from runtime.pendingApprovals[0]                │
│  Calls runtime.startListening() / stopListening() on Speak button     │
│  Calls runtime.toggleMuted() on Mute button                           │
│  Calls runtime.runDemoSequence() on Demo button                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Type Hierarchy

```
src/types/voice-runtime.ts
├── VoiceRuntimeState       ready | listening | thinking | speaking |
│                           waiting_for_approval | executing | error | muted
├── VoiceRuntimeMode        mock | real
├── VoiceRuntimeStatus      active | degraded | offline
├── VoiceSpeaker            aura | admin | system | none
├── VoiceRuntimeSource      aura | admin | system
├── VoiceRuntimeEventType   aura_ready | admin_started_speaking | ...
├── VoiceRuntimeEvent       { id, type, timestamp, payload? }
├── VoiceApprovalRequest    { id, title, summary, riskLevel, ... status }
├── VoiceMission            { name, phase, progress, agent }
└── VoiceRuntimeSnapshot    (all of the above, immutable point-in-time view)
```

---

## State Machine

```
                   ┌─────────────────────────────────┐
                   │              ready               │ ◄─── clearRuntime()
                   └───┬──────────────┬──────────────┘
                       │              │
              startListening()   startThinking()
                       │              │
                       ▼              ▼
                   listening      thinking
                       │              │
             stopListening()    startSpeaking() / requestApproval()
                       │              │
                       ▼    ┌─────────┤
                    ready   │  speaking│   waiting_for_approval
                            │         │          │
                    stopSpeaking()    │   resolveApproval()
                                      │          │
                                   ready ◄───────┘
```

Transitions from any state:
- `setMuted(true)` + state=`listening` → `muted`
- `setMuted(false)` + state=`muted` → `ready`
- `setState(error)` → `error` (explicit error injection)
- `clearRuntime()` → `ready` (always safe escape hatch)

---

## Event Bus

Every call to `emit(type, payload?)` does three things in order:
1. Creates a `VoiceRuntimeEvent` and prepends it to `_recentEvents` (capped at 30)
2. Calls `handleNotificationBridge(event)` for events with notification side-effects
3. Calls `broadcast()` to push a new `VoiceRuntimeSnapshot` to all listeners

### Notification Bridge

| Event type           | Notification  | TTL       | Notes                      |
|----------------------|---------------|-----------|----------------------------|
| `approval_requested` | `approval`    | persistent| Risk-colored, persistent   |
| `approval_resolved`  | `success`/`info` | 4 s    | Depends on decision        |
| `memory_updated`     | `memory`      | 4 s       |                            |
| `relay_ready`        | `relay`       | 5 s       |                            |
| `handoff_created`    | `info`        | 4 s       |                            |
| `tool_locked`        | `warning`     | 4 s       |                            |
| `error`              | `danger`      | 6 s       |                            |
| All others           | —             | —         | No notification side-effect|

---

## Approval Lifecycle

```
1. voiceRuntimeService.requestApproval(data)
   → creates VoiceApprovalRequest { id, status:'pending', ... }
   → pushes to _pendingApprovals
   → emits 'approval_requested' (triggers notification)
   → transitions state to 'waiting_for_approval'

2. Zone 1 badge:  pendingApprovals.filter(a => a.status==='pending').length > 0
   → badge appears, pulses (stops pulsing when tray is open)

3. Admin clicks badge → isTrayOpen toggles → ApprovalTray slides in (right side)

4. Admin clicks Approve / Reject
   → voiceRuntimeService.resolveApproval(id, decision)
   → marks approval status = decision (tray shows result)
   → after 1200 ms: removes from _pendingApprovals, may transition to 'ready'
   → emits 'approval_resolved' (triggers notification)

5. pendingApprovals.length === 0 → tray auto-closes (useEffect in AuraVoiceCore)
```

---

## Visualizer Mapping

```typescript
// VoiceRuntimeState → VisualizerState
const RUNTIME_TO_VISUALIZER = {
  ready:               'idle',
  muted:               'idle',
  listening:           'listening',
  thinking:            'thinking',
  speaking:            'speaking',
  waiting_for_approval:'waiting_for_approval',
  executing:           'executing',
  error:               'error',
};

// activeSpeaker → visualizerSource (SVG ring color accent)
// admin → 'admin'  (amber bars)
// system / thinking → 'system'  (zinc bars)
// aura → 'aura'  (state-color indigo bars)
```

The `AuraVoiceVisualizer` receives `state` and `source`. Internally,
`useMockAudioReactivity(state)` produces per-band frequency data at 60 fps
using `requestAnimationFrame`. No real microphone is used.

---

## Demo Sequence

`runDemoSequence()` fires a series of `setTimeout` callbacks:

```
t=0ms    startListening()                 → state='listening', speaker=admin
t=2400ms stopListening() + startThinking() → state='thinking',  speaker=system
t=4600ms startSpeaking()                  → state='speaking',  speaker=aura
t=7200ms stopSpeaking()                   → state='ready',     speaker=none
t=8000ms requestApproval({...})           → badge appears, tray available
```

Concurrent calls are blocked (guard: `demoTimers.length > 0`).
`clearRuntime()` cancels all pending timers via `clearTimeout`.

---

## Future Real STT/TTS Integration (Phase 3+)

The service is intentionally structured so future real audio only requires
modifying the service internals. Components and the hook are unchanged.

```typescript
// Phase 3: real microphone in startListening()
async startListening(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // build Web Audio pipeline + SpeechRecognition / Whisper
  this._state = 'listening';
  this._activeSpeaker = 'admin';
  this.emit('admin_started_speaking');
  // on transcript → this.startThinking()
}

// Phase 3: real TTS in startSpeaking()
async startSpeaking(text: string): Promise<void> {
  this._state = 'speaking';
  this._activeSpeaker = 'aura';
  this.emit('aura_started_speaking', { text });
  // send text to TTS provider, play audio
  // on audio end → this.stopSpeaking()
}
```

Provider routing follows the `VoiceRuntimeMode`:
- `'mock'` → current `setTimeout`-based simulation (Phase 2F default)
- `'real'` → live STT/TTS (Phase 3+, requires user permission grant)

---

## Phase Constraints (Phase 2F)

| Constraint | Status |
|---|---|
| Real microphone | ❌ Not requested, not implemented |
| Real STT | ❌ No SpeechRecognition, no Whisper |
| Real TTS | ❌ No speechSynthesis, no provider |
| Provider API keys | ❌ Not used anywhere |
| Real browser automation | ❌ Not implemented |
| Real MCP execution | ❌ Not implemented |
| Real terminal commands | ❌ Service makes no shell calls |
| Network ports exposed | ❌ No new ports |

All state changes are local, synchronous (or timer-based mock async).

---

*Phase 2F Voice Runtime Architecture — AURA Command Center*
