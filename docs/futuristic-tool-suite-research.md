# Futuristic Tool Suite Research

## Overview
Phase 3H introduced the Runtime Nervous System, allowing AURA to track tasks visibly, learn recipes, and intelligently route simple requests to local models. The next frontier involves giving AURA a suite of "futuristic" capabilities that bridge the gap between an internal OS and a real-world operator.

## Push Notifications & Real-World Alerts
- **ntfy.sh**: Best free, open-source push notification system. AURA can `curl` a topic URL to send instant push notifications to the user's phone for critical blocked tasks.
- **Pushover / Pushbullet**: Commercial alternatives for high-reliability mobile alerts.
- **Twilio / WhatsApp**: For conversational handoffs. If AURA needs approval on a dangerous recipe while the user is away from the desktop, it could text the user.

## Browser Automation
- **Playwright**: Heavy but robust. Useful for extracting complex data from JS-heavy sites.
- **Stagehand / browser-use**: LLM-native browser controllers. These frameworks map DOM trees into token-efficient representations so AURA can click and type natively without brittle CSS selectors.

## Local Automation
- **AutoHotkey (Windows)**: For deep OS-level GUI macro recording and playback.
- **PowerShell / Task Scheduler**: For creating true cron jobs that run even when AURA's frontend is closed, perhaps via the Tauri Rust backend running as a service.

## Visual Canvas Upgrades
- **Mermaid.js**: Currently supported for architecture, but can be rendered dynamically in the `LivingVisualCanvas`.
- **Excalidraw / Tldraw**: Embedding a whiteboard where AURA can "draw" its thoughts in real-time.

## Conclusion
The path forward is to build specific `Tool` wrappers for `ntfy.sh` (phone alerts) and `Stagehand` (browser control), bringing them under the `RuntimeTaskService` umbrella so their execution is fully visible and interruptible.
