import { RouterConfig } from '../types/router';

export const mockRouterConfig: RouterConfig = {
  defaultAgentId: 'agent-codex',
  maxRetries: 3,
  rules: [
    {
      taskType: 'architecture_and_planning',
      preferredAgentId: 'agent-claude',
      fallbackAgentId: 'agent-gemini',
      description: 'UI architecture, project planning, and initial layout design tasks route to Claude.'
    },
    {
      taskType: 'code_implementation',
      preferredAgentId: 'agent-codex',
      fallbackAgentId: 'agent-claude',
      description: 'Implementation, logic refactoring, and code editing tasks route to Codex/OpenAI.'
    },
    {
      taskType: 'browser_verification',
      preferredAgentId: 'agent-gemini',
      description: 'Browser verification, DOM inspection, and Playwright scripts route to Antigravity/Gemini.'
    },
    {
      taskType: 'summary_and_logging',
      preferredAgentId: 'agent-codex', // Imagine default/cheaper model
      description: 'Summaries, handoff generation, and tool logging route to a default cheaper model.'
    }
  ]
};
