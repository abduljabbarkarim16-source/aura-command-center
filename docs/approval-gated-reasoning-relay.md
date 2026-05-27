# AURA Command Center — Approval-Gated Reasoning Relay

> **Phase:** 2C (current)
> **Feature:** Approval-Gated Reasoning Relay
> **Route:** `/relay`
> **Last updated:** 2026-05-27

---

## What this feature does

The Reasoning Relay allows the admin to take structured output from a local AI agent
(Claude, Codex, Antigravity, etc.) and relay it to an external reasoning assistant
(currently ChatGPT via clipboard) for higher-level architectural review, debugging
guidance, or planning.

Rather than manually copy-pasting raw agent output into ChatGPT and re-pasting the
response back, AURA:

1. Formats the agent output into a structured relay packet (with objective, context,
   constraints, and requested analysis clearly labelled).
2. Presents the packet to the admin for review.
3. Copies it to the clipboard **only after explicit admin approval**.
4. Lets the admin paste it into ChatGPT manually.
5. Accepts the ChatGPT response back via a paste-in field.
6. Parses the response into structured sections: decisions, risks, next actions.
7. Presents the parsed routing plan to the admin.
8. Creates a local handoff for the chosen agent **only after admin route approval**.
9. Saves the full exchange to local persistence with a complete audit trail.

---

## Why it exists

During active development with multiple AI agents, it is common to hit problems that
benefit from a "second opinion" from a different reasoning model. Without tooling,
this requires:

- Manually copying agent output
- Writing context into a new ChatGPT prompt
- Manually parsing the response
- Manually routing the decision back to the right agent

The Reasoning Relay reduces this to an approval-gated, structured workflow while
keeping the admin fully in the loop.

---

## Human approval points

The relay workflow has **two explicit admin approval gates**:

| Gate | Description |
|---|---|
| **Approve Send** | Admin reviews the formatted packet before it is copied to clipboard. Nothing leaves AURA without this click. |
| **Approve Route** | Admin reviews the parsed response and selects the target agent before any handoff is created. |

Additionally:
- The admin manually pastes the packet into ChatGPT (AURA does not open a browser).
- The admin manually copies and pastes the ChatGPT response into AURA.
- All actions are recorded in the per-exchange audit trail.

---

## What is NOT automated in Phase 2C

| Action | Status |
|---|---|
| Opening a browser to ChatGPT | ❌ Not implemented |
| Sending the packet to ChatGPT automatically | ❌ Not implemented |
| Reading the ChatGPT response automatically | ❌ Not implemented |
| Connecting the OpenAI API | ❌ Not implemented |
| Connecting the Anthropic API | ❌ Not implemented |
| Real MCP execution | ❌ Not implemented |
| Creating actual agent handoffs | ❌ Phase 2D placeholder only |
| Voice-triggered approvals | ❌ Not implemented |

---

## Data stored

All relay exchanges are stored in `localStorage` under the key `aura:relay.exchanges`.

Each exchange contains:
- The full `RelayPacket` (objective, context, source output, constraints, analysis request)
- The imported `RelayResponse` if the admin has pasted one (raw text + parsed sections)
- A complete `auditTrail` of every status change with actor and timestamp

**Security note:** No API key values are stored. No ChatGPT session cookies or tokens
are stored. The relay is purely clipboard-based in Phase 2C.

---

## Packet format

The clipboard packet uses a plain-text format with clear section headers:

```
╔══════════════════════════════════════════════╗
  AURA REASONING RELAY — [PACKET TYPE]
  [timestamp]
╚══════════════════════════════════════════════╝

OBJECTIVE
─────────
[objective text]

CONTEXT
───────
[context text]

SOURCE OUTPUT (from [agent])
─────────────────────────────────────────────────
[agent output]

CONSTRAINTS
───────────
[constraints]

REQUESTED ANALYSIS
──────────────────
[what you want ChatGPT to analyze]

─────────────────────────────────────────────────
Please respond with the following sections:
1. KEY FINDINGS / ARCHITECTURAL DECISIONS
2. IDENTIFIED RISKS
3. RECOMMENDED NEXT ACTIONS
4. SUGGESTED AGENT / TEAM for implementation
5. HANDOFF SUMMARY (1–2 sentences)
─────────────────────────────────────────────────
```

---

## Response parsing

AURA's parser is keyword-based and pattern-matching. It looks for section headers
matching the expected structure and assigns lines to `decisions`, `risks`,
`nextActions`, or `parsedSummary` buckets.

For best results, ChatGPT should respond with clearly labelled sections matching
the requested format. Unstructured responses are accepted but will have lower
parse confidence; the admin can always review the raw text and manually select routing.

---

## Phase 2D roadmap

### Option A — Dedicated browser workspace (Chrome/WebView)

A dedicated browser panel inside AURA could open ChatGPT, inject the packet into
the message input, and read the response — all with an explicit "go" click from the
admin. This would use the Claude-in-Chrome MCP or a Tauri WebView plugin.

**Preconditions:**
- Admin must explicitly grant the browser automation permission
- Admin must be logged into ChatGPT in the managed browser instance
- Admin still approves each send action

### Option B — OpenAI API adapter

Once Phase 3 secure-storage is available, the relay could use the OpenAI API
directly with a key stored in OS secure storage (never in localStorage).

**Preconditions:**
- Phase 3 Tauri Keyring integration complete
- Admin provides OpenAI API key via secure key dialog
- Admin approves each API relay call

### Handoff integration

Phase 2D will wire `createHandoffFromRelay()` to the actual Handoffs persistence
layer, creating a real handoff entry visible in the Handoffs page with the full
relay context attached.

---

## Relay status lifecycle

```
drafted
  └── waiting_for_admin_review
        ├── rejected
        └── approved_to_send
              └── sent_to_chatgpt
                    └── waiting_for_chatgpt_response
                          └── response_imported
                                └── parsed
                                      ├── waiting_for_route_approval
                                      └── approved_to_route
                                            ├── routed_to_agent
                                            └── archived
```
