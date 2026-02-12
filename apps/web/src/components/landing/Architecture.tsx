import { Card } from "@/components/ui/Card";

const layers = [
  { name: "Frontend", tech: "NextJS 15 + Tailwind", items: ["Landing Page", "Dashboard", "Vault Manager", "Agent Chat"] },
  { name: "Backend", tech: "Express + TypeScript", items: ["REST API", "x402 Facilitator", "AI Engine", "Rebalancer"] },
  { name: "Contracts", tech: "Soroban (Rust)", items: ["VaultFactory", "UserVault", "AgentRegistry"] },
  { name: "DeFi", tech: "Blend + Soroswap", items: ["Lending Pools", "AMM DEX", "RWA Yields", "Auto-Compound"] },
];

export function Architecture() {
  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold mb-12">Architecture</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {layers.map(l => (
            <Card key={l.name}>
              <h3 className="font-semibold text-indigo-400">{l.name}</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-3">{l.tech}</p>
              <ul className="space-y-1">
                {l.items.map(item => (
                  <li key={item} className="text-sm text-[var(--text-secondary)]">• {item}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
