/**
 * useWorkspaceController — AURA Milestone B
 *
 * Reactive hook for workspace controller state.
 * Triggers re-render when the workspace list or active workspace changes.
 */

import { useEffect, useState, useCallback } from 'react';
import { workspaceController } from '../services/workspace/WorkspaceControllerService';
import type { WorkspaceRecord, WorkspaceScanResult } from '../types/workspace-controller';

export interface UseWorkspaceControllerResult {
  workspaces: WorkspaceRecord[];
  activeWorkspace: WorkspaceRecord | null;
  lastScan: WorkspaceScanResult | null;
  isScanning: boolean;
  scan: (id?: string) => Promise<void>;
  setActive: (id: string) => void;
}

export function useWorkspaceController(): UseWorkspaceControllerResult {
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>(
    workspaceController.listWorkspaces(),
  );
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRecord | null>(
    workspaceController.getActiveWorkspace(),
  );
  const [lastScan, setLastScan] = useState<WorkspaceScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    return workspaceController.subscribe(() => {
      setWorkspaces(workspaceController.listWorkspaces());
      setActiveWorkspace(workspaceController.getActiveWorkspace());
    });
  }, []);

  const scan = useCallback(async (id?: string) => {
    const targetId = id ?? activeWorkspace?.id;
    if (!targetId) return;
    setIsScanning(true);
    try {
      const result = await workspaceController.scanWorkspace(targetId);
      setLastScan(result);
    } finally {
      setIsScanning(false);
    }
  }, [activeWorkspace?.id]);

  const setActive = useCallback((id: string) => {
    workspaceController.setActiveWorkspace(id);
  }, []);

  return { workspaces, activeWorkspace, lastScan, isScanning, scan, setActive };
}
