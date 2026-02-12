"use client";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-32">
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 to-transparent" />
      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <Badge variant="info">Built for SDF Issue #633</Badge>
        <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-7xl">
          Give Your AI Agents{" "}
          <span className="gradient-text">a Wallet</span>
          {" "}on Stellar
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)]">
          Smart vaults with delegated spending controls. Agents pay for services autonomously
          using the x402 protocol while you stay in control of your funds.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/app">
            <Button size="lg">Launch App</Button>
          </Link>
          <Link href="#how-it-works">
            <Button variant="outline" size="lg">How It Works</Button>
          </Link>
        </div>
        <div className="mt-16 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/50 p-8 backdrop-blur">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-indigo-400">$0.01</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">Per AI Query (USDC)</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-indigo-400">24h</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">Rolling Spend Limits</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-indigo-400">100%</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">On-Chain Enforcement</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
