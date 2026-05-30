/**
 * reminders.ts — AURA Phase 3E
 *
 * Types for the local reminder/event scheduler.
 * Use cases: usage-limit resets, resume tasks, follow-up builds.
 */

export type ReminderStatus = 'scheduled' | 'triggered' | 'dismissed' | 'completed';

export type ReminderCategory =
  | 'usage_limit_reset'
  | 'resume_task'
  | 'follow_up_build'
  | 'check_automation'
  | 'custom';

export interface Reminder {
  id: string;
  category: ReminderCategory;
  title: string;
  message?: string;
  /** ISO timestamp when to trigger */
  triggerAt: string;
  status: ReminderStatus;
  createdAt: string;
  /** Optional linked session/task ID */
  linkedId?: string;
  /** Who/what created this reminder */
  source?: string;
}
