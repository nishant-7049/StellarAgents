"use client";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { staggerContainer, fadeInUp } from "@/lib/motion";
import { Shield, Bot, Zap } from "lucide-react";

const features = [
  {
    title: "Smart Vaults",
    description: "Per-user Soroban C-accounts holding USDC with per-agent spending policies. Daily limits, destination whitelists, instant revocation.",
    icon: Shield,
  },
  {
    title: "Agent Identity (ERC-8004)",
    description: "On-chain AI agent registry inspired by ERC-8004. Each agent is an NFT with capabilities, pricing, and verifiable identity.",
    icon: Bot,
  },
  {
    title: "x402 Payments",
    description: "HTTP 402-based micropayments. Agents pay for services with a single header — no wallets, no popups, no friction.",
    icon: Zap,
  },
];

export function Features() {
  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-5xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-3xl font-bold"
        >
          Three Primitives, One Protocol
        </motion.h2>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="mt-12 grid gap-6 md:grid-cols-3"
        >
          {features.map(f => (
            <motion.div key={f.title} variants={fadeInUp}>
              <Card glow>
                <f.icon className="w-8 h-8 text-indigo-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{f.description}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
