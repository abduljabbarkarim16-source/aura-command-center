import { WorkspaceSafetyConfig } from '../../types/workspace';
import { mockSafetyConfig } from '../../mock/workspaces';

class WorkspaceSafetyService {
  private config: WorkspaceSafetyConfig = mockSafetyConfig;

  getSafetyConfig(): WorkspaceSafetyConfig {
    return this.config;
  }

  isPathAllowed(filePath: string): boolean {
    if (this.config.blockedPaths.some(bp => filePath.includes(bp))) {
      return false;
    }
    return this.config.allowedFileScope.some(ap => filePath.includes(ap)) || this.config.allowedFileScope.length === 0;
  }

  requestApproval(actionType: string): boolean {
    console.log(`Mock: requesting approval for ${actionType}`);
    // Simulated approval check
    return true;
  }
}

export const workspaceSafetyService = new WorkspaceSafetyService();
