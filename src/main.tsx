import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { eventLog } from './services/logging/EventLogService';

// Start the event log before anything else renders, so a fault during boot is still
// recorded. Attaching here rather than inside a component also means the capture
// listeners survive StrictMode's double-mount without being registered twice.
eventLog.attachGlobalCapture();
eventLog.info('app', 'boot', { href: window.location.href });

// Run the post-reinstall system check on every startup.
// Fire-and-forget — does not block rendering.
import('./services/system/UpgradeService')
  .then(({ upgradeService }) => upgradeService.runStartupCheck())
  .then(result => {
    if (result.isNewVersion) {
      console.info('[AURA] Version upgrade detected:', result);
    }
  })
  .catch(() => { /* non-critical */ });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
