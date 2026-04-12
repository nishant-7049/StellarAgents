"use client";
import { motion } from "framer-motion";
import { ArrowUpRight, Package } from "lucide-react";
import { staggerContainer, fadeInUp } from "@/lib/motion";

const packages = [
  {
    name: "@agenticocean/defi-agent",
    label: "defi-agent",
    desc: "Connect DeFi sources and execute AI-guided rebalancing strategies.",
    docsUrl: "https://agenticoceandocs.vercel.app/#/sdk/defi-agent/overview",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    name: "@agenticocean/vault",
    label: "vault",
    desc: "Deploy vaults, enforce policies, and manage balances on-chain.",
    docsUrl: "https://agenticoceandocs.vercel.app/#/sdk/vault/overview",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    name: "@agenticocean/x402-stellar",
    label: "x402-stellar",
    desc: "Add USDC micropayments to your API routes with x402 middleware.",
    docsUrl: "https://agenticoceandocs.vercel.app/#/sdk/x402-stellar/overview",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
];

export function DeveloperSection() {
  return (
    <section className="py-20 px-6 bg-[var(--bg0)]">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl bg-white border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Left: copy */}
            <div className="p-8 md:p-10 flex flex-col justify-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center mb-5">
                <Package className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-3">
                Build faster with 3 SDKs
              </h2>
              <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed mb-5">
                Identity, vault management, and micropayments in one developer stack for Stellar agents.
              </p>
              <div className="rounded-xl bg-[var(--bg0)] border border-[var(--border)] px-4 py-3 font-mono text-[13px] text-[var(--text-secondary)] select-all inline-block mb-6">
                <span className="text-[var(--text-muted)]">$</span>{" "}
                npm install @agenticocean/defi-agent
              </div>
              <a
                href="https://agenticoceandocs.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--accent)] hover:underline"
              >
                Read the full documentation
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>

            {/* Right: SDK cards */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="bg-[var(--bg0)] border-l border-[var(--border)] p-8 md:p-10 flex flex-col gap-4"
            >
              {packages.map(pkg => (
                <motion.a
                  key={pkg.name}
                  variants={fadeInUp}
                  href={pkg.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl bg-white border border-[var(--border)] p-4 shadow-sm hover:shadow-md hover:border-[var(--accent)]/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={`text-[12px] font-mono font-bold ${pkg.color} group-hover:underline`}>
                      {pkg.label}
                    </span>
                    <ArrowUpRight className={`w-3.5 h-3.5 ${pkg.color} flex-shrink-0 mt-0.5`} />
                  </div>
                  <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">{pkg.desc}</p>
                </motion.a>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
