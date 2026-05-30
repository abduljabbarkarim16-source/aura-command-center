import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './operator/CommandPalette';
import { OperatorRightPanel } from './operator/OperatorRightPanel';

export function Layout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden selection:bg-indigo-500/30">
      <CommandPalette />

      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col h-screen min-w-0 bg-zinc-950/50">
        <TopBar />
        <div className="flex-1 flex min-h-0">
          <main className="flex-1 overflow-y-auto min-h-0 relative">
            <Outlet />
          </main>
          {/* Right operator panel — collapsible, wired to notification/transcript services */}
          <div className="relative shrink-0 flex">
            <OperatorRightPanel width={260} defaultOpen={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
