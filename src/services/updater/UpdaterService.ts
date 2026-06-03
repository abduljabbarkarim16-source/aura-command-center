/**
 * UpdaterService
 *
 * Orchestrates the Tauri live updater process.
 * Checks for updates, handles downloads, tracking progress, and app relaunches.
 */

import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'installing' | 'error';

export interface UpdaterState {
  status: UpdateStatus;
  currentVersion: string | null;
  newVersion: string | null;
  releaseNotes: string | null;
  progress: number;
  errorMsg: string | null;
}

export type UpdaterListener = (state: UpdaterState) => void;

class UpdaterServiceImpl {
  private state: UpdaterState = {
    status: 'idle',
    currentVersion: null,
    newVersion: null,
    releaseNotes: null,
    progress: 0,
    errorMsg: null,
  };
  private listeners: Set<UpdaterListener> = new Set();
  private updateContext: any = null; // Store the update object returned by check()

  subscribe(fn: UpdaterListener): () => void {
    this.listeners.add(fn);
    fn({ ...this.state });
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = { ...this.state };
    for (const fn of this.listeners) {
      fn(snap);
    }
  }

  private setState(patch: Partial<UpdaterState>) {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  async checkForUpdate(): Promise<void> {
    if (this.state.status === 'checking' || this.state.status === 'downloading' || this.state.status === 'installing') {
      return;
    }
    
    this.setState({ status: 'checking', errorMsg: null, progress: 0 });

    try {
      const update = await check();
      
      if (update?.available) {
        this.updateContext = update;
        this.setState({
          status: 'available',
          currentVersion: update.currentVersion,
          newVersion: update.version,
          releaseNotes: update.body || 'No release notes provided.',
        });
      } else {
        this.updateContext = null;
        this.setState({
          status: 'up-to-date',
          // Usually we don't have currentVersion easily unless it returns it anyway
          currentVersion: update?.currentVersion || null,
        });
      }
    } catch (err) {
      this.updateContext = null;
      this.setState({
        status: 'error',
        errorMsg: `Failed to check for updates: ${String(err)}`,
      });
    }
  }

  async downloadAndInstall(): Promise<void> {
    if (!this.updateContext || this.state.status !== 'available') {
      return;
    }

    this.setState({ status: 'downloading', progress: 0, errorMsg: null });

    try {
      let downloaded = 0;
      let contentLength = 0;

      await this.updateContext.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              const progress = Math.round((downloaded / contentLength) * 100);
              this.setState({ progress });
            }
            break;
          case 'Finished':
            this.setState({ status: 'installing' });
            break;
        }
      });

      // Once install is finished, we should restart the app.
      await relaunch();

    } catch (err) {
      this.setState({
        status: 'error',
        errorMsg: `Failed to install update: ${String(err)}`,
      });
    }
  }

  reset() {
    this.updateContext = null;
    this.setState({
      status: 'idle',
      currentVersion: null,
      newVersion: null,
      releaseNotes: null,
      progress: 0,
      errorMsg: null,
    });
  }
}

export const updaterService = new UpdaterServiceImpl();
