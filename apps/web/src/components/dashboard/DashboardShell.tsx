"use client";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div
        className="transition-all duration-200"
        style={{ marginLeft: collapsed ? 72 : 260 }}
      >
        <TopNav />
        <main className="p-6 max-w-6xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
