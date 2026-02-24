"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import { TxLink } from "@/components/ui/TxLink";
import { Play, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { signAndSubmit } from "@/lib/stellar";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

function resolveProtocolKey(protocol: string): string {
  const p = protocol.toLowerCase();
  if (p.includes("blend")) return "blend";
  if (p.includes("soroswap")) return "soroswap";
  if (p.includes("ondo") || p.includes("usdy")) return "ondo";
  if (p.includes("defindex") || p.includes("vault")) return "defindex";
  if (p.includes("aquarius")) return "aquarius";
  if (p.includes("centrifuge")) return "centrifuge";
  return "other";
}

interface Strategy {
  protocol: string;
  action: string;
  allocation_pct: number;
  estimated_apy: number;
  risk_level: string;
  details?: string;
}

interface ExecuteStrategyProps {
  strategies: Strategy[];
  totalAmount: number;
  userAddress: string;
}

interface TransactionStep {
  protocol: string;
  action: string;
  amount: string;
  xdr: string;
  description: string;
  status: "pending" | "signing" | "submitting" | "success" | "error";
  txHash?: string;
  error?: string;
}

export function ExecuteStrategy({ strategies, totalAmount, userAddress }: ExecuteStrategyProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [simulation, setSimulation] = useState<any>(null);
  const [feeInfo, setFeeInfo] = useState<{ amount: string; percentage: string } | null>(null);

  async function loadPreview() {
    setLoading(true);
    try {
      console.log("Loading preview with:", { strategies, totalAmount, userAddress });

      const response = await fetch(`${BACKEND_URL}/api/execute/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategies,
          totalAmount,
          userAddress,
        }),
      });

      const data = await response.json();
      console.log("Preview response:", data);

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (!data.transactions || !Array.isArray(data.transactions)) {
        throw new Error("Invalid response: missing transactions array");
      }

      setTransactions(data.transactions.map((tx: any) => ({ ...tx, status: "pending" })));
      if (data.fee) {
        setFeeInfo({ amount: data.fee.amount, percentage: data.fee.percentage });
      }

      // Also load simulation data
      const simResponse = await fetch(`${BACKEND_URL}/api/execute/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategies, totalAmount }),
      });
      const simData = await simResponse.json();

      if (simResponse.ok) {
        setSimulation(simData);
      }

      setOpen(true);
    } catch (err: any) {
      console.error("Preview load error:", err);
      alert(`Failed to load execution preview: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function executeAll() {
    setLoading(true);

    for (let i = 0; i < transactions.length; i++) {
      setCurrentStep(i);
      const tx = transactions[i];

      try {
        // Update status to signing
        setTransactions(prev =>
          prev.map((t, idx) => idx === i ? { ...t, status: "signing" } : t)
        );

        // Sign with Freighter and submit to network
        const txHash = await signAndSubmit(tx.xdr);

        // Update status to success
        setTransactions(prev =>
          prev.map((t, idx) => idx === i ? { ...t, status: "success", txHash } : t)
        );

      } catch (err: any) {
        // Update status to error
        setTransactions(prev =>
          prev.map((t, idx) => idx === i ? { ...t, status: "error", error: err.message } : t)
        );
        setLoading(false);
        return;
      }

      // Small delay between transactions
      if (i < transactions.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setLoading(false);

    // Record positions in portfolio tracker after all txs succeed
    const allDone = transactions.every(t => t.status === "success" || t.status === "error");
    const anySuccess = transactions.some(t => t.status === "success");
    if (allDone && anySuccess) {
      const successHashes = transactions.filter(t => t.txHash).map(t => t.txHash!);
      const positions = strategies
        .filter(s => !s.protocol.includes("StellarAgent402")) // skip fee tx
        .map(s => ({
          protocol: s.protocol,
          protocolKey: resolveProtocolKey(s.protocol),
          amountUsdc: (s.allocation_pct / 100) * totalAmount,
          allocationPct: s.allocation_pct,
          entryApy: s.estimated_apy,
          deployedAt: new Date().toISOString(),
        }));
      try {
        await fetch(`${BACKEND_URL}/api/portfolio/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: userAddress, positions, totalAmount, txHashes: successHashes }),
        });
      } catch {}
    }
  }

  const allSuccess = transactions.every(tx => tx.status === "success");

  return (
    <>
      <div className="mt-4">
        <Button
          onClick={loadPreview}
          disabled={loading || !userAddress}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Spinner className="mr-2" />
              Loading Preview...
            </>
          ) : (
            <>
              <Play className="mr-2 w-5 h-5" />
              Execute Strategy
            </>
          )}
        </Button>
        {!userAddress && (
          <p className="text-xs text-[var(--text-secondary)] text-center mt-2">
            Connect your wallet to execute this strategy
          </p>
        )}
      </div>

      {open && (
        <Dialog
          open={open}
          onClose={() => !loading && setOpen(false)}
          title="Execute Strategy"
          size="large"
        >
          <div className="space-y-4">
            {/* Platform Fee Notice */}
            {feeInfo && (
              <Card className="p-3 bg-amber-500/10 border-amber-500/30">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-300">Platform fee ({feeInfo.percentage})</span>
                  <span className="font-mono font-medium text-amber-400">{feeInfo.amount} USDC</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Included as the first transaction. Supports ongoing platform development.
                </p>
              </Card>
            )}

            {/* Simulation Summary */}
            {simulation && (
              <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-indigo-500/10">
                <h3 className="font-semibold mb-2">Expected Returns</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-[var(--text-secondary)]">Portfolio APY</div>
                    <div className="text-2xl font-bold text-green-400">{simulation.portfolioAPY}%</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-secondary)]">Yearly Return</div>
                    <div className="text-xl font-semibold">${simulation.totalYearlyReturn}</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-secondary)]">Monthly Return</div>
                    <div className="text-xl font-semibold">${simulation.totalMonthlyReturn}</div>
                  </div>
                </div>
              </Card>
            )}

            {/* Transaction Steps */}
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center justify-between">
                <span>Transaction Steps ({transactions.length})</span>
                <span className="text-sm text-[var(--text-secondary)]">
                  {transactions.filter(t => t.status === "success").length} / {transactions.length} completed
                </span>
              </h3>

              {transactions.map((tx, idx) => (
                <Card
                  key={idx}
                  className={`p-3 ${
                    currentStep === idx && loading ? "border-indigo-400" :
                    tx.status === "success" ? "border-green-500/50" :
                    tx.status === "error" ? "border-red-500/50" :
                    "border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{tx.protocol}</span>
                        <Badge
                          variant={
                            tx.status === "success" ? "success" :
                            tx.status === "error" ? "error" :
                            "default"
                          }
                          className="text-xs"
                        >
                          {tx.status === "pending" ? "Pending" :
                           tx.status === "signing" ? "Signing..." :
                           tx.status === "submitting" ? "Submitting..." :
                           tx.status === "success" ? "Success" :
                           "Failed"}
                        </Badge>
                      </div>
                      <div className="text-sm text-[var(--text-secondary)]">{tx.description}</div>
                      <div className="text-xs text-[var(--text-tertiary)] mt-1">
                        Amount: {tx.amount} USDC
                      </div>
                      {tx.txHash && (
                        <TxLink hash={tx.txHash} className="text-xs mt-1" />
                      )}
                      {tx.error && (
                        <div className="text-xs text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {tx.error}
                        </div>
                      )}
                    </div>

                    <div className="ml-2">
                      {tx.status === "success" && (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      )}
                      {tx.status === "error" && (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      )}
                      {(tx.status === "signing" || tx.status === "submitting") && (
                        <Spinner className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              {!allSuccess && !loading && (
                <Button
                  onClick={executeAll}
                  className="flex-1"
                  disabled={transactions.length === 0}
                >
                  <Play className="mr-2 w-4 h-4" />
                  Sign & Execute All
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                className={allSuccess ? "flex-1" : ""}
              >
                {allSuccess ? "Done" : "Cancel"}
              </Button>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-[var(--text-tertiary)] text-center">
              {simulation?.disclaimer || "You will be prompted to sign each transaction with Freighter. Network fees will apply."}
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
