# AURA Command Center — Premium Operator UX Design Brief

**Phase:** 2E — Premium Operator UX Redesign  
**Branch:** `phase-2e-aura-operator-ux-redesign`  
**Date:** 2025

---

## 1. Vision

AURA is an assistant-first, trust-first operator console for directing AI agents. The UI must feel like a premium AI product — not a developer dashboard. Every surface should communicate confidence, clarity, and intentional authority. The operator is in command; AURA amplifies and executes with precision.

**Design north star:** *A control room for the future of work — powerful, calm, and deeply trustworthy.*

---

## 2. Layout Architecture

```
┌────────────┬──────────────────────────────────────┬────────────────┐
│  Sidebar   │         Center Canvas                │  OperatorRail  │
│  (64/256px)│       max-w-4xl, centered            │  (68/340px)    │
│            │                                      │                │
│  Icon-only │  [Top gradient nav]                  │  [Collapsed]   │
│  or full   │  [Chat / Message stream]             │  Icon badges   │
│  nav       │  [AuraComposer pinned bottom]        │  only          │
│            │                                      │  [Expanded]    │
│            │                                      │  Full context  │
│            │                                      │  stack         │
└────────────┴──────────────────────────────────────┴────────────────┘
```

### 2.1 Sidebar (Left)
- **Collapsed:** 68px wide, icon-only with tooltip labels, system status pulse at bottom
- **Expanded:** 256px wide, full nav labels, branding header, keyboard shortcut hints
- **Transition:** `transition-all duration-300` — smooth, no layout jump
- **Active state:** Left border accent (indigo), background highlight

### 2.2 Center Canvas
- **Max width:** `max-w-4xl` centered with horizontal padding
- **Top overlay:** Gradient fade, AURA identity + status badge, "Technical Details" button
- **Message stream:** Scrollable, `custom-scrollbar`, padded top (accounts for nav overlay)
- **Composer:** Pinned bottom with gradient fade, never overlaps messages

### 2.3 OperatorRail (Right)
- **Collapsed:** 68px icon strip, colored badge counts, no labels
- **Expanded:** 340-380px context panel with OperatorStack sections
- **Contains:** Mission status, approval queue, agent roster, system health

### 2.4 TechnicalDrawer (Slide-in)
- Triggered by "Technical Details" button in top nav
- 420px right-side drawer, 5 tabs: Workspace / Artifacts / Runtime / Voice / Git+Cmds
- Escape or click-outside to close

---

## 3. Visual System

### 3.1 Color Palette
| Token | Value | Use |
|---|---|---|
| Surface 1 | `zinc-950` | App background |
| Surface 2 | `zinc-900` | Cards, panels |
| Surface 3 | `zinc-800` | Input backgrounds, hover states |
| Border | `zinc-800/60–80%` | Subtle separators |
| Text primary | `zinc-100` | Headings, active labels |
| Text secondary | `zinc-400` | Body text, metadata |
| Text muted | `zinc-500–600` | Placeholders, timestamps |
| Accent | `indigo-500/600` | Primary actions, active states |
| Success | `emerald-400/500` | Online status, approvals |
| Warning | `amber-400` | Medium risk, pending |
| Danger | `rose-500` | High/critical risk, rejections |
| Info | `sky-400` | System info, references |

### 3.2 Typography
- **Family:** System sans-serif (`font-sans`)
- **Headings:** `font-semibold tracking-tight`
- **Labels/badges:** `text-[10–11px] font-semibold tracking-wider uppercase`
- **Body:** `text-[15px] leading-relaxed`
- **Monospace snippets:** `font-mono text-sm`

### 3.3 Border Radius
- **Cards/panels:** `rounded-2xl` (major), `rounded-xl` (minor)
- **Buttons:** `rounded-xl` (large), `rounded-lg` (default), `rounded-full` (chips/badges)
- **Message bubbles:** `rounded-3xl` with asymmetric corner treatment

### 3.4 Shadow / Glow
- **Key cards:** `shadow-xl`
- **Active orb:** `shadow-[0_0_20px_rgba(79,70,229,0.5)]`
- **Glowing elements:** box-shadow with low-opacity indigo/emerald
- **Backdrop blur:** `backdrop-blur-md` on floating elements

### 3.5 Spacing
- **Section gaps:** `gap-6` (major), `gap-3–4` (moderate), `gap-1.5–2` (tight)
- **Card padding:** `p-4` or `p-5`
- **Section headers:** `px-3 py-2`

---

## 4. Message System

Every message in the assistant canvas has a defined type. Rendering varies by type.

| Type | Visual Treatment |
|---|---|
| `user` | Right-aligned, `zinc-800` pill, rounded-tr-sm |
| `assistant` | Left-aligned, `zinc-900/40` with border, rounded-tl-sm, Sparkles icon |
| `system` | Centered compact card, icon + summary, muted, expandable |
| `agent-handoff` | Left-aligned with GitBranch icon, source→target route display |
| `approval-request` | Left-aligned ApprovalCard inline |
| `tool-status` | Compact inline strip with tool name, status badge, duration |
| `typing` | Three-dot bounce animation |

**AssistantMessage component** handles all these types via a `type` discriminator prop.

---

## 5. Voice-First Composer

The composer is the primary interaction point. It must feel alive and responsive.

- **Orbit orb:** Idle = zinc static; Focused = indigo glow; Listening = indigo pulse ring + spin
- **Placeholder:** *"Talk to AURA or type a command..."*
- **Quick chips:** Contextual one-tap commands above composer
- **Voice button:** Toggles listening state; shows "Stop" in rose when active
- **Send button:** Enabled only when text present; indigo when active
- **Attachment:** Paperclip stub (future file/image context)

---

## 6. Approval Cards

Approvals are first-class UI objects, not afterthoughts.

- Risk level drives the card's left border color: `zinc` / `amber` / `orange` / `rose`
- Risk icon: `Info` / `AlertTriangle` / `AlertOctagon` / `ShieldAlert`
- Route display: Source agent pill → arrow → Target agent pill
- Three actions: Approve (emerald), Reject (rose), Details (zinc)
- Status variants: pending (interactive), approved (dimmed + badge), rejected (dimmed + badge)

---

## 7. Project / Workspace Segmentation

Projects are mission containers. Each project card shows:

- Project name + status badge (active/paused/completed)
- Mission objective (truncated)
- Current agent assignment
- Progress indicator
- Last completed action + next scheduled action
- Open approvals count (amber badge)

The Projects page uses a masonry-inspired grid (3 cols desktop, 2 tablet, 1 mobile), not a flat table.

---

## 8. Relay Card-Based UX

The Relay page shifts from form-first to summary-first.

- **Primary view:** "AURA prepared this relay" summary card with packet type, target, context preview, action summary
- **Advanced Edit:** Collapsible section revealing full form fields
- **Status track:** Visual pipeline showing current `RelayStatus` state
- **History panel:** Timeline cards per exchange with status badge, timestamps, handoff link

---

## 9. Future Placeholder Cards

These surfaces signal roadmap without breaking the UX.

### Dispatcher Mode (Planned)
- Teaser card on Dashboard or Settings
- Icon: `Network`
- Subtitle: "Autonomous multi-agent task distribution — coming soon"
- Badge: `PLANNED`

### Remote Relay Channel (Planned)
- Command relay via secure tunnel (mobile approval, remote ops)
- Icon: `Radio`
- Badge: `PLANNED`

### Mobile Approval Channel (Planned)
- Push approval to mobile device
- Icon: `Smartphone`
- Badge: `PLANNED`

### Oracle / OpenClaude Agent (Concept)
- Deep reasoning agent with multi-pass synthesis
- Icon: `BrainCircuit`
- Badge: `CONCEPT`
- "Designed to integrate with Claude's extended thinking"

---

## 10. Trust & Safety UX Principles

- **Tools locked by default:** Visual "locked" state until operator approves
- **Approval gates:** Any action with external effect requires explicit approve/reject
- **Audit trail visible:** Every relay, handoff, and agent action has a timestamp + source attribution
- **No silent execution:** System events surface as cards, never silently applied
- **Sensitive data never in plain text:** API keys, tokens shown as masked placeholders only
- **External tools require unlock:** TechnicalDrawer gates tool access behind approval queue

---

## 11. Animation Principles

- **Enter transitions:** `fade-in` + `slide-in-from-bottom-8` at `duration-700` (full screens); `zoom-in-95` at `duration-200` (modals/dialogs)
- **Sidebar/rail transitions:** `transition-all duration-300` width change, no opacity flicker
- **Listening state:** `animate-ping` opacity ring on composer orb
- **Status pulses:** `animate-pulse` on emerald/indigo status dots
- **Message stream:** New messages appear with short fade-in

---

## 12. Accessibility Principles

- All interactive elements have visible focus rings (`focus-visible:ring-2`)
- Color is never the sole conveyor of meaning (icons + labels accompany color)
- Keyboard navigable command palette (Ctrl+K, arrow keys, Enter, Escape)
- Semantic HTML (`button`, `main`, `nav`, `header`) where possible
- ARIA labels on icon-only buttons

---

---

## 13. Phase 2E Deep Refinement — Research Notes

### 13.1 Inspiration Sources (Public, Original Implementation)

Reviewed public screenshots, documentation, and general knowledge of:
- **ChatGPT voice mode UI** — floating orb with waveform, clean status strip, no visible controls during listening
- **Claude.ai interface** — calm dark UI, centered conversation, minimalist top nav, no sidebar noise
- **Codex/GPT-4o agent IDEs** — console-dominant with gated approval flows
- **Linear's dashboard** — compact stat cards, section headers, "View details" deflection
- **Raycast** — command palette with grouped commands, description text, keyboard hints

No proprietary assets, CSS, or source code were copied. All implementations are original.

### 13.2 Final UI Principles (Phase 2E Deep Refinement)

**Default visible UI:**
- AURA voice presence (orb/visualizer)
- Active mission card
- Active agent indicator
- Central conversation
- One approval card if pending
- Compact status strip
- Voice-first composer with quick chips

**Hidden by default (accessible via Technical Details / Command Palette):**
- Debug logs
- Model router internals
- Workspace technical details
- Git command queue
- Usage meters
- Long relay forms
- Raw JSON / developer data

**Calm, premium, restrained aesthetic:**
- No sci-fi animations beyond purposeful state indicators
- No pulsing decorations unless conveying live state
- Color used to communicate status, not decorate
- Spacing generous but not wasteful

### 13.3 Voice Interaction Model

```
idle          → zinc dot, slow breathing
listening     → indigo orb, rings expanding, waveform bars animate
thinking      → violet, spinning inner ring
speaking      → emerald, fast waveform bars
waiting_approval → amber, gentle pulse
executing     → orange, fast spin
error         → rose, sharp pulse
```

**No real audio capture in Phase 2E.** Voice buttons are clearly labeled as placeholders.
Future hookup: replace mock amplitude with `AnalyserNode.getByteFrequencyData()` values.

### 13.4 Approval Card Model

Every external action that has side effects goes through an approval gate:
- Risk level: `low` / `medium` / `high` / `critical`
- Left border color encodes risk
- Three action buttons: Approve / Reject / Details
- Status variants: pending (interactive), approved (dimmed), rejected (dimmed)
- Approval requests surface in: Relay page, OperatorStack panel, Dashboard, Console inline

### 13.5 Project / Workspace Model

```
ProjectMission {
  id, name, status (active|paused|blocked|completed|draft)
  mission        // 1-2 sentence objective
  activeAgent    // assigned agent name
  progress       // 0-100
  lastAction     // what was completed
  nextAction     // what comes next
  openApprovals  // count of pending approval gates
  lastUpdated    // ISO timestamp
  tags           // tech stack tags
}
```

Filters: All | Active | Paused | Blocked | Completed

### 13.6 Provider Capability Safety Model

**RULES (inviolable):**
1. Never display API key values, not even partially masked
2. Only perform a truthy length check on `import.meta.env[KEY]`
3. Never log, store, or transmit key values
4. Never run paid API calls automatically (unattended loops prohibited)
5. `.env` is never committed — `.env.example` contains placeholder names only

**Status labels:** CONFIGURED / NOT SET / READY (no key needed) / PLANNED / CONCEPT

### 13.7 Dispatcher / Remote Capability Future Model

All future distributed capabilities are surfaced as placeholder cards with tier badges:

| Feature | Tier | Notes |
|---|---|---|
| Dispatcher Mode | PLANNED | Autonomous multi-agent task distribution |
| Remote Relay Channel | PLANNED | Secure tunnel command relay |
| Mobile Approval Channel | PLANNED | Push approval to mobile device |
| Oracle / OpenClaude | CONCEPT | Deep reasoning synthesis agent |

**No networking, no port exposure, no real mobile connection in Phase 2E.**

---

## 14. Phase 2E Voice Core — Product Correction

**Correction date:** 2026-05-28  
**Applies to:** `phase-2e-aura-operator-ux-redesign`

---

### 14.1 Core Principle Change

AURA is no longer **console-first**. AURA is now **voice-presence-first**.

The console, dashboard, relay, projects, memory, and technical panels are background layers — summoned only when needed. The primary interface is the AURA Voice Core: a large, ambient, reactive visualizer that communicates presence, state, and intent.

> *The admin talks to AURA. AURA reacts visually. Everything else surfaces on request.*

---

### 14.2 Presence-First Model

```
┌─────────────────────────────────────────────────────────┐
│  [Status chips: Memory / Relay / Tools / Agent]          │  ← ambient top strip
│                                                          │
│  [Thought card]   [AURA Orb — xl]   [Thought card]      │  ← main presence
│                   [State label]                          │
│                   [Admin indicator]                      │
│                                                          │
│  [Approval card — only when pending]                     │  ← surfaces on demand
│                                                          │
│  [🎤 Speak]  [Open Console]  [Admin Panel]  [Details]   │  ← minimal actions
└─────────────────────────────────────────────────────────┘
```

**Default visible:**
- AURA voice visualizer (xl, center)
- Current AURA state label
- Active mission chip (collapsible card)
- Status chips: Memory / Relay / Tools / Agent
- Thought cards (momentary, auto-dismiss)
- Admin voice indicator
- Safe Monitor Mode badge (when active)
- Pending approval badge + card (when pending)
- Three action buttons: Speak / Open Console / Open Admin Panel / Show Details

**Hidden by default (opened on demand):**
- Chat console (full message stream + composer)
- Admin Panel overlay (project/relay/handoff/health)
- Technical Drawer (workspace / artifacts / runtime / git)
- OperatorRail (right panel)

---

### 14.3 Console Mode System

```ts
type ConsoleMode = 'voiceCore' | 'chatConsole';
```

| Mode | Default | Description |
|------|---------|-------------|
| `voiceCore` | ✅ yes | Large AURA orb, thought cards, approval overlay, minimal chrome |
| `chatConsole` | no | Full message stream + AuraComposer, ← Voice Core button in nav |

**"Open Console"** → switches to `chatConsole`  
**"← Voice Core"** button in console top nav → returns to `voiceCore`  
**Admin Panel** → `AdminPanelOverlay` slide-in (available in both modes)  
**Technical Drawer** → `TechnicalDrawer` (available in both modes)

---

### 14.4 Momentary Thought Cards

`AuraThoughtStack` displays a rotating set of concise status cards near the visualizer.

Rules:
- No raw logs — only human-readable summaries
- Auto-dismiss after 3–5 seconds (TTL per card)
- Max 2 visible at a time (mobile: below orb; desktop: flanking the orb)
- Variants: info / mission / relay / approval / tool / memory / agent / success / warning

Example thoughts:
- *"Reviewing current mission…"* (mission variant)
- *"Relay packet ready."* (relay)
- *"1 approval waiting."* (approval)
- *"No external tools running."* (tool)
- *"Memory updated."* (memory)
- *"Antigravity is standing by."* (agent)

---

### 14.5 Admin Speaking Indicator

`AdminVoiceIndicator` is a small waveform strip placed below the AURA orb.

States:
| State | Visual | Color |
|-------|--------|-------|
| `idle` | flat bars | zinc |
| `speaking` | animated bounce bars | sky blue |
| `muted` | flat bars | rose |
| `push-to-talk-ready` | flat bars + dot pulse | amber |

Controlled by the same mic/mute toggle buttons on the Voice Core.  
No real audio capture. CSS `admin-bar-bounce` keyframe, no Web Audio API.

---

### 14.6 Approval Overlay Model

Approvals surface as prominent cards **over the Voice Core**, not buried in the operator panel.

- Amber badge in status strip: *"1 Approval"* (pulses)
- `ApprovalCard` animates in below the orb when pending
- Three buttons: Approve (indigo) / Reject (zinc/rose) / Details (opens Technical Drawer)
- After decision: card dims with Approved / Rejected status badge, then auto-fades

The approval card uses the existing `ApprovalCard` component — no duplication.

---

### 14.7 Admin Panel Overlay

`AdminPanelOverlay` is a slide-in right-side panel (380px) containing:
- **Projects** — name, status badge, progress bar, agent
- **Relay** — label, risk level, status
- **Handoffs** — from→to route, objective, status
- **System Health** — 4 check indicators
- **Technical Drawer** shortcut button at the bottom

Hidden by default. Opened via "Open Admin Panel" on Voice Core or Console nav.  
Backdrop blur + click-outside to close.

---

### 14.8 Voice Interaction Future Model

Voice Core is designed for real audio connection in a future phase:

```
Current (Phase 2E):         Future:
─────────────────────────   ──────────────────────────────────
Mock amplitude (0.4)     →  AnalyserNode.getByteFrequencyData()
Speak button (placeholder)→  MediaStream + VAD
Admin waveform (CSS)     →  Real input stream bars
AURA bars (CSS bounce)   →  Real TTS amplitude
```

Phase 2E voice buttons are clearly labeled `(placeholder)` to signal this gap.

---

### 14.9 Layout Changes

| Setting | Before (2E Deep Refinement) | After (Voice Core) |
|---------|-----------------------------|--------------------|
| Default sidebar state | Expanded (256px) | Collapsed (68px) |
| Default right rail | Collapsed (68px) | Collapsed (68px) |
| Default console mode | `chatConsole` | `voiceCore` |
| First post-launch view | Dense chat stream | AURA orb + state |

The sidebar and right rail remain available — collapsed by default to give Voice Core full visual dominance.

---

*End of design brief — Phase 2E (including Voice Core correction)*
