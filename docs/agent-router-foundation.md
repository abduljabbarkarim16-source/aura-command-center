# AURA Agent Router Foundation

**Milestone:** F  
**Branch:** `agent-router-foundation`

## Purpose

AURA can decide which agent should handle a given task based on task type, capability match, provider availability, and cost tier. Routing decisions feed into relay packets and handoff workflows.

## Agents Registered

| ID | Name | Provider | Role | Cost | Availability |
|---|---|---|---|---|---|
| aura | AURA (Orchestrator) | anthropic | orchestrator | high | available (key) |
| claude-architect | Claude Architect | anthropic | architect | high | available (key) |
| codex-dev | Codex Dev | openai | developer | medium | requires_key |
| gemini-vision | Gemini Vision | gemini | reviewer | low | requires_key |
| chatgpt-relay | ChatGPT Relay | chatgpt-relay | relay-target | free | available |
| admin | Admin (Manual) | admin-manual | admin | free | always |
| oracle | Oracle / OpenClaude | oracle | architect | variable | planned |

## Task Types → Preferred Agents

| Task Type | Preferred Agent | Fallback |
|---|---|---|
| architecture | claude-architect | chatgpt-relay |
| code_edit | codex-dev | claude-architect |
| debugging | claude-architect | codex-dev |
| visual_qa | gemini-vision | claude-architect |
| documentation | claude-architect | aura |
| memory_entry | aura | admin |
| deployment | admin | — |
| git | admin | — |
| relay | chatgpt-relay | admin |

## Usage

```typescript
const decision = agentRouter.route('Refactor the WorkspaceControllerService');
// → {
//   taskType: 'code_edit',
//   selectedAgent: 'Codex Dev',
//   confidence: 0.65,
//   reason: '...',
//   fallbackAgent: 'Claude Architect',
//   requiresApproval: true,
// }

console.log(agentRouter.createHandoffSummary(decision));
```

## Integration

Routing decisions:
- Feed into `RelayService.createRelayPacket()` (target agent selection)
- Feed into `HandoffService.createHandoff()` (source/target agents)
- Surfaced in Admin Panel routing card
- Admin approval required before external provider is engaged
