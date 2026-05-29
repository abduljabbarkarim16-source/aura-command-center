/**
 * MakeBlueprintService — AURA Milestone 9
 *
 * Provides pre-configured JSON blueprint exports for Make.com.
 * Users can import these into Make.com to instantly set up AURA webhooks.
 */

export class MakeBlueprintService {
  /**
   * Generates a standard AURA Core Notification Blueprint for Make.com.
   * This scenario listens for AURA webhooks and routes them.
   */
  exportAuraCoreBlueprint(): string {
    const blueprint = {
      name: "AURA Core Event Router",
      flow: [
        {
          id: 1,
          module: "gateway:CustomWebHook",
          version: 1,
          parameters: {
            hook: "AURA_CORE_WEBHOOK"
          },
          mapper: {},
          metadata: {
            designer: { x: 0, y: 0 },
            name: "AURA Webhook Receiver"
          }
        },
        {
          id: 2,
          module: "builtin:BasicRouter",
          version: 1,
          parameters: {},
          mapper: {},
          metadata: {
            designer: { x: 300, y: 0 },
            name: "Event Type Router"
          }
        }
      ],
      metadata: {
        version: 1,
        scenario: {
          roundtrips: 1,
          maxErrors: 3,
          autoCommit: true,
          autoCommitTriggerLast: true,
          sequential: false,
          confidential: false,
          dataloss: false,
          dlq: false
        }
      }
    };

    return JSON.stringify(blueprint, null, 2);
  }

  downloadBlueprint(filename: string = 'aura-make-blueprint.json') {
    const data = this.exportAuraCoreBlueprint();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const makeBlueprintService = new MakeBlueprintService();
