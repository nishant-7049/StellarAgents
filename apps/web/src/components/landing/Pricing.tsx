import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function Pricing() {
  return (
    <section className="py-20 px-6 bg-[var(--bg-secondary)]">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold mb-4">Transparent Pricing</h2>
        <p className="text-[var(--text-secondary)] mb-8">Pay per query. No subscriptions. No hidden fees.</p>
        <Card glow className="text-left">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">AI Yield Query</h3>
            <Badge variant="success">x402</Badge>
          </div>
          <div className="text-4xl font-bold text-indigo-400 mb-2">0.01 USDC</div>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Per query, paid automatically by your agent via vault</p>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            <li>• Real-time Blend + Soroswap pool analysis</li>
            <li>• AI-generated allocation strategy (Claude Sonnet 4.5)</li>
            <li>• Risk-adjusted recommendations (low/moderate/high)</li>
            <li>• Auto-rebalancing trigger</li>
          </ul>
        </Card>
      </div>
    </section>
  );
}
