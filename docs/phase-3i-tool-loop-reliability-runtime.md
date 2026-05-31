# Phase 3I: Tool Loop Reliability & Internal Action Runtime
## Milestone 1: Tool Loop Audit

### 1. Which tools are registered?
The `ToolRegistryService` currently registers 20 tools:
- **Terminal:** `terminal.gitStatus`, `terminal.gitBranch`, `terminal.gitLog`, `terminal.npmLint`, `terminal.npmBuild`, `terminal.cargoTest`
- **CLI Agent:** `cli.claudeCheck`, `cli.codexCheck`, `cli.claudeRunTiny`, `cli.codexRunTiny`
- **Memory:** `memory.rememberFact`, `memory.setUserName`, `memory.updatePreference`, `memory.getUserProfile`, `memory.getCapabilityStatus`, `memory.summarizeThread`, `memory.compactThread`, `memory.deleteMemoryItem`
- **Capability:** `capabilities.can`, `capabilities.whyNot`, `capabilities.test`, `capabilities.gapReport`

### 2. Which tools are callable by AURA?
All registered tools are callable by AURA via `AuraToolDispatchService` interacting with the OpenAI function-calling loop. However, tools with `requiresApproval: true` (e.g., `terminal.npmBuild`, `cli.claudeRunTiny`) cannot be executed automatically unless explicit approval is provided or the user is in Admin Bypass mode.

### 3. Which tools create RuntimeTasks?
Currently, *all* tools executed via `ToolRegistryService.execute()` create a `RuntimeTask` if one is not provided in the options. The task is created with a title like `Tool: {name}` and started/completed within the `execute` wrapper.

### 4. Which tools update capability evidence?
`capabilities.test` updates the underlying capability evidence when testing tools. However, other tools do not currently write back evidence of success to the capability registry automatically after execution (which is a gap we need to fix in the execution contract).

### 5. Which tools produce notifications?
Currently, `ToolRegistryService` updates `ToolExecution` state (triggering UI updates via React hooks), but it does not emit explicit notifications to the `NotificationService` for `task_started`, `task_completed`, or `task_failed`.

### 6. Which tools can be called from console?
The console (`AuraCommandConsole` and `useConsoleConversation`) routes text into the same backend processing pipeline. Any tool can be called from the console if the model decides to invoke it.

### 7. Which tools can be called from voice?
The voice pipeline (`useConversationLoop`) routes transcripts to the LLM backend. If configured with tools, the LLM can output tool calls for any registered tool. However, async voice callbacks and interruptions are not yet robustly wired to tool completion events.

### 8. Which tools only exist as UI buttons?
No tools *only* exist as UI buttons. All tools are registered in the central `TOOL_CATALOG`. However, some capabilities might be triggered directly from UI panels bypassing the `ToolRegistryService.execute()` pipeline if not careful (e.g., direct calls to `AuraMemoryService`).

### 9. Where can AURA still hallucinate success?
AURA can hallucinate success if the tool call fails or requires approval, but the LLM proceeds to claim success in its response message before receiving the final tool execution result. Additionally, memory updates via voice might not trigger a verified save if the LLM hallucinated the tool call or the tool call silently failed.

### 10. What is missing to make the loop reliable?
- **Tool Result Schema:** A unified schema for all tool results (success, failure, blocked, requires_approval).
- **Execution Contract:** Emitting notifications, updating capability evidence, and preventing hallucinated success claims.
- **Incident Labels:** Automatically flagging mistakes (e.g., `hallucinated-success`, `tool-dispatch-failed`).
- **Async Voice/Console Handling:** Subscribing to long-running task completions to trigger a voice callback or append a console message.
- **Self-Test Runner:** A robust way to verify all tools run cleanly through the dispatch pipeline.
