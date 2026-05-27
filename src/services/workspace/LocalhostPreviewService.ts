import { WorkspaceRunner } from '../../types/workspace';
import { mockWorkspaceRunner } from '../../mock/workspaces';

class LocalhostPreviewService {
  getPreviewUrl(): string {
    return mockWorkspaceRunner.previewUrl;
  }

  refreshPreview(): void {
    console.log('Mock: Refreshing iframe/browser preview...');
  }

  captureScreenshot(): string {
    console.log('Mock: Capturing screenshot...');
    return 'screenshot_mock_url.png';
  }

  getBrowserLogs(): string[] {
    return [
      'Warning: React requires className instead of class',
      'Info: HMR connected'
    ];
  }
}

export const localhostPreviewService = new LocalhostPreviewService();
