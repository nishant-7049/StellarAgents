"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { TxState } from "@/lib/stellar";
import { getTxUrl } from "@/lib/stellar";
import { Check, Loader2, AlertCircle } from "lucide-react";

interface TxStateIndicatorProps {
  state: TxState;
  txHash?: string;
}

const phases: { key: TxState; label: string }[] = [
  { key: "building", label: "Building" },
  { key: "signing", label: "Signing" },
  { key: "submitting", label: "Submitting" },
  { key: "confirming", label: "Confirming" },
  { key: "success", label: "Confirmed" },
];

export function TxStateIndicator({ state, txHash }: TxStateIndicatorProps) {
  if (state === "idle") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="mt-3"
      >
        {state === "error" ? (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Transaction failed. Please try again.</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {phases.map((phase, i) => {
              const phaseIndex = phases.findIndex(p => p.key === state);
              const thisIndex = i;
              const isComplete = thisIndex < phaseIndex || state === "success";
              const isActive = phase.key === state && state !== "success";

              return (
                <div key={phase.key} className="flex items-center gap-1.5">
                  <motion.div
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      isComplete
                        ? "bg-green-500/20 text-green-400"
                        : isActive
                          ? "bg-indigo-500/20 text-indigo-300"
                          : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                    }`}
                    animate={isActive ? { opacity: [1, 0.6, 1] } : {}}
                    transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
                  >
                    {isComplete ? (
                      <Check className="w-3 h-3" />
                    ) : isActive ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    {phase.label}
                  </motion.div>
                  {i < phases.length - 1 && (
                    <div className={`w-3 h-px ${isComplete ? "bg-green-500" : "bg-[var(--border)]"}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {state === "success" && txHash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-xs"
          >
            <a
              href={getTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              View on Stellar Expert
            </a>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
