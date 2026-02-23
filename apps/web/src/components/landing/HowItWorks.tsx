"use client";
import { motion } from "framer-motion";
import { Wallet, Shield, Bot, Zap } from "lucide-react";

const steps = [
  { icon: Wallet, title: "Connect Wallet", desc: "Link your Freighter wallet on Stellar testnet" },
  { icon: Shield, title: "Create Vault", desc: "Deploy a smart vault and deposit USDC" },
  { icon: Bot, title: "Register Agent", desc: "Add an AI agent with spending limits" },
  { icon: Zap, title: "Agent Pays", desc: "Agent queries services, pays via x402 automatically" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6 bg-[var(--bg-secondary)]">
      <div className="mx-auto max-w-5xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-3xl font-bold mb-12"
        >
          How It Works
        </motion.h2>
        <div className="grid gap-8 md:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="text-center relative"
            >
              <motion.div
                whileInView={{
                  boxShadow: ["0 0 0 0 rgba(99,102,241,0)", "0 0 0 8px rgba(99,102,241,0.15)", "0 0 0 0 rgba(99,102,241,0)"],
                }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 + 0.5, duration: 1.5 }}
                className="mx-auto w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center mb-4"
              >
                <s.icon className="w-5 h-5 text-white" />
              </motion.div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-6 left-[calc(50%+28px)] w-[calc(100%-56px)] h-px bg-[var(--border)]" />
              )}
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
