"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Zap, Bot, Shield } from "lucide-react";
import { staggerContainer, fadeInUp } from "@/lib/motion";

const perQueryIncludes = [
  "Real-time Blend + Soroswap + Ondo APY scan",
  "AI strategy from Claude (risk-adjusted allocation)",
  "Automatic rebalance trigger if APY improves ≥0.5%",
  "Transaction hash for every on-chain action",
  "Portfolio snapshot saved for 30-day history",
];

const vaultIncludes = [
  "Soroban smart vault deployed to Stellar",
  "Per-agent daily spending limits",
  "Destination whitelists & instant revocation",
  "Full transaction history on Stellar Explorer",
  "Non-custodial — only you can withdraw",
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6 bg-white">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-[12px] font-semibold uppercase tracking-widest text-[var(--accent)]">
            Pricing
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
            Pay Per Query. No Subscriptions.
          </h2>
          <p className="mt-4 text-[16px] text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            You only pay when your agent actually does something. No monthly fees, no hidden
            costs, no lock-in. Your agent earns far more than it costs to run.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-5 md:grid-cols-3"
        >
          {/* Card 1: Vault */}
          <motion.div
            variants={fadeInUp}
            className="rounded-2xl bg-[var(--bg0)] border border-[var(--border)] p-6 shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-[var(--text-primary)] text-[16px] mb-1">Smart Vault</h3>
            <div className="text-3xl font-bold text-[var(--text-primary)] mb-1">
              Free
            </div>
            <p className="text-[13px] text-[var(--text-muted)] mb-5">
              One-time Soroban contract deployment. Stellar transaction fees apply (~0.00001 XLM).
            </p>
            <ul className="space-y-2.5">
              {vaultIncludes.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-[var(--text-secondary)]">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Card 2: AI Query — highlighted */}
          <motion.div
            variants={fadeInUp}
            className="rounded-2xl bg-[var(--accent)] p-6 shadow-lg shadow-[var(--accent)]/20 relative md:-mt-3 md:-mb-3"
          >
            <div className="absolute top-4 right-4 text-[11px] font-semibold bg-white/20 text-white px-2.5 py-0.5 rounded-full">
              Most Used
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-white text-[16px] mb-1">AI Yield Query</h3>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-3xl font-bold text-white">0.01</span>
              <span className="text-[15px] font-semibold text-white/80 mb-1">USDC</span>
            </div>
            <p className="text-[13px] text-white/70 mb-5">
              Per query, paid automatically by your agent via x402 — no manual action needed.
            </p>
            <ul className="space-y-2.5">
              {perQueryIncludes.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-white/85">
                  <Check className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl bg-white/15 px-4 py-3 text-[12px] text-white/80">
              💡 At 12.6% APY on $100 USDC, your agent earns ~$0.035/day while paying ~$0.01 in query costs — a 3.5× return on operating costs.
            </div>
          </motion.div>

          {/* Card 3: Agent Registry */}
          <motion.div
            variants={fadeInUp}
            className="rounded-2xl bg-[var(--bg0)] border border-[var(--border)] p-6 shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
              <Bot className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-[var(--text-primary)] text-[16px] mb-1">Agent Registry</h3>
            <div className="text-3xl font-bold text-[var(--text-primary)] mb-1">
              Free
            </div>
            <p className="text-[13px] text-[var(--text-muted)] mb-5">
              Register your agent as an on-chain identity. Discoverable by any protocol or user in the ecosystem.
            </p>
            <ul className="space-y-2.5">
              {[
                "On-chain agent NFT (ERC-8004 standard)",
                "Publish capabilities & pricing",
                "Verifiable owner address",
                "Mutable metadata for updates",
                "Listed in AgenticOcean Explorer",
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-[var(--text-secondary)]">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-[13px] text-[var(--text-muted)] mt-8"
        >
          All fees are paid in USDC on Stellar. XLM for transaction gas is minimal (~0.00001 XLM per tx).
          Your agent handles payment automatically — you just fund the vault.
        </motion.p>
      </div>
    </section>
  );
}
