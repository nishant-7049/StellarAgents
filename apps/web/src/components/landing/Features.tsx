import { Card } from "@/components/ui/Card";

const features = [
  {
    title: "Smart Vaults",
    description: "Per-user Soroban C-accounts holding USDC with per-agent spending policies. Daily limits, destination whitelists, instant revocation.",
    icon: "🔐",
  },
  {
    title: "Agent Identity (ERC-8004)",
    description: "On-chain AI agent registry inspired by ERC-8004. Each agent is an NFT with capabilities, pricing, and verifiable identity.",
    icon: "🤖",
  },
  {
    title: "x402 Payments",
    description: "HTTP 402-based micropayments. Agents pay for services with a single header — no wallets, no popups, no friction.",
    icon: "💸",
  },
];

export function Features() {
  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold">Three Primitives, One Protocol</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map(f => (
            <Card key={f.title} glow>
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{f.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
