"use client";
import { motion } from "framer-motion";
import { Search, Bot, Shield, Zap } from "lucide-react";

const steps = [
  {
    icon: Search,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    num: "01",
    title: "Discover the Explorer",
    desc: "Browse the ERC-8004 Agent Explorer — a searchable on-chain registry of AI agents on Stellar. Filter by capability (yield-optimizer, rebalancer, data-fetcher), see pricing in USDC, owner address, and model version. Every entry is a Soroban NFT with a verifiable on-chain identity.",
    note: "ERC-8004 on Stellar",
    noteColor: "text-blue-600 bg-blue-50",
  },
  {
    icon: Bot,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    num: "02",
    title: "Register Your Agent",
    desc: "Register your AI agent with one transaction. It gets a sequential NFT ID, an immutable owner address, published capabilities list, USDC pricing, model version, and vault address — all stored in the AgentRegistry Soroban contract and readable by any protocol without permission.",
    note: "Sequential NFT ID · immutable owner",
    noteColor: "text-indigo-600 bg-indigo-50",
  },
  {
    icon: Shield,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    num: "03",
    title: "Connect a Vault + Set Policies",
    desc: "Deploy a Soroban smart vault and authorize your agent with granular spending policies: daily USDC cap, destination whitelist, and instant revocation. The vault SDK handles contract deployment and policy management programmatically. All rules are enforced on-chain — no off-chain override is possible.",
    note: "x402 + vault SDK",
    noteColor: "text-violet-600 bg-violet-50",
  },
  {
    icon: Zap,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    num: "04",
    title: "Agent Pays & Acts Autonomously",
    desc: "Your agent pays for AI compute (Claude queries), DeFi data, and protocol services with a single HTTP header using x402-stellar. Use the defi-agent SDK to fetch live APY data from Blend/Soroswap/Ondo, generate risk-adjusted strategies, and execute rebalances — every action logged with a Stellar Explorer txHash.",
    note: "0.01 USDC per query · fully on-chain",
    noteColor: "text-emerald-600 bg-emerald-50",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-white">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-[12px] font-semibold uppercase tracking-widest text-[var(--accent)]">
            How It Works
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
            From Registry to Autonomous Agent in 4 Steps
          </h2>
          <p className="mt-4 text-[16px] text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            Discover registered agents, deploy your own, attach a smart vault, and let
            it pay for its own compute on-chain.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="space-y-5">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? -24 : 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
              className="rounded-2xl bg-[var(--bg0)] border border-[var(--border)] p-6 flex items-start gap-5"
            >
              {/* Step number + icon */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div
                  className={`w-12 h-12 rounded-xl ${s.iconBg} flex items-center justify-center`}
                >
                  <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
                <span className="text-[11px] font-bold text-[var(--text-muted)]">{s.num}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h3 className="font-semibold text-[var(--text-primary)] text-[16px]">{s.title}</h3>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${s.noteColor}`}>
                    {s.note}
                  </span>
                </div>
                <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
