import { WorkspaceRunner } from '../../types/workspace';
import { mockWorkspaceRunner } from '../../mock/workspaces';

class WorkspaceRunnerService {
  private runner: WorkspaceRunner = mockWorkspaceRunner;

  getRunnerState(): WorkspaceRunner {
    return this.runner;
  }

  async startDevServer(): Promise<void> {
    console.log('Mock: Starting dev server...', this.runner.devCommand);
    this.runner.status = 'starting';
    // simulate delay
    setTimeout(() => {
      this.runner.status = 'running';
      this.runner.terminalLogs.push('> Mock server started at ' + this.runner.previewUrl);
    }, 1000);
  }

  async stopDevServer(): Promise<void> {
    console.log('Mock: Stopping dev server...');
    this.runner.status = 'stopped';
    this.runner.terminalLogs.push('> Mock server stopped.');
  }

  async runCommand(cmd: string): Promise<void> {
    console.log(`Mock: Executing ${cmd}`);
    this.runner.terminalLogs.push(`> ${cmd}`);
    this.runner.terminalLogs.push(`Execution simulated.`);
  }
}

export const workspaceRunnerService = new WorkspaceRunnerService();
