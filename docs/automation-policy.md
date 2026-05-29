# Automation Policy

> This document defines the rules governing how AURA evaluates commands during autonomous execution, preventing unsafe actions without manual intervention.

## Policy Evaluation Logic

The `CommandPolicyService` is responsible for classifying all shell commands AURA wishes to execute. In Phase 2, this is the foundational layer for ensuring the system does not harm itself or the user's computer.

### The `evaluateAutonomousExecution` Method

When an autonomous agent attempts to execute a command, it is routed through `evaluateAutonomousExecution(command, hasPlanApproval)`. 

The possible outcomes are:
1. **Permitted (Safe)**: The command is classified as `safe` (e.g. `npm run lint`, `git status`). It executes without friction.
2. **Permitted (Approved Plan)**: The command requires approval (e.g., `git commit`, `npm run build`), but the entire `SelfBuildPlan` it belongs to was explicitly approved by an administrator before the run began.
3. **Blocked (Admin Only)**: The command is classified as `admin_only` (e.g. `git push origin main`). Even if the plan is approved, this specific command *always* requires a real-time prompt to the user before proceeding.
4. **Blocked (Strict)**: The command is explicitly banned (e.g., `rm -rf`, `format`). It will never execute under any circumstances.

## Goal

This dual-gating mechanism allows AURA to run autonomously for long periods (e.g., overnight) if the user pre-approves the plan, while remaining absolutely certain that highly destructive actions cannot occur unless the user explicitly intervenes at runtime.
