import { notificationService } from '../notifications/NotificationService';
import { openAIVoiceSessionService } from '../voice/OpenAIVoiceSessionService';
import { runtimeTaskService, type RuntimeTaskEvent } from './RuntimeTaskService';

class RuntimeTaskNotificationBridgeImpl {
  private unsubscribe: (() => void) | null = null;
  private lastNotifiedTaskId: string | null = null;
  private lastNotificationTime = 0;

  start() {
    if (this.unsubscribe) return;
    this.unsubscribe = runtimeTaskService.subscribe(this.handleEvent.bind(this));
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private handleEvent(event: RuntimeTaskEvent) {
    const { task, type } = event;
    const now = Date.now();

    // Deduplicate rapid noisy events for the same task
    if (this.lastNotifiedTaskId === task.id && (now - this.lastNotificationTime) < 500) {
      // Allow completion/failure events to always go through, but throttle start/block
      if (type !== 'task_completed' && type !== 'task_failed') {
        return;
      }
    }

    switch (type) {
      case 'task_started':
        // Optional: you could make this silent or use a lower TTL
        break;
      case 'task_completed': {
        notificationService.add({
          type: 'task_completed',
          title: `Task completed: ${task.title}`,
          message: task.summary || (task.elapsedMs ? `Completed in ${task.elapsedMs}ms` : undefined),
          ttl: 4000,
        });
        this.updateThrottle(task.id, now);
        
        // Voice callback
        const successText = task.summary || `Task ${task.title} has finished.`;
        openAIVoiceSessionService.synthesizeSpeech(successText).then(res => {
           if (res.success && res.audioBlobUrl) {
              const audio = new Audio(res.audioBlobUrl);
              audio.onended = () => URL.revokeObjectURL(res.audioBlobUrl!);
              audio.play().catch(e => console.warn('Could not play voice callback', e));
           }
        });
        break;
      }
      
      case 'task_failed': {
        notificationService.add({
          type: 'task_failed',
          title: `Task failed: ${task.title}`,
          message: task.error || 'Unknown error occurred.',
          ttl: 8000,
        });
        this.updateThrottle(task.id, now);

        // Voice callback
        const errorText = `Task ${task.title} has failed. ${task.error || ''}`;
        openAIVoiceSessionService.synthesizeSpeech(errorText).then(res => {
           if (res.success && res.audioBlobUrl) {
              const audio = new Audio(res.audioBlobUrl);
              audio.onended = () => URL.revokeObjectURL(res.audioBlobUrl!);
              audio.play().catch(e => console.warn('Could not play voice callback', e));
           }
        });
        break;
      }

      case 'task_blocked':
        notificationService.add({
          type: 'task_blocked',
          title: `Task blocked: ${task.title}`,
          message: task.error || 'Awaiting approval or input.',
          ttl: 8000, // keep longer so user sees it
        });
        this.updateThrottle(task.id, now);
        break;

      case 'task_created':
      case 'task_cancelled':
      case 'task_log_appended':
        // Intentionally silent for these to avoid spam
        break;
    }
  }

  private updateThrottle(taskId: string, time: number) {
    this.lastNotifiedTaskId = taskId;
    this.lastNotificationTime = time;
  }
}

export const runtimeTaskNotificationBridge = new RuntimeTaskNotificationBridgeImpl();
// Auto-start the bridge
runtimeTaskNotificationBridge.start();
