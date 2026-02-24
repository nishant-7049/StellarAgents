"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { fetchTransactionHistory } from "@/lib/api";
import { DEMO_VAULT_ADDRESS } from "@/lib/contracts";
import { shortenAddress, getTxUrl } from "@/lib/stellar";
import { useVault } from "@/hooks/useVault";
import { ArrowDownToLine, ArrowUpFromLine, Zap, ExternalLink } from "lucide-react";

interface TxRecord {
  id: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  amount?: string;
  asset_type?: string;
  from?: string;
  to?: string;
  source_account?: string;
  description?: string; // decoded human-readable description
  amountFormatted?: string;
}

export default function HistoryPage() {
  const { vaultAddress } = useVault();
  const [operations, setOperations] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [vaultAddress]);

  async function loadHistory() {
    setLoading(true);
    try {
      const account = vaultAddress || DEMO_VAULT_ADDRESS;
      const ops = await fetchTransactionHistory(account, 20);
      setOperations(ops);
    } catch {
      setOperations([]);
    } finally {
      setLoading(false);
    }
  }

  function getOpIcon(type: string) {
    if (type.includes("invoke")) return <Zap className="w-4 h-4 text-indigo-400" />;
    if (type.includes("payment")) return <ArrowUpFromLine className="w-4 h-4 text-amber-400" />;
    return <ArrowDownToLine className="w-4 h-4 text-green-400" />;
  }

  function getOpLabel(op: TxRecord) {
    // Use decoded description if available
    if (op.description) return op.description;
    if (op.type === "invoke_host_function") return "Smart Contract Interaction";
    if (op.type === "payment") return "Payment";
    if (op.type === "create_account") return "Create Account";
    return op.type.replace(/_/g, " ");
  }

  // Keep backward compat
  function getOpLabelFromType(type: string) {
    if (type === "invoke_host_function") return "Smart Contract Interaction";
    if (type === "payment") return "Payment";
    if (type === "create_account") return "Create Account";
    return type.replace(/_/g, " ");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <p className="text-[var(--text-secondary)]">
          View operations for {shortenAddress(vaultAddress || DEMO_VAULT_ADDRESS, 6)}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : operations.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--text-secondary)]">
            No transactions yet. Create a vault and query an agent to see activity here.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {operations.map((op, i) => (
            <motion.div
              key={op.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getOpIcon(op.type)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{getOpLabel(op)}</span>
                      <Badge variant="default">{op.type === "invoke_host_function" ? "Soroban" : "Stellar"}</Badge>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {new Date(op.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {op.amount && (
                    <span className="text-sm font-mono">
                      {parseFloat(op.amount).toFixed(2)} {op.asset_type === "native" ? "XLM" : "USDC"}
                    </span>
                  )}
                  <a
                    href={getTxUrl(op.transaction_hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
