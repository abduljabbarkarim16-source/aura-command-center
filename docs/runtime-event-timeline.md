# AURA Runtime Event Timeline

**Milestone:** I  
**Branch:** `runtime-event-timeline`

## Purpose

AURA remembers important runtime events persistently. The timeline subscribes to VoiceRuntimeService and selectively persists meaningful state changes — not every frame or idle tick.

## What Gets Persisted

| Event | Category | Severity |
|---|---|---|
| approval_requested | approval | warning |
| approval_resolved | approval | success/info |
| relay_ready | relay | info |
| handoff_created | handoff | success |
| memory_updated | memory | info |
| tool_locked/running/completed | tool | warning/info/success |
| error | error | error |
| aura_ready | system | success |

## What Does NOT Get Persisted

- Waveform data or audio frames (too noisy)
- Every idle/listening state transition
- Any secret values or API keys
- Raw file contents or tool payloads

## Usage

```typescript
// Subscribe to live timeline
const unsub = runtimeTimeline.subscribe(events => {
  setTimelineEvents(events);
});

// Filter
const errors = runtimeTimeline.filter({
  categories: ['error', 'approval'],
  unreadOnly: true,
  maxItems: 20,
});

// Mark as read
runtimeTimeline.markRead(eventId);
runtimeTimeline.markAllRead();

// Export
const json = runtimeTimeline.export({ since: Date.now() - 86_400_000 });
```

## Storage

- Key: `aura:runtime.timeline`
- Cap: 500 events in memory, 200 high-value events persisted to localStorage
- High-value categories: `error`, `approval`, `relay`, `handoff`, `memory`
- Persisted events reload on next app launch
