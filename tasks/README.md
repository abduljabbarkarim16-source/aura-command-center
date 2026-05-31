# AURA Task Tracking

This directory contains the task plans, checkpoints, and handoff summaries for AURA development sprints.

## Structure

- `active/`: Contains the living checkpoint file for the current sprint/phase.
- `completed/`: Archived task plans from previous phases.
- `templates/`: Markdown templates for new task plans and handoff summaries.

## Workflow

1. Start a new phase by copying `templates/task-plan-template.md` to `active/phase-XY-name.md`.
2. Update the active checkpoint file frequently as milestones are completed.
3. Use the checkpoint file to quickly hand off context between agent sessions.
4. When a phase is merged to `main`, move the checkpoint file to `completed/`.
