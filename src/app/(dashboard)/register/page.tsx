"use client";
import { useState, useEffect, useRef } from "react";
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
import { shortenAddress, getTxUrl } from "@/lib/stellar";
import {
  Bot, FileCheck, PartyPopper, ExternalLink,
  X, Plus, ImageIcon, Loader2, AlertTriangle, Shield,
} from "lucide-react";

// 5 categories from the Explorer FilterChips
const REGISTER_CATEGORIES: { label: string; tags: string[] }[] = [
  { label: "Trading",    tags: ["trading", "trade"] },
  { label: "Yield",      tags: ["yield", "defi"] },
  { label: "Payments",   tags: ["payments", "payment"] },
  { label: "Analytics",  tags: ["analytics", "data"] },
  { label: "Automation", tags: ["automation", "automated"] },
];

// Derive flat capability tags from selected category labels
function capsFromCategories(selectedLabels: string[]): string[] {
  const tags: string[] = [];
  for (const label of selectedLabels) {
    const cat = REGISTER_CATEGORIES.find(c => c.label === label);
    if (cat) tags.push(...cat.tags);
  }
  return [...new Set(tags)];
}

async function uploadToIPFS(file: File): Promise<string> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  if (!jwt) throw new Error("NEXT_PUBLIC_PINATA_JWT not configured");

  const body = new FormData();
  body.append("file", file);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.details || "IPFS upload failed");
  }
  const data = await res.json();
  return `ipfs://${data.IpfsHash}`;
}

export default function RegisterPage() {
  const { address, isConnected, connect } = useWallet();
  const { txState, lastTxHash, registeredId, registerAgent, resetTxState } = useRegistry();
  const { vaultAddress } = useVault();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customCapInput, setCustomCapInput] = useState("");
  const [customCaps, setCustomCaps] = useState<string[]>([]);
  const [price, setPrice] = useState("100000");
  const [vault, setVault] = useState(vaultAddress || "");
  const [signer, setSigner] = useState("");

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All capability tags = selected category tags + custom caps
  const allCaps = [...capsFromCategories(selectedCategories), ...customCaps];

  useEffect(() => {
    if (!isConnected) setStep(0);
    else if (step === 0) setStep(1);
  }, [isConnected]);

  useEffect(() => {
    if (vaultAddress) setVault(vaultAddress);
  }, [vaultAddress]);

  useEffect(() => {
    if (txState === "success") setStep(3);
  }, [txState]);

  function toggleCategory(label: string) {
    setSelectedCategories(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  }

  function addCustomCap(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !customCaps.includes(tag) && !capsFromCategories(selectedCategories).includes(tag)) {
      setCustomCaps(prev => [...prev, tag]);
    }
    setCustomCapInput("");
  }

  function removeCustomCap(tag: string) {
    setCustomCaps(prev => prev.filter(t => t !== tag));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImageError(null);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRegister() {
    let imageUrl: string | undefined;

    if (imageFile) {
      setImageUploading(true);
      setImageError(null);
      try {
        imageUrl = await uploadToIPFS(imageFile);
      } catch (e: any) {
        // Non-fatal: proceed without image, show warning
        setImageError(`Image upload failed: ${e.message}. Registering without image.`);
      } finally {
        setImageUploading(false);
      }
    }

    registerAgent({
      name,
      handle,
      description,
      image: imageUrl,
      categories: selectedCategories,
      capabilities: allCaps,
      pricing: price,
      vaultAddress: vault,
      agentSigner: signer,
    });
  }

  const hasVault = Boolean(vault);
  const isValidStellarKey = (k: string) => /^G[A-Z2-7]{55}$/.test(k);
  const signerValid = isValidStellarKey(signer);
  const canProceed = name.trim().length > 0 && handle.trim().length > 0 && hasVault && signerValid;

  const steps = [
    // ── Step 0: Connect ──────────────────────────────────────────────
    {
      label: "Connect",
      content: (
        <Card glow>
          <div className="text-center py-8 space-y-4">
            <Bot className="w-12 h-12 text-[var(--accent)] mx-auto" />
            <h3 className="text-lg font-semibold">Connect Wallet</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Connect Freighter to register an AI agent on Stellar
            </p>
            <Button onClick={connect} size="lg">Connect Freighter</Button>
          </div>
        </Card>
      ),
    },

    // ── Step 1: Details ──────────────────────────────────────────────
    {
      label: "Details",
      content: (
        <Card glow>
          <h3 className="font-semibold mb-5 flex items-center gap-2 text-[var(--text-primary)]">
            <Bot className="w-5 h-5 text-[var(--accent)]" /> Agent Details
          </h3>
          <div className="space-y-5">

            {/* Name + Handle */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Agent Name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Yield Optimizer Pro"
              />
              <Input
                label="Handle"
                value={handle}
                onChange={e => setHandle(e.target.value.replace(/\s+/g, "-").toLowerCase())}
                placeholder="yield-optimizer"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what your agent does, how it works, and what makes it unique…"
                rows={3}
                className="w-full px-3 py-2.5 rounded-[8px] text-[13px]
                  bg-[var(--surface1)] border border-[var(--border)]
                  text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                  focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--focus)]
                  resize-none transition-colors"
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
                Agent Image <span className="text-[var(--text-muted)] font-normal">(uploaded to IPFS)</span>
              </label>
              {imagePreview ? (
                <div className="relative w-full h-36 rounded-[10px] overflow-hidden border border-[var(--border)] group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100
                    flex items-center justify-center transition-opacity">
                    <button
                      onClick={clearImage}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px]
                        bg-white/10 border border-white/20 text-white text-[12px] hover:bg-white/20"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-28 rounded-[10px] border border-dashed border-[var(--border)]
                    bg-[var(--surface1)] hover:bg-[var(--surface0)] hover:border-[var(--accent)]/40
                    flex flex-col items-center justify-center gap-2
                    text-[var(--text-muted)] transition-colors"
                >
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-[12px]">Click to upload image</span>
                  <span className="text-[11px] text-[var(--text-muted)]/60">PNG, JPG, GIF, SVG · max 5MB</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              {imageError && (
                <p className="text-[11px] text-[var(--error)] mt-1">{imageError}</p>
              )}
            </div>

            {/* Categories */}
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
                Categories
              </label>
              <div className="flex flex-wrap gap-2">
                {REGISTER_CATEGORIES.map(cat => {
                  const active = selectedCategories.includes(cat.label);
                  return (
                    <button
                      key={cat.label}
                      onClick={() => toggleCategory(cat.label)}
                      className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium border transition-colors ${
                        active
                          ? "bg-[var(--accent)]/12 border-[var(--accent)]/50 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom capability */}
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
                Additional Capabilities
              </label>
              <div className="flex gap-2">
                <input
                  value={customCapInput}
                  onChange={e => setCustomCapInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addCustomCap(customCapInput);
                    }
                  }}
                  placeholder="Type a capability and press Enter…"
                  className="flex-1 px-3 py-2 rounded-[8px] text-[13px]
                    bg-[var(--surface1)] border border-[var(--border)]
                    text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                    focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--focus)]
                    transition-colors"
                />
                <button
                  onClick={() => addCustomCap(customCapInput)}
                  className="px-3 py-2 rounded-[8px] bg-[var(--surface1)] border border-[var(--border)]
                    text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40
                    transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {customCaps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {customCaps.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11px]
                        bg-[var(--surface1)] border border-[var(--border)] text-[var(--text-secondary)]"
                    >
                      {tag}
                      <button onClick={() => removeCustomCap(tag)} className="hover:text-[var(--error)]">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing */}
            <div>
              <Input
                label="Price per Query (stroops)"
                value={price}
                onChange={e => setPrice(e.target.value.replace(/\D/g, ""))}
                placeholder="100000"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                = {(parseInt(price || "0") / 10_000_000).toFixed(4)} USDC per query
              </p>
            </div>

            {/* Agent Signer Public Key */}
            <div>
              <Input
                label="Agent Signer Public Key"
                value={signer}
                onChange={e => setSigner(e.target.value.trim())}
                placeholder="GXXXX..."
              />
              <p className="text-[11px] mt-1">
                {signer && !signerValid
                  ? <span className="text-[var(--danger)]">Must be a valid Stellar public key (starts with G, 56 chars)</span>
                  : <span className="text-[var(--text-muted)]">Public key of the keypair your agent backend uses to sign payments</span>
                }
              </p>
            </div>

            {/* Vault status */}
            {hasVault ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-[8px]
                bg-[var(--success)]/8 border border-[var(--success)]/25">
                <Shield className="w-4 h-4 text-[var(--success)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[var(--success)]">Vault connected</p>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">{vault}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 px-3 py-2.5 rounded-[8px]
                bg-amber-500/8 border border-amber-500/25">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-medium text-amber-500">No vault found</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    You need a vault before registering.{" "}
                    <a href="/vault" className="text-[var(--accent)] hover:underline">
                      Create one in Vault Manager →
                    </a>
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={() => setStep(2)}
              disabled={!canProceed}
              className="w-full"
              size="md"
            >
              Review →
            </Button>
          </div>
        </Card>
      ),
    },

    // ── Step 2: Review ───────────────────────────────────────────────
    {
      label: "Review",
      content: (
        <Card glow>
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
            <FileCheck className="w-5 h-5 text-[var(--accent)]" /> Review & Register
          </h3>
          <div className="space-y-4">
            {/* Preview */}
            <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface1)] overflow-hidden">
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="Agent" className="w-full h-32 object-cover" />
              )}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{name}</p>
                    {handle && (
                      <p className="text-[12px] text-[var(--accent)] mt-0.5">@{handle}</p>
                    )}
                  </div>
                  <Badge variant="info">ERC-8004</Badge>
                </div>

                {description && (
                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">{description}</p>
                )}

                {selectedCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedCategories.map(c => (
                      <span key={c} className="text-[11px] px-2 py-0.5 rounded-[5px]
                        bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[var(--accent)]">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {customCaps.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {customCaps.map(c => (
                      <span key={c} className="text-[11px] px-2 py-0.5 rounded-[5px]
                        bg-[var(--surface0)] border border-[var(--border)] text-[var(--text-muted)]">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-[12px] text-[var(--text-secondary)] space-y-1 pt-1 border-t border-[var(--border)]">
                  <div className="flex justify-between">
                    <span>Price</span>
                    <span className="font-medium text-[var(--success)]">
                      {(parseInt(price || "0") / 10_000_000).toFixed(4)} USDC / query
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vault</span>
                    <span className="font-mono">{shortenAddress(vault, 6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Signer</span>
                    <span className="font-mono">{shortenAddress(signer, 6)}</span>
                  </div>
                  {imageFile && (
                    <div className="flex justify-between">
                      <span>Image</span>
                      <span className="text-[var(--text-muted)]">Will upload to IPFS</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {imageUploading && (
              <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                Uploading image to IPFS…
              </div>
            )}

            <Button
              onClick={handleRegister}
              size="lg"
              className="w-full"
              disabled={imageUploading || (txState !== "idle" && txState !== "error")}
            >
              {imageUploading
                ? "Uploading image…"
                : txState !== "idle" && txState !== "error"
                  ? "Registering…"
                  : "Register on Stellar"}
            </Button>

            <TxStateIndicator state={txState} txHash={lastTxHash} />

            <button
              onClick={() => setStep(1)}
              className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              ← Back to edit
            </button>
          </div>
        </Card>
      ),
    },

    // ── Step 3: Done ─────────────────────────────────────────────────
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
              <PartyPopper className="w-16 h-16 text-[var(--success)] mx-auto" />
            </motion.div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Agent Registered!</h3>
            {registeredId && (
              <div className="text-2xl font-bold text-[var(--accent)]">
                Agent NFT #{registeredId}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {selectedCategories.map(c => (
                <Badge key={c} variant="info">{c}</Badge>
              ))}
              {customCaps.map(c => (
                <Badge key={c} variant="default">{c}</Badge>
              ))}
            </div>
            {lastTxHash && (
              <a
                href={getTxUrl(lastTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-[var(--accent)] hover:underline"
              >
                View on Stellar Expert <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <Button
                onClick={() => {
                  setStep(1);
                  setName(""); setHandle(""); setDescription("");
                  setSelectedCategories([]); setCustomCaps([]);
                  clearImage();
                  resetTxState();
                }}
                variant="outline"
                size="sm"
              >
                Register Another
              </Button>
              {registeredId && (
                <a href={`/explorer/${registeredId}`}>
                  <Button size="sm">View Agent →</Button>
                </a>
              )}
            </div>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--text-primary)]">Register Agent</h1>
        <p className="text-[14px] text-[var(--text-muted)] mt-0.5">
          Register a new AI agent on the Stellar agent registry (ERC-8004)
        </p>
      </div>
      <div className="max-w-lg">
        <Stepper steps={steps} currentStep={step} />
      </div>
    </div>
  );
}
