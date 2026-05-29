# AURA Self-Build Agent Architecture

**Phase:** 2G design only — no real command execution implemented  
**Status:** Documentation + UI placeholder. Implementation in Phase 2J.

---

## What "Self-Building" Means

AURA can iteratively improve its own codebase by treating itself as a managed software project. A "self-build" cycle is a structured sequence of:

1. Admin or AURA identifies a desired change (feature, fix, cleanup)
2. AURA proposes an implementation plan
3. Admin reviews and approves the plan
4. AURA executes approved steps (edit files, run checks) — gated by permission class
5. AURA validates (lint, build, tests)
6. AURA creates a git branch and pushes
7. Admin reviews the branch / PR and approves merge
8. Merge to main (admin-only final gate)

No step runs without the preceding approval. AURA cannot modify main directly.

---

## Allowed Autonomous Actions (no approval needed)

These actions are safe, read-only, or low-risk and can run without explicit admin sign-off:

| Action | Tool | Risk |
|---|---|---|
| Read any file in the project | File read | Safe |
| Search file contents (grep/glob) | Search | Safe |
| Inspect git status, log, diff | `git status/log/diff` | Safe |
| List directory contents | File list | Safe |
| Check TypeScript types (`npm run lint`) | Lint | Safe |
| Query memory repo (read-only) | File read | Safe |
| Check env variable *names* | `import.meta.env` | Safe |
| Generate a plan / proposal | Text output | Safe |

---

## Actions Requiring Approval

### Moderate risk — single approval
| Action | Approval type |
|---|---|
| Edit a source file | Voice Core approval badge + tray |
| Create a new file | Voice Core approval badge + tray |
| Run `npm run build` | Approval gate |
| Create a git branch | Approval gate |
| Write a memory entry | Approval gate |
| Update `.env.example` (names only) | Approval gate |

### High risk — explicit admin confirmation
| Action | Approval type |
|---|---|
| Run `npm run tauri:build` | High-risk approval card |
| Install a new npm dependency | High-risk approval card |
| Push a branch to origin | High-risk approval card |
| Delete a file | High-risk approval card |
| Write to the memory repo | High-risk approval card |
| Run arbitrary shell scripts | High-risk approval card |

### Critical — admin must perform manually
| Action | Why |
|---|---|
| Merge to main | Destructive; requires human review |
| Modify `.gitignore` | Could expose secrets |
| Set real API key values | Security boundary |
| Expose network ports | Security boundary |
| Delete git history | Irreversible |
| Run paid API calls | Cost boundary |

---

## Permission Classes

```
class Safe:
  - read files
  - search (grep/glob)
  - git status/log/diff (read-only)
  - inspect env variable names
  - generate plans

class Moderate:
  - edit files
  - create files
  - npm run lint / build
  - git branch create
  - write memory entry
  - update .env.example (names only)

class High:
  - npm install <pkg>
  - npm run tauri:build
  - git push origin <branch>
  - delete file
  - write memory repo

class Critical (admin-only, never autonomous):
  - git push --force
  - git merge origin/main → main
  - delete .env or secrets
  - run arbitrary shell scripts
  - call paid APIs
  - expose ports
```

---

## Branch Workflow

```
main (protected)
  └─ phase-N-description  ← AURA creates this branch
      ├── edits (gated by Moderate approval)
      ├── npm run lint (Safe)
      ├── npm run build (Moderate approval)
      ├── npm run tauri:build (High approval)
      ├── git push origin phase-N-description (High approval)
      └─ PR created → admin reviews → merges (Critical, admin-only)
```

Branch naming convention: `phase-{N}-{brief-description}` (consistent with existing history).

---

## Validation Workflow

Each self-build cycle runs these checks in order before requesting push approval:

1. `npm run lint` — TypeScript type check (Safe, auto-run)
2. `npm run build` — Vite bundle (Moderate approval on first build of session)
3. Manual visual check described in commit message — admin step
4. `npm run tauri:build` — Full Tauri bundle (High approval)
5. Smoke test description provided to admin

If any check fails:
- AURA logs the error to memory repo (pending approval)
- Looks up ai-build-memory for matching error (Safe)
- Proposes fix + re-runs from step 1
- Does NOT retry automatically more than 3 times without admin input

---

## Memory Workflow (in self-build context)

1. Before starting a task: check `ai-build-memory/index/error-index.json` (Safe)
2. Check `ai-build-memory/index/quick-fix-map.md` (Safe)
3. If a known error is hit and fixed: create a memory entry (High approval)
4. If a new reusable pattern is discovered: create/update memory entry (High approval)
5. Run `rebuild_index.py` after memory write (Moderate approval)

Memory entries for self-build are tagged with `scope-self-build` and the relevant phase.

---

## Rollback Workflow

If a build or push fails and the branch is in a bad state:

1. AURA shows the diff of what changed (Safe)
2. Admin chooses: continue, revert, or abandon
3. `git checkout -- <file>` to revert specific files (Moderate approval)
4. `git reset --hard HEAD~1` — only with explicit admin instruction (Critical)
5. Branch deletion: `git branch -D <branch>` — only with explicit admin instruction (Critical)

---

## Agent Routing Workflow (self-build tasks)

For self-build tasks, the routing is:

```
Admin request / AURA proposal
  → Task analysis: complexity + risk classification
  → Route selection:
      Simple edits → Claude (this session, direct editing)
      Build validation → Claude (runs shell commands)
      Architecture decisions → Claude Architect (reasoning)
      Future: route to Codex for heavy refactoring (Phase 3)
  → Execute with appropriate permission class
  → Report result to admin
```

---

## UI Placeholders (Phase 2G)

A "Operational Readiness" section in Dashboard surfaces the capability status:

| Capability | Status |
|---|---|
| Memory workflow | Active |
| Approval gates | Active |
| Voice runtime event bus | Active |
| Provider registry | Active (Phase 2G) |
| Safe command runner | Planned |
| Git branch automation | Planned |
| Agent router | Planned |
| Workspace controller | Planned |

---

## Implementation Plan (Phase 2J)

1. **WorkspaceController service** — wraps all file/git/build actions behind permission checks
2. **CommandRiskClassifier** — classifies any command as Safe/Moderate/High/Critical
3. **SelfBuildApprovalQueue** — extends VoiceRuntimeService with self-build approval events
4. **GitAutomationService** — creates branches, commits, pushes (all behind High approval gate)
5. **ValidationRunner** — runs lint/build in sequence, reports results
6. **SelfBuildMemoryBridge** — auto-creates memory entries from self-build outcomes
7. **AdminReviewPanel** — UI for reviewing proposed diffs before execution

---

*Self-build architecture — Phase 2G design document*
