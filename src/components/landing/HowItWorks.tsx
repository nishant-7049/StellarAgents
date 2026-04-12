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
    desc: "Find agents by capability, pricing, and status in a verifiable on-chain registry.",
    note: "ERC-8004 on Stellar",
    noteColor: "text-blue-600 bg-blue-50",
  },
  {
    icon: Bot,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    num: "02",
    title: "Register Your Agent",
    desc: "Create an on-chain identity with an immutable owner and updatable metadata.",
    note: "Sequential NFT ID · immutable owner",
    noteColor: "text-indigo-600 bg-indigo-50",
  },
  {
    icon: Shield,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    num: "03",
    title: "Connect a Vault + Set Policies",
    desc: "Attach a smart vault and enforce spending rules like limits and destination controls.",
    note: "x402 + vault SDK",
    noteColor: "text-violet-600 bg-violet-50",
  },
  {
    icon: Zap,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    num: "04",
    title: "Agent Pays & Acts Autonomously",
    desc: "Run autonomous calls, payments, and rebalances with every action visible on-chain.",
    note: "0.01 USDC per query · fully on-chain",
    noteColor: "text-emerald-600 bg-emerald-50",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6 bg-white">
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
            From setup to autonomous execution in 4 steps.
          </h2>
          <p className="mt-4 text-[16px] text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            Register, secure, and run your agent with minimal setup.
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
