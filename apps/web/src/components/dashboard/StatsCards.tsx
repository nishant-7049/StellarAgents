"use client";
import { useState, useEffect } from "react";
import { nativeToScVal } from "@stellar/stellar-sdk";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { readContract, formatUsdc } from "@/lib/stellar";
import { VAULT_FACTORY_ADDRESS, AGENT_REGISTRY_ADDRESS, DEMO_VAULT_ADDRESS } from "@/lib/contracts";
import { staggerContainer, fadeInUp } from "@/lib/motion";

export function StatsCards() {
  const [vaultCount, setVaultCount] = useState(0);
  const [agentCount, setAgentCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [vc, ac] = await Promise.all([
        readContract<number>(VAULT_FACTORY_ADDRESS, "vault_count", []).catch(() => 0),
        readContract<number>(AGENT_REGISTRY_ADDRESS, "agent_count", []).catch(() => 0),
      ]);
      setVaultCount(Number(vc));
      setAgentCount(Number(ac));

      try {
        const spent = await readContract<bigint>(DEMO_VAULT_ADDRESS, "total_spent", []);
        setTotalSpent(Number(spent) / 10_000_000);
      } catch { /* vault may not exist */ }
    } catch {
      // Contract reads may fail if testnet is unavailable
    }
  }

  const stats = [
    { label: "Total Vaults", value: vaultCount },
    { label: "Active Agents", value: agentCount },
    { label: "USDC Volume", value: totalSpent, prefix: "$", decimals: 2 },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid gap-4 sm:grid-cols-3"
    >
      {stats.map(s => (
        <motion.div key={s.label} variants={fadeInUp}>
          <Card>
            <div className="text-sm text-[var(--text-secondary)]">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">
              <AnimatedCounter
                value={s.value}
                prefix={s.prefix}
                decimals={s.decimals}
              />
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
