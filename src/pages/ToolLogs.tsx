/**
 * Activity Log page.
 *
 * Previously this page rendered seeded mock tool calls behind a DataSourceNotice — it
 * showed something that looked like an audit trail but was not one. It now renders the
 * real event log: every click, microphone open, transcription, model call, tool run and
 * error, written to disk as it happens.
 */

import { EventLogView } from '../components/logging/EventLogView';

export function ToolLogs() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 flex flex-col h-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Activity Log</h1>
        <p className="text-zinc-400 text-sm">
          Everything AURA does, in order, saved to disk. Use this to work out what happened
          when something goes wrong.
        </p>
      </div>

      <EventLogView />
    </div>
  );
}
