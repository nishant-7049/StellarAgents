"use client";
import { motion } from "framer-motion";
import { TrendingUp, Zap, Bot } from "lucide-react";
import { staggerContainer, fadeInUp } from "@/lib/motion";

const features = [
  {
    icon: Bot,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    badge: "ERC-8004 standard",
    badgeBg: "bg-blue-50 text-blue-600",
    title: "ERC-8004 Agent Explorer",
    description:
      "A searchable on-chain registry of AI agents built on the ERC-8004 identity standard, adapted for Stellar/Soroban. Every registered agent is a Soroban NFT with a sequential ID, immutable owner address, mutable capabilities list, USDC pricing, model version, and vault address — all readable by any protocol or frontend without permission.",
    detail:
      "Capabilities are published as strings (e.g. 'yield-optimizer', 'rebalancer', 'data-fetcher'). The Explorer UI lets you filter by capability, sort by rating or fees, and view per-agent stats. Ownership is immutable; metadata is mutable — preventing impersonation while allowing capability upgrades.",
  },
  {
    icon: Zap,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    badge: "0.01 USDC / query",
    badgeBg: "bg-violet-50 text-violet-600",
    title: "x402 Payments + Smart Vault",
    description:
      "Gate any API behind USDC micropayments with a single HTTP header using x402-stellar. Agents pay autonomously — no wallet popups, no approvals. Pair with the vault SDK to deploy Soroban smart vaults with per-agent daily spending caps, destination whitelists, and instant revocation enforced on-chain.",
    detail:
      "The x402 protocol sends a signed Soroban auth entry inside an HTTP header. The facilitator verifies and submits vault.agent_pay() on-chain. Vault policies are enforced entirely by Rust smart contracts — no off-chain override possible.",
  },
  {
    icon: TrendingUp,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    badge: "12.6% avg APY",
    badgeBg: "bg-emerald-50 text-emerald-600",
    title: "defi-agent SDK",
    description:
      "Connect to Blend Protocol lending pools, Soroswap AMM, and Ondo USDY in minutes. The SDK fetches live APY data from DeFiLlama, sends it to Claude for risk-adjusted allocation, and executes the rebalance — paying for its own AI compute via x402 automatically.",
    detail:
      "Rebalances trigger only when APY improvement ≥0.5%, preventing unnecessary gas costs. Every action returns a txHash verifiable on Stellar Explorer. Strategies are parameterized by risk tolerance: low / moderate / high.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 px-6 bg-[var(--bg0)]">
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-[12px] font-semibold uppercase tracking-widest text-[var(--accent)]">
            Three Core Products
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
            Built for agents that act, pay, and earn on-chain.
          </h2>
          <p className="mt-4 text-[16px] text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            An identity standard, a payment protocol, and a DeFi toolkit — the complete stack
            for autonomous AI agents on Stellar.
          </p>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid gap-5 md:grid-cols-2"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeInUp}
              className={`rounded-2xl bg-white border border-[var(--border)] p-6 shadow-sm hover:shadow-md transition-shadow${i === 0 ? " md:col-span-2" : ""}`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className={`w-11 h-11 rounded-xl ${f.iconBg} flex items-center justify-center flex-shrink-0`}
                >
                  <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Title + badge */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="font-semibold text-[var(--text-primary)] text-[15px]">{f.title}</h3>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${f.badgeBg}`}>
                      {f.badge}
                    </span>
                  </div>
                  {/* Description */}
                  <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-3">
                    {f.description}
                  </p>
                  {/* Technical detail */}
                  <p className="text-[12px] text-[var(--text-muted)] leading-relaxed pl-3 border-l-2 border-[var(--border)]">
                    {f.detail}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
