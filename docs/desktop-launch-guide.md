# AURA Command Center — Desktop Launch Guide

**Branch:** `phase-2e-aura-operator-ux-redesign`

---

## The Problem: "localhost refused to connect"

If you pinned AURA to the Windows taskbar and later opened it to see this:

> **ERR_CONNECTION_REFUSED — localhost refused to connect**

You pinned the **dev-mode binary**, not the installed production app.

### Why this happens

`npm run tauri:dev` produces a temporary `app.exe` under `src-tauri/target/debug/`.
That binary **always loads from a Vite dev server** at `http://localhost:1420` (or `3000`).

When the dev server is not running, the window has nothing to load — hence the error.

---

## Two Ways to Run AURA

| Mode | Command | Frontend source | Requires dev server? |
|---|---|---|---|
| **Development** | `npm run tauri:dev` | `http://localhost:1420` | ✅ Yes |
| **Production** | Install the `.exe` / `.msi` | Embedded in the binary | ❌ No |

---

## How to Install the Production App

### Step 1 — Run the NSIS installer

```
src-tauri\target\release\bundle\nsis\AURA Command Center_0.1.0_x64-setup.exe
```

Double-click it. Windows may show a **SmartScreen / UAC prompt** — click
**"More info" → "Run anyway"** (or "Yes" on the UAC dialog).

The wizard installs AURA to `%LOCALAPPDATA%\Programs\AURA Command Center\`.

> **Alternative:** Use the MSI installer for enterprise/GPO deployment:
> ```
> src-tauri\target\release\bundle\msi\AURA Command Center_0.1.0_x64_en-US.msi
> ```

### Step 2 — Unpin the old taskbar shortcut

Right-click the broken taskbar icon → **Unpin from taskbar**.

### Step 3 — Pin the installed app

After installation, find **AURA Command Center** in the Start Menu.
Right-click → **Pin to taskbar**.

Now clicking it will always open the self-contained production app — no dev server required.

---

## Building a Fresh Production Installer

Run these commands whenever you want a new production build:

```powershell
# 1. Load MSVC environment (required for Rust/link.exe)
$vsDevCmd = "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
$rawEnv = cmd /c "`"$vsDevCmd`" -arch=x64 > nul 2>&1 && set"
foreach ($line in $rawEnv) {
    if ($line -match '^([^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}
$env:PATH = "C:\Users\karim\.cargo\bin;" + $env:PATH

# 2. Navigate to project root
Set-Location "C:\Users\karim\Documents\AURA\agent-command-center"

# 3. Build (Vite + Rust + bundler — takes ~3 minutes)
npm run tauri:build
```

Output locations after a successful build:

| Format | Path |
|---|---|
| NSIS installer | `src-tauri/target/release/bundle/nsis/AURA Command Center_0.1.0_x64-setup.exe` |
| MSI package | `src-tauri/target/release/bundle/msi/AURA Command Center_0.1.0_x64_en-US.msi` |
| Standalone EXE | `src-tauri/target/release/app.exe` |

> **Note:** `src-tauri/target/release/app.exe` is the production binary and can be run
> directly without installing. It embeds all frontend assets — no Vite server needed.

---

## Tauri Configuration

The production vs dev split is controlled by `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "frontendDist": "../dist",       ← production: embeds Vite output folder
    "devUrl": "http://localhost:3000" ← dev only: Tauri reads this in tauri dev mode
  }
}
```

In a production build, Tauri completely ignores `devUrl` and bundles everything from
`../dist` into the binary. The binary is fully self-contained.

---

## Quick Reference

```
Development workflow:
  npm run tauri:dev      → starts Vite + Tauri dev window (localhost only)

Production workflow:
  npm run tauri:build    → builds Vite → compiles Rust → creates installer
  Run the NSIS .exe      → installs to %LOCALAPPDATA%\Programs\
  Launch from Start Menu → no terminal, no server, works offline
```
