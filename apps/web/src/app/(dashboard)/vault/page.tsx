"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useVault } from "@/hooks/useVault";
import { useWallet } from "@/hooks/useWallet";
import { Stepper } from "@/components/ui/Stepper";
import { TxStateIndicator } from "@/components/ui/TxStateIndicator";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { AGENT_SIGNER_PUBLIC_KEY } from "@/lib/contracts";
import { formatUsdc, shortenAddress } from "@/lib/stellar";
import { fadeInUp } from "@/lib/motion";
import { Wallet, ArrowDownToLine, UserPlus, ExternalLink, Shield } from "lucide-react";

export default function VaultPage() {
  const { address, isConnected, connect } = useWallet();
  const {
    vaultAddress, balance, agents, loading,
    txState, lastTxHash,
    createVault, deposit, withdraw, addAgent, resetTxState,
  } = useVault();

  const [currentStep, setCurrentStep] = useState(0);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [agentAddr, setAgentAddr] = useState(AGENT_SIGNER_PUBLIC_KEY);
  const [dailyLimit, setDailyLimit] = useState("10");
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Auto-advance steps based on state
  useEffect(() => {
    if (!isConnected) { setCurrentStep(0); return; }
    if (loading) return;
    if (!vaultAddress) { setCurrentStep(1); return; }
    setCurrentStep(2);
  }, [isConnected, vaultAddress, loading]);

  // Clear action state after success
  useEffect(() => {
    if (txState === "success") {
      const timer = setTimeout(() => {
        resetTxState();
        setActiveAction(null);
        if (activeAction === "create") setCurrentStep(2);
        if (activeAction === "deposit") setDepositAmount("");
        if (activeAction === "withdraw") setWithdrawAmount("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [txState, activeAction, resetTxState]);

  const handleDeposit = () => {
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) return;
    setActiveAction("deposit");
    deposit(amt);
  };

  const handleWithdraw = () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) return;
    setActiveAction("withdraw");
    withdraw(amt);
  };

  const handleAddAgent = () => {
    if (!agentAddr || !dailyLimit) return;
    setActiveAction("addAgent");
    addAgent(agentAddr, parseFloat(dailyLimit));
  };

  const balanceUsdc = parseFloat(formatUsdc(balance));

  const steps = [
    {
      label: "Connect",
      content: (
        <Card glow>
          <div className="text-center py-8 space-y-4">
            <Wallet className="w-12 h-12 text-indigo-400 mx-auto" />
            <h3 className="text-lg font-semibold">Connect Your Wallet</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Connect Freighter to create and manage your USDC vault on Stellar
            </p>
            <Button onClick={connect} size="lg">Connect Freighter</Button>
          </div>
        </Card>
      ),
    },
    {
      label: "Create Vault",
      content: (
        <Card glow>
          <div className="text-center py-8 space-y-4">
            <Shield className="w-12 h-12 text-indigo-400 mx-auto" />
            <h3 className="text-lg font-semibold">Create Your Smart Vault</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Deploy a personal UserVault contract that holds USDC and delegates agent spending.
            </p>
            <p className="text-xs text-[var(--text-secondary)] font-mono">{shortenAddress(address || "", 8)}</p>
            <Button
              onClick={() => { setActiveAction("create"); createVault(); }}
              size="lg"
              disabled={txState !== "idle" && txState !== "error"}
            >
              {txState !== "idle" && txState !== "error" ? "Creating..." : "Create Vault"}
            </Button>
            <TxStateIndicator state={activeAction === "create" ? txState : "idle"} txHash={lastTxHash} />
          </div>
        </Card>
      ),
    },
    {
      label: "Manage",
      content: (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6">
          {/* Balance card */}
          <Card glow>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Vault Balance</p>
                <div className="text-3xl font-bold text-indigo-400">
                  <AnimatedCounter value={balanceUsdc} prefix="$" decimals={2} />
                  <span className="text-sm font-normal text-[var(--text-secondary)] ml-2">USDC</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--text-secondary)]">Vault Address</p>
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${vaultAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-indigo-400 hover:underline flex items-center gap-1 justify-end"
                >
                  {shortenAddress(vaultAddress || "", 6)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </Card>

          {/* Deposit / Withdraw */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4 text-green-400" /> Deposit
              </h3>
              <div className="flex gap-2 mb-2">
                {[1, 10, 50].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setDepositAmount(amt.toString())}
                    className="px-3 py-1 text-xs rounded-full border border-[var(--border)] hover:border-indigo-500 transition-colors"
                  >
                    {amt} USDC
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount (USDC)"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                />
                <Button
                  onClick={handleDeposit}
                  variant="secondary"
                  disabled={(activeAction === "deposit" && txState !== "idle" && txState !== "error") || !depositAmount}
                >
                  Deposit
                </Button>
              </div>
              <TxStateIndicator state={activeAction === "deposit" ? txState : "idle"} txHash={lastTxHash} />
            </Card>

            <Card>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4 text-amber-400 rotate-180" /> Withdraw
              </h3>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount (USDC)"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                />
                <Button
                  onClick={handleWithdraw}
                  variant="secondary"
                  disabled={(activeAction === "withdraw" && txState !== "idle" && txState !== "error") || !withdrawAmount}
                >
                  Withdraw
                </Button>
              </div>
              <TxStateIndicator state={activeAction === "withdraw" ? txState : "idle"} txHash={lastTxHash} />
            </Card>
          </div>

          {/* Agent authorization */}
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-400" /> Authorize Agent
            </h3>
            <div className="space-y-3">
              <Input
                label="Agent Address"
                value={agentAddr}
                onChange={e => setAgentAddr(e.target.value)}
                placeholder="G..."
              />
              <Input
                label="Daily Limit (USDC)"
                type="number"
                value={dailyLimit}
                onChange={e => setDailyLimit(e.target.value)}
                placeholder="10"
              />
              <Button
                onClick={handleAddAgent}
                disabled={(activeAction === "addAgent" && txState !== "idle" && txState !== "error") || !agentAddr}
              >
                Authorize Agent
              </Button>
              <TxStateIndicator state={activeAction === "addAgent" ? txState : "idle"} txHash={lastTxHash} />
            </div>
          </Card>

          {/* Agent list */}
          {agents.length > 0 && (
            <Card>
              <h3 className="font-semibold mb-3">Authorized Agents</h3>
              <div className="space-y-2">
                {agents.map((agent, i) => (
                  <motion.div
                    key={agent.address}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]"
                  >
                    <div>
                      <span className="font-mono text-sm">{shortenAddress(agent.address, 6)}</span>
                      <Badge variant={agent.isActive ? "success" : "default"} className="ml-2">
                        {agent.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-right text-sm">
                      <div>Limit: {formatUsdc(agent.dailyLimit)} USDC/day</div>
                      <div className="text-[var(--text-secondary)]">Spent: {formatUsdc(agent.spent)} USDC</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          )}
        </motion.div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vault Manager</h1>
        <p className="text-[var(--text-secondary)]">Create and manage your USDC vault</p>
      </div>
      <Stepper steps={steps} currentStep={currentStep} />
    </div>
  );
}
