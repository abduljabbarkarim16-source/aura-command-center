# Phase 2D: Relay Handoff Integration

## Overview

In Phase 2D, we integrate the approval-gated reasoning relay (Phase 2C) with the handoff creation and memory workflow. When an administrator reviews a reasoning relay exchange and approves its routing recommendation, a formal `Handoff` and `PersistedMemoryEntry` are created in the local store.

This maintains the strict "human-in-the-loop" approval gate while enabling seamless data transfer between the Command Center and other agentic environments (Phase 3).

## Data Flow

1. **Relay Exchange Completion**: A relay exchange concludes with a parsed response containing key decisions, risks, and next actions.
2. **Approval Gate**: The admin reviews the response and approves routing to a specific target agent (e.g., `codex`, `claude`, `gemini`, etc.).
3. **Handoff Creation**: The `RelayService` calls `HandoffService.createHandoffFromRelay()`, generating a persisted `Handoff` record containing the parsed goals, risks, and next actions.
4. **Memory Creation**: A new `PersistedMemoryEntry` is created via `SettingsService.addMemoryEntry()` to log the architectural outcome.
5. **Cross-Referencing**: The original `RelayExchange` is updated with `createdHandoffId` and `createdMemoryEntryId`, and is marked as `routed_to_agent`.
6. **Audit Trail**: Audit events are pushed to the relay packet history.

## Persistence Keys

- **Handoffs**: `aura.handoffs.v1`
- **Memory**: `memory.entries`
- **Relay Exchanges**: `relay.exchanges`

## Mock Limitations & Constraints

Consistent with the architecture of Phase 2, this integration remains entirely local and mock-only regarding external communication. 

- **No Browser Automation**: The app does not automate ChatGPT or scrape data.
- **No Provider APIs**: Provider APIs are not yet invoked. Target agents are labels representing future endpoints.
- **No Unattended Loops**: There is no autonomous routing; an admin must click "Approve Route" and "Create Handoff".
- **Future Ready (Phase 3)**: The persistent storage mechanism means these handoffs will be ready to dispatch once the Tauri plugins for inter-process or web communication are built in Phase 3.
