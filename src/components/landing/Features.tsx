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
      "List and discover agents with verifiable on-chain identity, ownership, and pricing.",
    detail:
      "Readable by any app: ID, owner, capabilities, vault, and status.",
  },
  {
    icon: Zap,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    badge: "0.01 USDC / query",
    badgeBg: "bg-violet-50 text-violet-600",
    title: "x402 Payments + Smart Vault",
    description:
      "Accept autonomous USDC micropayments and enforce spend policies directly on-chain.",
    detail:
      "Daily limits, destination controls, and instant revocation are built in.",
  },
  {
    icon: TrendingUp,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    badge: "12.6% avg APY",
    badgeBg: "bg-emerald-50 text-emerald-600",
    title: "defi-agent SDK",
    description:
      "Connect Blend, Soroswap, and Ondo to automate yield strategies with AI-driven rebalancing.",
    detail:
      "Every rebalance is verifiable on-chain with a transaction hash.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 px-6 bg-[var(--bg0)]">
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
            Simple stack for on-chain agents.
          </h2>
          <p className="mt-4 text-[16px] text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            Identity, payments, and DeFi automation built for Stellar.
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
                  <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-2.5">
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
