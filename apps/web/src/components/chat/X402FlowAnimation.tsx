"use client";
import { motion } from "framer-motion";
import type { ChatPhase } from "@/hooks/useAgentChat";
import { shortenAddress, getTxUrl } from "@/lib/stellar";
import { DEMO_VAULT_ADDRESS, FACILITATOR_PUBLIC_KEY } from "@/lib/contracts";
import { Check, Loader2, DollarSign } from "lucide-react";

interface X402FlowAnimationProps {
  phase: ChatPhase;
  txHash?: string;
  amount?: string;
}

export function X402FlowAnimation({ phase, txHash, amount }: X402FlowAnimationProps) {
  const amountUsdc = amount ? (parseInt(amount) / 10_000_000).toFixed(2) : "0.01";

  const isActive = phase === "building_payment" || phase === "settling";
  const isConfirmed = phase === "confirmed" && !!txHash;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4 my-3 overflow-hidden"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">x402 Payment</span>
        {isConfirmed ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1 text-xs text-green-400"
          >
            <Check className="w-3 h-3" /> Confirmed
          </motion.span>
        ) : isActive ? (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            {phase === "building_payment" ? "Building..." : "Settling..."}
          </span>
        ) : null}
      </div>

      {/* Flow visualization */}
      <div className="flex items-center gap-3">
        {/* Vault box */}
        <div className={`flex-1 rounded-lg p-3 border text-center ${
          isConfirmed ? "border-green-500/30 bg-green-500/5" : "border-[var(--border)] bg-[var(--bg-card)]"
        }`}>
          <p className="text-xs text-[var(--text-secondary)]">Vault</p>
          <p className="text-xs font-mono">{shortenAddress(DEMO_VAULT_ADDRESS, 4)}</p>
          {isConfirmed && <p className="text-xs text-red-400 mt-1">-{amountUsdc} USDC</p>}
        </div>

        {/* Animated connector */}
        <div className="relative w-20 h-8 flex items-center">
          <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--border)]" />
          {isActive && (
            <motion.div
              animate={{ x: [0, 60, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10"
            >
              <DollarSign className="w-5 h-5 text-indigo-400 bg-[var(--bg-secondary)] rounded-full" />
            </motion.div>
          )}
          {isConfirmed && (
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: 60 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative z-10"
            >
              <Check className="w-5 h-5 text-green-400 bg-[var(--bg-secondary)] rounded-full" />
            </motion.div>
          )}
        </div>

        {/* Service box */}
        <div className={`flex-1 rounded-lg p-3 border text-center ${
          isConfirmed ? "border-green-500/30 bg-green-500/5" : "border-[var(--border)] bg-[var(--bg-card)]"
        }`}>
          <p className="text-xs text-[var(--text-secondary)]">Service</p>
          <p className="text-xs font-mono">{shortenAddress(FACILITATOR_PUBLIC_KEY, 4)}</p>
          {isConfirmed && <p className="text-xs text-green-400 mt-1">+{amountUsdc} USDC</p>}
        </div>
      </div>

      {/* Tx hash link */}
      {isConfirmed && txHash && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3 text-center"
        >
          <a
            href={getTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:underline"
          >
            View transaction on Stellar Expert
          </a>
        </motion.div>
      )}
    </motion.div>
  );
}
