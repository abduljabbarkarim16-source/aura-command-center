import { useState, useCallback } from 'react';

type RunnerStatus = 'not_configured' | 'ready' | 'starting' | 'running' | 'failed' | 'stopped';

interface RunnerState {
  status: RunnerStatus;
  framework: string;
  previewUrl: string;
  logs: string[];
}

export function useWorkspaceRunner() {
  const [state, setState] = useState<RunnerState>({
    status: 'ready',
    framework: 'React + Vite',
    previewUrl: 'http://localhost:5173',
    logs: ['[vite] server ready in 250ms']
  });

  const appendTerminalLog = useCallback((log: string) => {
    setState(s => ({ ...s, logs: [...s.logs, log] }));
  }, []);

  const startDevServer = useCallback(() => {
    setState(s => ({ ...s, status: 'starting', logs: [...s.logs, 'Starting dev server...'] }));
    setTimeout(() => {
      setState(s => ({ ...s, status: 'running', logs: [...s.logs, `Server running at ${s.previewUrl}`] }));
    }, 1500);
  }, []);

  const stopDevServer = useCallback(() => {
    setState(s => ({ ...s, status: 'stopped', logs: [...s.logs, 'Server stopped by user.'] }));
  }, []);

  const restartDevServer = useCallback(() => {
    setState(s => ({ ...s, status: 'starting', logs: [...s.logs, 'Restarting server...'] }));
    setTimeout(() => {
      setState(s => ({ ...s, status: 'running', logs: [...s.logs, `Server running at ${s.previewUrl}`] }));
    }, 1500);
  }, []);

  const refreshPreview = useCallback(() => {
    appendTerminalLog('Refreshing preview frame...');
  }, [appendTerminalLog]);

  const captureScreenshot = useCallback(() => {
    appendTerminalLog('Captured screenshot artifact (mock).');
  }, [appendTerminalLog]);

  return {
    ...state,
    startDevServer,
    stopDevServer,
    restartDevServer,
    refreshPreview,
    captureScreenshot,
    appendTerminalLog
  };
}
