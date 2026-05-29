# Self-Build Loop Readiness

> This document defines the Phase 2G/H/J capability of AURA to safely validate that all necessary systems are configured before launching an autonomous run.

## Overview

AURA's self-build loop involves a complex interplay of agents, commands, and providers. In the Foundation Phase, AURA does not execute the loop. Instead, it provides a readiness evaluation to ensure the system *would* succeed if the dispatcher were active.

### Security Rules (Immutable)

1. **No Autonomous Execution**: `SelfBuildOrchestratorService` only generates plans. It does not auto-approve proposals or launch shells.
2. **Strict Readiness Gates**: An autonomous plan cannot be drafted unless the LLM Provider, Make.com connector, and Workspace are all fully configured.

## Readiness Evaluation

The `evaluateConnectionReadiness()` method checks:

1. **LLM Provider**: At least one provider must be configured for the `chat` or `code` capability.
2. **Make.com Connector**: The Make.com Webhook service must be `configured` (the URL is valid and saved).
3. **Agent Workspace**: The `WorkspaceControllerService` must have an active workspace bound to avoid destructive operations in the wrong folder.

## Autonomous Plan Generation

When `createAutonomousRunPlan(goal)` is invoked:
1. It validates readiness using the checks above. If not ready, it throws an error.
2. It generates a `SelfBuildPlan` containing standard milestones.
3. It tags the plan as `[AUTONOMOUS]` in the UI.
4. It still enforces `requiresAdminApproval = true` for critical tasks, because we are in the connection-readiness phase, not full-auto phase.

This readiness check ensures that when the Dispatcher is enabled in Phase 3, AURA won't crash on the first step due to missing credentials or unconfigured webhooks.
