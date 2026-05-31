import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
