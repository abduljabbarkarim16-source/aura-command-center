# Make.com Connector Foundation

## Overview
The Make.com connector bridges AURA's local autonomous capabilities with external workflows (Slack, Jira, Email, etc.) via webhooks.

In the "Foundation" phase, the connector is intentionally running in **Dry-Run Mode**. It structurally validates payloads, evaluates triggers, and tests URL shapes, but **does not make live HTTP calls** to Make.com.

## Security Boundaries
1. **No Live Calls**: All `triggerScenario` actions immediately return simulated dry-run responses.
2. **Masked Webhooks**: Webhook URLs are considered sensitive. They are never displayed in full in the UI or written to logs. The `MakeWebhookConfig` stores the raw URL but explicitly requires the UI to bind to `maskedUrl` (e.g. `https://hook.us1.make.com/abcdef...`).
3. **Outbound Only**: For now, AURA only pushes events out. There is no inbound bridge exposing local control to Make.com.

## Supported Events
- `self_build_plan_created`: Emitted when AURA completes an autonomous planning phase.
- `command_proposed`: Emitted when AURA queues a new shell/git command.
- `command_completed`: Emitted when a command finishes.
- `approval_required`: Emitted when AURA hits a policy block requiring human intervention.
- `memory_entry_created`: Emitted when AURA learns a new project rule.
- `provider_status_changed`: Emitted when an API key is detected as missing or invalid.
- `runtime_error`: Emitted on unhandled system exceptions.
- `relay_ready`: Emitted when AURA prepares a context bundle for a larger LLM.
- `handoff_created`: Emitted when AURA hands work back to the human.
- `build_completed`: Emitted when a Tauri or Web build concludes.

## Safe Payload Contract
Payloads follow a strict structural contract that avoids passing sensitive workspace data out into the cloud. 
```json
{
  "eventId": "make-evt-123",
  "eventType": "self_build_plan_created",
  "timestamp": "2026-05-29T...",
  "source": "aura-command-center",
  "data": { "goal": "..." },
  "riskLevel": "safe"
}
```

## Next Steps (Milestone 9)
We will export blueprint files to allow the user to 1-click import these scenarios into Make.com before activating the live connection.
