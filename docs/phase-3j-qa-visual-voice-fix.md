# Phase 3J QA — Visual + Voice Fix

Date: 2026-05-31
Branch: `phase-3j-qa-visual-voice-fix` (cut from Phase 3J tip `544b456`)
Agent: Claude (Anthropic / claude-opus-4-8), role: repair/build

## Milestone 1 — Why the user saw no UI change

### Root cause: version-number + installer-filename collision (ERR-0016 family)

The Phase 3J UI code is real, compiles, builds, and is correctly mounted (see
"Routes" below). The user did **not** see it because the build they installed was
**not** the Phase 3J build, and there was **no way to tell** because the installer
filename was identical.

Evidence:

| Question | Finding |
|---|---|
| Is Phase 3J (`544b456`) merged to `main`? | **No.** `main` HEAD is `d71b0c7 Phase 3I`. `git merge-base --is-ancestor 544b456 main` → false. 3J exists only on `phase-3j-operator-ui-ux-refinement` (local + origin). |
| What branch did the user likely install from? | The **main repo** (`agent-command-center`), which is where every prior release (0.1.0 → 0.5.0) was bundled. Its `0.5.0` installer was built **2026-05-31 04:31** from Phase 3I/3H code. The 3J worktree produced a *separate* `0.5.0` installer at **06:01**. |
| Was the installer filename reused? | **Yes.** Tauri names the installer from the numeric `version` in `tauri.conf.json`. Both `main` and the 3J branch were `0.5.0`, so **both** produce `AURA Command Center_0.5.0_x64-setup.exe` — byte-different, name-identical. |
| Did appVersion / package / tauri versions match? | Numeric versions matched (`0.5.0` everywhere on both branches). Only the internal `APP_PHASE` string differed: `main` = "Phase 3H / Runtime Nervous System"; 3J = "Phase 3J / Operator UI/UX Refinement". The numeric collision is what drove the filename collision. |
| Could the installer output path point at an older 0.5.0 build? | **Yes.** Two bundle dirs hold a `..._0.5.0_x64-setup.exe`: `agent-command-center/src-tauri/.../bundle/` (the canonical/history location, 04:31, pre-3J) and `agent-command-center-phase-3j/src-tauri/.../bundle/` (06:01, 3J). Installing the canonical one yields the pre-3J UI. |

### Routes — is Phase 3J actually mounted? (verified in code)

Yes. The Phase 3J components are wired correctly:

- **Console route** (`/`, `App.tsx` `<Route index element={<Console />}>`):
  `Console.tsx` renders the revised `AuraCommandConsole` (compact composer, status
  row, `LivingVisualCanvas`) and a page-owned `OperatorRightPanel`.
- **Voice Core** (default mode of `Console.tsx`): renders the revised `AuraVoiceCore`
  + page-owned `OperatorRightPanel`.
- **Right panel is not double-rendered / not hidden incorrectly:** `Layout.tsx` uses
  `pageOwnsRightPanel = location.pathname === '/'` and skips the global panel only on
  `/` (where Console renders its own). On every other route the global panel renders.
  Net result: exactly **one** `OperatorRightPanel`, never zero, never two.
- Caveat (addressed in M2/M3): the panel is gated behind the `xl:` breakpoint
  (`hidden ... xl:flex`), so on sub-1280px windows it collapses entirely. The tab/icon
  rail is the discoverable entry point; M2 ensures it is reachable.

Conclusion: this was a **delivery/identity** failure, not a code-mounting failure.

### Fix applied (M6)

- Bumped to **0.5.1** in `tauri.conf.json`, `package.json`, `src-tauri/Cargo.toml`,
  `src/lib/appVersion.ts`, `README.md`, `aura.capabilities.json`. The installer is now
  `AURA Command Center_0.5.1_x64-setup.exe` — unambiguous vs the two 0.5.0 files.
- Added an **in-app build marker**: `vite.config.ts` injects the commit short SHA,
  branch, and build time at build; `appVersion.ts` exposes `BUILD_SHA / BUILD_BRANCH /
  BUILD_TIME / BUILD_MARKER`; the **Details** tab of `OperatorRightPanel` shows a Build
  card (version, phase, label, commit, branch, built-at). TopBar shows `v0.5.1 / Phase
  3J QA · Visual + Voice Fix`.

Acceptance: opening the installed app and reading the TopBar or Details → Build card now
tells the user exactly which build (and commit) is running.
