import { Artifact } from '../types/artifacts';

export const mockArtifacts: Artifact[] = [
  {
    id: 'art-1',
    type: 'preview_link',
    title: 'Workspace Dev Server preview',
    projectId: 'proj-1',
    workspaceId: 'ws-1',
    sourceAgentId: 'agent-claude',
    createdAt: new Date().toISOString(),
    content: 'http://localhost:5173',
    metadata: { port: 5173 }
  },
  {
    id: 'art-2',
    type: 'file_diff',
    title: 'Component Structure Changes in src/App.tsx',
    projectId: 'proj-1',
    workspaceId: 'ws-1',
    sourceAgentId: 'agent-codex',
    createdAt: new Date(Date.now() - 120000).toISOString(),
    content: '--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1,5 +1,6 @@\n+import { Layout } from "./Layout";\n // ...'
  },
  {
    id: 'art-3',
    type: 'browser_console_log',
    title: 'Browser Runtime Warning',
    projectId: 'proj-1',
    workspaceId: 'ws-1',
    sourceAgentId: 'system',
    createdAt: new Date().toISOString(),
    content: 'Warning: Invalid DOM property `class`. Did you mean `className`? \n    in div (created by App)'
  }
];
