# Quick Start

Get up and running with AgenticOcean in 5 minutes.

---

## Prerequisites

- Node.js 20+
- pnpm (or npm / yarn)
- A Stellar testnet wallet (use [Stellar Laboratory](https://laboratory.stellar.org/) or `stellar keys generate`)
- A free AI API key (Groq is recommended — free tier, no credit card)

---

## Step 1 — Install the packages

Install whichever packages you need:

```bash
# Yield optimizer + DeFi clients
npm install @agenticocean/defi-agent

# On-chain vault + registry SDK
npm install @agenticocean/vault

# x402 HTTP payment protocol
npm install @agenticocean/x402-stellar
```

---

## Step 2 — Get a free AI API key

The yield optimizer supports four providers. Pick one:

| Provider | Key prefix | Free tier | Sign up |
|----------|-----------|-----------|---------|
| **Groq** (recommended) | `gsk_...` | 14,400 req/day | [console.groq.com](https://console.groq.com) |
| Google Gemini | `AIza...` | Limited | [aistudio.google.com](https://aistudio.google.com) |
| Anthropic Claude | `sk-ant-...` | Paid | [console.anthropic.com](https://console.anthropic.com) |
| xAI Grok | `xai-...` | Paid | [console.x.ai](https://console.x.ai) |

The SDK auto-detects the provider from the key prefix — no extra configuration needed.

---

## Step 3 — Run your first yield query

```typescript
import { YieldOptimizer } from "@agenticocean/defi-agent";

const optimizer = new YieldOptimizer({
  stellarRpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  aiApiKey: process.env.AI_API_KEY,  // your Groq / Claude / Gemini key
  blendPoolId: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
});

const strategy = await optimizer.optimize(
  "What is the safest yield strategy for my USDC?",
  "low",   // "low" | "moderate" | "high"
  1000     // amount in USDC (optional — used for projected returns)
);

console.log(`Total APY: ${strategy.total_estimated_apy}%`);
console.log(`Summary: ${strategy.summary}`);
strategy.strategies.forEach(s => {
  console.log(`  ${s.protocol}: ${s.allocation_pct}% @ ${s.estimated_apy}% APY [${s.risk_level}]`);
});
```

**Example output (with Groq key):**
```
Total APY: 5.58%
Summary: Conservative allocation across T-bill-backed tokens and a fixed lending pool.
  Ondo USDY: 60% @ 4.8% APY [low]
  Blend Fixed V2: 20% @ 7.2% APY [low]
  DeFindex Auto-Compound: 20% @ 9.1% APY [moderate]
```

---

## Step 4 — Read live Blend pool data

```typescript
import { BlendClient } from "@agenticocean/defi-agent";

const blend = new BlendClient({
  stellarRpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  blendPoolId: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
});

const pool = await blend.loadPool();
console.log(`Pool: ${pool.poolName}`);
pool.reserves.forEach(r => {
  console.log(`  ${r.symbol}: ${r.supplyApy.toFixed(2)}% supply APY, ${(r.utilization * 100).toFixed(0)}% utilized`);
});
```

---

## Step 5 — Connect to your vault (optional)

If you have a deployed vault and want to check your position:

```typescript
import { UserVault } from "@agenticocean/vault";

const vault = new UserVault("C...YOUR_VAULT_ADDRESS...", {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
});

const balance = await vault.getBalance();
const balanceUsdc = Number(balance) / 1e7;
console.log(`Vault balance: $${balanceUsdc.toFixed(2)} USDC`);
```

---

## What's next?

- [Full YieldOptimizer docs](../sdk/defi-agent/yield-optimizer.md) — risk profiles, custom prompts, portfolio snapshots
- [Rebalancer docs](../sdk/defi-agent/rebalancer.md) — set targets, auto-rebalance with drift thresholds
- [Create a vault via the dashboard](../dashboard/create-vault.md) — no code required
- [x402 payment protocol](../sdk/x402-stellar/overview.md) — make your API agent-payable

---

## Mainnet

This quick start uses **testnet** by default. For **mainnet** setup (real funds, audited contracts, and mainnet USDC), follow:

- [Mainnet guide](mainnet.md)
