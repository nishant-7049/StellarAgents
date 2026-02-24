"use client";
import { motion } from "framer-motion";
import { staggerContainer, fadeInUp } from "@/lib/motion";

const protocols = [
  {
    name: "Blend Protocol",
    category: "Lending",
    desc: "Supply USDC and earn 12.6% APY. The largest lending protocol on Stellar with $6.4M in USDC TVL. AgenticOcean continuously tracks utilization rates and adjusts allocations as borrow demand shifts.",
    stat: "12.6% USDC APY",
    statColor: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  {
    name: "Soroswap",
    category: "AMM DEX",
    desc: "Provide liquidity to USDC/XLM and other pairs on Stellar's leading AMM. Earn trading fees on every swap. AgenticOcean monitors pool depth and fee revenue to decide when LP positions are worth the impermanent loss risk.",
    stat: "~12.5% LP APY",
    statColor: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
  },
  {
    name: "Ondo Finance",
    category: "RWA Yields",
    desc: "USDY is a US Treasury-backed stablecoin yield token — the safest allocation option. Used as the conservative base in low-risk strategies. AgenticOcean uses it as a capital preservation layer when DeFi rates are low.",
    stat: "3.59% Treasury APY",
    statColor: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  {
    name: "DeFiLlama",
    category: "APY Oracle",
    desc: "AgenticOcean pulls live APY data from DeFiLlama's Yields API every 5 minutes, covering all Stellar protocols. This eliminates reliance on single-source data and ensures allocation decisions are based on verified, aggregated rates.",
    stat: "5-min refresh",
    statColor: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  {
    name: "Stellar Soroban",
    category: "Smart Contracts",
    desc: "All vaults and agent policies run as Soroban Rust smart contracts. Transactions finalize in 5–7 seconds with sub-cent fees. No EVM bridges, no wrapped tokens — native assets only.",
    stat: "5-7s finality",
    statColor: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
  },
  {
    name: "x402 Protocol",
    category: "Payments",
    desc: "An open HTTP payment standard that lets any agent pay any service by including a signed Soroban auth entry in a request header. Enables agent-to-agent and agent-to-service micropayments without wallets or human approval.",
    stat: "0.01 USDC / call",
    statColor: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-100",
  },
];

export function Architecture() {
  return (
    <section id="ecosystem" className="py-24 px-6 bg-[var(--bg0)]">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-[12px] font-semibold uppercase tracking-widest text-[var(--accent)]">
            Ecosystem
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
            Built on the Best of Stellar DeFi
          </h2>
          <p className="mt-4 text-[16px] text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            AgenticOcean integrates deeply with every major yield source on Stellar. Your
            agent picks the best combination — automatically — based on your risk profile.
          </p>
        </motion.div>

        {/* Protocol grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {protocols.map(p => (
            <motion.div
              key={p.name}
              variants={fadeInUp}
              className={`rounded-2xl bg-white border ${p.border} p-5 shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)] text-[15px]">{p.name}</h3>
                  <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    {p.category}
                  </span>
                </div>
                <span className={`text-[12px] font-bold ${p.statColor} ${p.bg} px-2.5 py-1 rounded-lg`}>
                  {p.stat}
                </span>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
