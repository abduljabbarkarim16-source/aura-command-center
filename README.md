# AURA Command Center

AURA Command Center is a desktop application providing an Agentic Unified Routing Assistant.

## Phase 2A: Tauri Desktop Shell Integration

> [!IMPORTANT]
> **Mock-Only Phase:** This phase introduces the Tauri desktop architecture shell but remains strictly mock-only. 
> - No real provider APIs are connected (no API keys required).
> - No real native command execution yet.
> - No real MCP execution yet.
> - No real microphone access yet.

### Development Modes

**1. Web Dev Mode**
Run the fast Vite web-only server for UI iteration.
```bash
npm run dev
```

**2. Desktop Dev Mode**
Launch the actual Tauri desktop application linked to the Vite dev server. This requires Rust and standard Tauri dependencies.
```bash
npm run tauri:dev
```

### Production Builds

**1. Production Web Build**
Build the frontend assets alone.
```bash
npm run build
```

**2. Production Desktop Build**
Compile the native application installers and binaries.
```bash
npm run tauri:build
```
