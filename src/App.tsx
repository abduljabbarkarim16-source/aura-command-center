/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 2G: All page imports are lazy (React.lazy) to enable route-based
 * code-splitting. This reduces the initial JS bundle from ~542 KB to ~200 KB
 * gzip. Each route chunk is loaded on first navigation to that route.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';

// ─── Lazy page imports ────────────────────────────────────────────────────────
// Each named export is wrapped so React.lazy receives a default export.

const Console    = lazy(() => import('./pages/Console').then(m    => ({ default: m.Console })));
const Dashboard  = lazy(() => import('./pages/Dashboard').then(m  => ({ default: m.Dashboard })));
const Projects   = lazy(() => import('./pages/Projects').then(m   => ({ default: m.Projects })));
const Agents     = lazy(() => import('./pages/Agents').then(m     => ({ default: m.Agents })));
const Memory     = lazy(() => import('./pages/Memory').then(m     => ({ default: m.Memory })));
const Handoffs   = lazy(() => import('./pages/Handoffs').then(m   => ({ default: m.Handoffs })));
const Connectors = lazy(() => import('./pages/Connectors').then(m => ({ default: m.Connectors })));
const ToolLogs   = lazy(() => import('./pages/ToolLogs').then(m   => ({ default: m.ToolLogs })));
const Settings   = lazy(() => import('./pages/Settings').then(m   => ({ default: m.Settings })));
const Relay      = lazy(() => import('./pages/Relay').then(m      => ({ default: m.Relay })));

// ─── Suspense fallback ────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin opacity-60" />
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Console />} />
            <Route path="console"    element={<Navigate to="/" replace />} />
            <Route path="dashboard"  element={<Dashboard />} />
            <Route path="projects"   element={<Projects />} />
            <Route path="agents"     element={<Agents />} />
            <Route path="memory"     element={<Memory />} />
            <Route path="handoffs"   element={<Handoffs />} />
            <Route path="connectors" element={<Connectors />} />
            <Route path="logs"       element={<ToolLogs />} />
            <Route path="settings"   element={<Settings />} />
            <Route path="relay"      element={<Relay />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
