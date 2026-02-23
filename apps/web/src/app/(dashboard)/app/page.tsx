"use client";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-[var(--text-secondary)]">Overview of your AgentNet activity</p>
      </div>
      <StatsCards />
      <div className="grid gap-4 md:grid-cols-2">
        <Card glow>
          <h3 className="font-semibold mb-2">Quick Actions</h3>
          <div className="flex flex-col gap-2">
            <Link href="/app/vault"><Button variant="outline" className="w-full">Create Vault</Button></Link>
            <Link href="/app/chat"><Button variant="outline" className="w-full">Query Yield Agent</Button></Link>
            <Link href="/app/register"><Button variant="outline" className="w-full">Register Agent</Button></Link>
          </div>
        </Card>
        <Card glow>
          <h3 className="font-semibold mb-2">Recent Activity</h3>
          <p className="text-sm text-[var(--text-secondary)]">No transactions yet. Create a vault and start using agents.</p>
        </Card>
      </div>
    </div>
  );
}
