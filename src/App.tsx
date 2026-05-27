/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Agents } from './pages/Agents';
import { Console } from './pages/Console';
import { Memory } from './pages/Memory';
import { Handoffs } from './pages/Handoffs';
import { Connectors } from './pages/Connectors';
import { ToolLogs } from './pages/ToolLogs';
import { Settings } from './pages/Settings';
import { Relay } from './pages/Relay';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Console />} />
          <Route path="console" element={<Navigate to="/" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="agents" element={<Agents />} />
          <Route path="memory" element={<Memory />} />
          <Route path="handoffs" element={<Handoffs />} />
          <Route path="connectors" element={<Connectors />} />
          <Route path="logs" element={<ToolLogs />} />
          <Route path="settings" element={<Settings />} />
          <Route path="relay" element={<Relay />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
