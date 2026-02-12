"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/hooks/useWallet";
import { useRegistry } from "@/hooks/useRegistry";
import { useVault } from "@/hooks/useVault";
import { Stepper } from "@/components/ui/Stepper";
import { TxStateIndicator } from "@/components/ui/TxStateIndicator";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { AGENT_SIGNER_PUBLIC_KEY, DEMO_VAULT_ADDRESS } from "@/lib/contracts";
import { shortenAddress, getTxUrl } from "@/lib/stellar";
import { Bot, FileCheck, PartyPopper, ExternalLink } from "lucide-react";

const CAPABILITY_OPTIONS = ["yield", "swap", "lending", "rebalance", "portfolio", "risk"];

export default function RegisterPage() {
  const { address, isConnected, connect } = useWallet();
  const { txState, lastTxHash, registeredId, registerAgent, resetTxState } = useRegistry();
  const { vaultAddress } = useVault();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [selectedCaps, setSelectedCaps] = useState<string[]>(["yield"]);
  const [price, setPrice] = useState("100000"); // 0.01 USDC in stroops
  const [vault, setVault] = useState(vaultAddress || DEMO_VAULT_ADDRESS);
  const [signer, setSigner] = useState(AGENT_SIGNER_PUBLIC_KEY);

  useEffect(() => {
    if (!isConnected) setStep(0);
    else if (step === 0) setStep(1);
  }, [isConnected]);

  useEffect(() => {
    if (vaultAddress) setVault(vaultAddress);
  }, [vaultAddress]);

  useEffect(() => {
    if (txState === "success") {
      setStep(3);
    }
  }, [txState]);

  const toggleCap = (cap: string) => {
    setSelectedCaps(prev =>
      prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]
    );
  };

  const handleRegister = () => {
    registerAgent({
      name,
      capabilities: selectedCaps,
      pricing: price,
      vaultAddress: vault,
      agentSigner: signer,
    });
  };

  const steps = [
    {
      label: "Connect",
      content: (
        <Card glow>
          <div className="text-center py-8 space-y-4">
            <Bot className="w-12 h-12 text-indigo-400 mx-auto" />
            <h3 className="text-lg font-semibold">Connect Wallet</h3>
            <p className="text-sm text-[var(--text-secondary)]">Connect Freighter to register an AI agent</p>
            <Button onClick={connect} size="lg">Connect Freighter</Button>
          </div>
        </Card>
      ),
    },
    {
      label: "Details",
      content: (
        <Card glow>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" /> Agent Details
          </h3>
          <div className="space-y-4">
            <Input
              label="Agent Name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Yield Optimizer Pro"
            />
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">Capabilities</label>
              <div className="flex flex-wrap gap-2">
                {CAPABILITY_OPTIONS.map(cap => (
                  <button
                    key={cap}
                    onClick={() => toggleCap(cap)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      selectedCaps.includes(cap)
                        ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-indigo-500/50"
                    }`}
                  >
                    {cap}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="Price per Query (stroops)"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="100000"
            />
            <p className="text-xs text-[var(--text-secondary)]">
              {(parseInt(price || "0") / 10_000_000).toFixed(4)} USDC per query
            </p>
            <Button onClick={() => setStep(2)} disabled={!name} className="w-full">
              Review
            </Button>
          </div>
        </Card>
      ),
    },
    {
      label: "Review",
      content: (
        <Card glow>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-400" /> Review & Register
          </h3>
          <div className="space-y-4">
            {/* Preview card */}
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{name}</span>
                <Badge variant="info">ERC-8004</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedCaps.map(c => <Badge key={c} variant="info">{c}</Badge>)}
              </div>
              <div className="text-sm text-[var(--text-secondary)] space-y-1">
                <div>Price: {(parseInt(price || "0") / 10_000_000).toFixed(4)} USDC/query</div>
                <div>Vault: {shortenAddress(vault, 6)}</div>
                <div>Signer: {shortenAddress(signer, 6)}</div>
              </div>
            </div>
            <Button
              onClick={handleRegister}
              size="lg"
              className="w-full"
              disabled={txState !== "idle" && txState !== "error"}
            >
              {txState !== "idle" && txState !== "error" ? "Registering..." : "Register on Stellar"}
            </Button>
            <TxStateIndicator state={txState} txHash={lastTxHash} />
            <button onClick={() => setStep(1)} className="text-sm text-[var(--text-secondary)] hover:text-white">
              Back to edit
            </button>
          </div>
        </Card>
      ),
    },
    {
      label: "Done",
      content: (
        <Card glow>
          <div className="text-center py-8 space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 10 }}
            >
              <PartyPopper className="w-16 h-16 text-green-400 mx-auto" />
            </motion.div>
            <h3 className="text-lg font-semibold">Agent Registered!</h3>
            {registeredId && (
              <div className="text-2xl font-bold text-indigo-400">
                Agent NFT #{registeredId}
              </div>
            )}
            <div className="flex flex-wrap gap-1 justify-center">
              {selectedCaps.map(c => <Badge key={c} variant="info">{c}</Badge>)}
            </div>
            {lastTxHash && (
              <a
                href={getTxUrl(lastTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-400 hover:underline flex items-center gap-1 justify-center"
              >
                View on Stellar Expert <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <Button
              onClick={() => {
                setStep(1);
                setName("");
                setSelectedCaps(["yield"]);
                resetTxState();
              }}
              variant="outline"
            >
              Register Another
            </Button>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Register Agent</h1>
        <p className="text-[var(--text-secondary)]">Register a new AI agent on the Stellar agent registry (ERC-8004)</p>
      </div>
      <div className="max-w-lg">
        <Stepper steps={steps} currentStep={step} />
      </div>
    </div>
  );
}
