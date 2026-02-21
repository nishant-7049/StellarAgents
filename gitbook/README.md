# AgentiCOcean — Stellar DeFi Agent Infrastructure

Welcome to the official documentation for the **@agenticocean** suite of open-source packages — a complete toolkit for building AI agents that autonomously manage DeFi positions on the Stellar blockchain.

---

## What is AgentiCOcean?

AgentiCOcean is a three-layer infrastructure stack that lets AI agents earn yield, pay for services, and prove their identity on Stellar — all without any centralized custody.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Application                          │
├──────────────────────┬──────────────────────┬───────────────────┤
│  @agenticocean/      │  @agenticocean/      │  @agenticocean/   │
│  defi-agent          │  vault               │  x402-stellar     │
│                      │                      │                   │
│  • AI yield engine   │  • Smart vaults      │  • HTTP payments  │
│  • Blend client      │  • Agent policies    │  • x402 protocol  │
│  • Soroswap client   │  • On-chain identity │  • Middleware      │
│  • Rebalancer        │  • Agent registry    │  • Facilitator     │
└──────────────────────┴──────────────────────┴───────────────────┘
                              Stellar Testnet / Mainnet
```

---

## The Three Packages

### `@agenticocean/defi-agent`
The AI yield optimizer. Give it a risk tolerance and USDC amount; it reads live rates from Blend and Soroswap, then generates an optimal allocation strategy using your preferred LLM (Claude, Gemini, Groq, or xAI). Includes an autonomous rebalancer that keeps your portfolio on-target.

→ [See the defi-agent docs](sdk/defi-agent/overview.md)

### `@agenticocean/vault`
TypeScript SDK for interacting with the on-chain Soroban smart contracts: `VaultFactory`, `UserVault`, `AgentRegistry`, `ReputationRegistry`, and `ValidationRegistry`. Create vaults, grant agent spending policies, and read on-chain state — all from TypeScript.

→ [See the vault docs](sdk/vault/overview.md)

### `@agenticocean/x402-stellar`
Implementation of the x402 HTTP payment protocol for Stellar. Agents include a cryptographically-signed payment header with every request; servers verify and settle the USDC payment on-chain. No API keys, no subscriptions — pay-per-use at the HTTP layer.

→ [See the x402-stellar docs](sdk/x402-stellar/overview.md)

---

## Dashboard

If you want to use the full system without writing code, the AgentiCOcean **dashboard** at `localhost:3000` (or the hosted URL) lets you:

- Connect your Freighter wallet
- Create and fund your vault
- Register an AI agent on-chain
- Grant agents spending permissions
- Chat with the AI yield optimizer
- Monitor your portfolio and rebalance history

→ [Dashboard guide](dashboard/overview.md)

---

## Quick Example

```typescript
import { YieldOptimizer } from "@agenticocean/defi-agent";

const optimizer = new YieldOptimizer({
  stellarRpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  aiApiKey: "gsk_...",   // Groq, Claude, Gemini, or xAI key
  blendPoolId: "CCEB...",
});

const strategy = await optimizer.optimize(
  "Best yield for USDC with moderate risk",
  "moderate",
  1000
);

console.log(`${strategy.total_estimated_apy}% APY`);
strategy.strategies.forEach(s =>
  console.log(`  ${s.protocol}: ${s.allocation_pct}% @ ${s.estimated_apy}%`)
);
```

---

## Network

All packages work with **Stellar Testnet** out of the box. Mainnet is supported by switching the `stellarRpcUrl` and `networkPassphrase` fields.

| Network | RPC | Passphrase |
|---------|-----|------------|
| Testnet | `https://soroban-testnet.stellar.org` | `Test SDF Network ; September 2015` |
| Mainnet | `https://soroban-mainnet.stellar.org` | `Public Global Stellar Network ; September 2015` |
