<div align="center">
  <img src="public/favicon.png" alt="AgenticOcean" width="80" />
  <h1>AgenticOcean</h1>
  <p><strong>AI Agent Wallets, Identity & Autonomous DeFi on Stellar</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Network: Mainnet](https://img.shields.io/badge/Stellar-Mainnet-brightgreen)](https://stellar.org)
  [![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
  [![pnpm](https://img.shields.io/badge/pnpm-10-orange)](https://pnpm.io)
</div>

---

## Overview

AgenticOcean is a full-stack infrastructure platform that gives AI agents a **wallet**, an **on-chain identity**, and the ability to **pay autonomously** on the Stellar blockchain.

Built on Soroban smart contracts, it enables AI agents to manage DeFi positions, settle HTTP micropayments via the x402 protocol, and maintain a verifiable identity — all on **Stellar Mainnet**.

---

## Key Features

- **Smart Vaults** — Per-user Soroban contracts holding USDC with fine-grained, per-agent daily spending limits
- **Agent Registry** — On-chain identity (SRC-8004): each agent gets a sequential NFT-like ID and a unique `@handle`
- **x402 Protocol** — HTTP 402-based micropayments: agent sends a signed payment header, service settles on-chain atomically
- **AI Yield Optimizer** — LLM-powered strategy engine reading live rates from Blend Protocol and Soroswap DEX
- **Autonomous Rebalancer** — Cron-based portfolio rebalancer that executes Blend supply/withdraw operations
- **Reputation & Validation** — On-chain feedback and third-party validation registries for agent accountability
- **Agent Explorer** — Real-time explorer with stats charts, decoded transaction history, and reputation scores

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       AgenticOcean Platform                       │
├──────────────────────┬───────────────────────┬───────────────────┤
│  @agenticocean/      │  @agenticocean/       │  @agenticocean/   │
│  defi-agent          │  vault                │  x402-stellar     │
│                      │                       │                   │
│  • AI yield engine   │  • VaultFactory       │  • Header builder │
│  • Blend SDK client  │  • UserVault client   │  • Facilitator    │
│  • Soroswap client   │  • AgentRegistry      │  • Express middle │
│  • Multi-LLM support │  • ReputationReg.     │  • Payment types  │
│  • Rebalancer        │  • ValidationReg.     │                   │
└──────────────────────┴───────────────────────┴───────────────────┘
                              ↕ Soroban RPC / Horizon
┌──────────────────────────────────────────────────────────────────┐
│                   Soroban Smart Contracts (Rust)                  │
│   VaultFactory · UserVault · AgentRegistry                        │
│   ReputationRegistry · ValidationRegistry                         │
└──────────────────────────────────────────────────────────────────┘
                           Stellar Mainnet
```

---

## Smart Contracts — Mainnet

All contracts are deployed and verified on **Stellar Mainnet**:

| Contract | Address |
|---|---|
| VaultFactory | `CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM` |
| AgentRegistry | `CDKHR3UUKCKXJ6CRKWKUZI3SKWAAKJMU6TGHRBM2VJJBCKEO6ETH55AU` |
| ReputationRegistry | `CB6B4EBQ3JXLGUWF5WGMQV63PL3K2WQP5LMEL2BZDIDTEPCIC5BDH6ZB` |
| ValidationRegistry | `CDX65CKW2NZQZK5U7DQRK6KVOBI4PTLQVGHYAEQ7OPPY2KRCDUAS2AL5` |
| USDC SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

---

## Published SDKs

| Package | Version | Description |
|---|---|---|
| [`@agenticocean/vault`](https://www.npmjs.com/package/@agenticocean/vault) | `0.1.1` | TypeScript client for all five Soroban contracts |
| [`@agenticocean/x402-stellar`](https://www.npmjs.com/package/@agenticocean/x402-stellar) | `1.0.1` | x402 payment protocol — header builder, facilitator, Express middleware |
| [`@agenticocean/defi-agent`](https://www.npmjs.com/package/@agenticocean/defi-agent) | `0.3.1` | AI yield optimizer, Blend client, Soroswap client, autonomous rebalancer |

### Quick install

```bash
npm install @agenticocean/vault @agenticocean/x402-stellar @agenticocean/defi-agent
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Soroban (Rust), `soroban-sdk = 25.0.2` |
| Backend | Express 5, TypeScript ESM, Winston, Zod |
| Database | MongoDB / Mongoose |
| DeFi | `@blend-capital/blend-sdk`, Soroswap API |
| AI | Claude / Gemini / Groq / xAI (auto-detected from key prefix) |
| Billing | Stripe |
| Frontend | Next.js 15 (App Router), Tailwind CSS v4, Freighter API |
| Charts | Recharts |
| Network | Stellar Mainnet |
| Package Manager | pnpm 10 |

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm 10
- [Freighter](https://freighter.app) browser extension (for wallet connection)

### Install

```bash
pnpm install
```

### Environment

Create a `.env` file in the backend root:

```env
# Stellar Network
STELLAR_RPC_URL=https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"

# Contract Addresses (mainnet)
VAULT_FACTORY_ADDRESS=CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM
AGENT_REGISTRY_ADDRESS=CDKHR3UUKCKXJ6CRKWKUZI3SKWAAKJMU6TGHRBM2VJJBCKEO6ETH55AU
REPUTATION_REGISTRY_ADDRESS=CB6B4EBQ3JXLGUWF5WGMQV63PL3K2WQP5LMEL2BZDIDTEPCIC5BDH6ZB
VALIDATION_REGISTRY_ADDRESS=CDX65CKW2NZQZK5U7DQRK6KVOBI4PTLQVGHYAEQ7OPPY2KRCDUAS2AL5
USDC_SAC_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

# Keys
ADMIN_SECRET_KEY=S...
FACILITATOR_SECRET_KEY=S...
AGENT_SIGNER_SECRET_KEY=S...

# AI — provider auto-detected from key prefix
# sk-ant-* → Anthropic Claude | AIza* → Google Gemini | gsk_* → Groq | xai-* → xAI
AI_API_KEY=...

# Database
MONGODB_URI=mongodb://localhost:27017/agenticocean

# Stripe (optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend URL (for Stripe redirects)
FRONTEND_URL=http://localhost:3000
```

For the frontend, create a `.env.local` file:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_VAULT_FACTORY_ADDRESS=CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=CDKHR3UUKCKXJ6CRKWKUZI3SKWAAKJMU6TGHRBM2VJJBCKEO6ETH55AU
NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS=CB6B4EBQ3JXLGUWF5WGMQV63PL3K2WQP5LMEL2BZDIDTEPCIC5BDH6ZB
NEXT_PUBLIC_VALIDATION_REGISTRY_ADDRESS=CDX65CKW2NZQZK5U7DQRK6KVOBI4PTLQVGHYAEQ7OPPY2KRCDUAS2AL5
NEXT_PUBLIC_USDC_SAC_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

### Run

```bash
# Backend (port 3001)
pnpm dev

# Frontend (port 3000) — from frontend directory
pnpm dev
```

### Build

```bash
pnpm build
```

---

## Frontend Pages

| Page | Route | Description |
|---|---|---|
| Landing | `/` | Marketing — architecture, features, pricing, CTA |
| Dashboard | `/app` | Overview — vault stats, agent status, live APY |
| Vault | `/vault` | Create vault, deposit/withdraw USDC, manage agent access |
| Agents | `/agents` | Agent marketplace — browse by capability and reputation |
| Chat | `/chat` | AI yield query — pays via x402, shows live strategy cards |
| Portfolio | `/portfolio` | Deployed positions, earnings, rebalance history |
| Register | `/register` | Register an agent with a unique `@handle` |
| History | `/history` | Transaction history with Stellar Expert links |
| Explorer | `/explorer` | On-chain explorer — all agents and global activity |
| Explorer Detail | `/explorer/:id` | Agent profile: stats charts, tx history, reputation |
| Credits | `/credits` | Credit balance — top up via USDC or Stripe |

---

## API Reference

The backend exposes 20+ REST endpoints on port `3001`:

| Endpoint | Description |
|---|---|
| `GET /health` | Server status and contract addresses |
| `GET /api/agents` | List all registered agents |
| `GET /api/agents/:id` | Single agent by token ID |
| `GET /api/vaults/:owner` | Vault balance and agent policies |
| `GET /api/yield/query` ⚡ | **x402-gated** AI yield strategy (0.01 USDC/query) |
| `GET /api/explorer/agents` | Explorer listing with parsed metadata |
| `GET /api/explorer/agents/:id/stats` | Daily query/USDC stats (last 30 days) |
| `GET /api/explorer/activity` | Decoded global on-chain activity feed |
| `GET /api/portfolio` | Portfolio positions and APY data |
| `GET /api/reputation/:id/summary` | Agent reputation summary |
| `GET /api/stats` | Platform-wide statistics |
| `POST /api/rebalance/trigger` | Trigger manual portfolio rebalance |
| `GET /api/credits` | Credit balance for a wallet |
| `POST /api/credits/stripe/checkout` | Create Stripe checkout session |
| `POST /api/credits/stripe/verify-session` | Award credits after Stripe payment |
| `POST /api/x402/settle` | Settle an x402 micropayment |
| `POST /api/tx/build` | Build and simulate a Soroban transaction |

---

## How x402 Works

```
AI Agent                    AgenticOcean API              Stellar Network
   │                               │                             │
   │  GET /api/yield/query         │                             │
   │──────────────────────────────▶│                             │
   │                               │                             │
   │       402 Payment Required    │                             │
   │       X-Payment-Required: ... │                             │
   │◀──────────────────────────────│                             │
   │                               │                             │
   │  Build X-PAYMENT header       │                             │
   │  (sign with agent key)        │                             │
   │                               │                             │
   │  GET /api/yield/query         │                             │
   │  X-PAYMENT: <signed header>   │                             │
   │──────────────────────────────▶│                             │
   │                               │  Submit agent_pay() tx      │
   │                               │────────────────────────────▶│
   │                               │                             │
   │                               │  Confirmed ✓                │
   │                               │◀────────────────────────────│
   │                               │                             │
   │       200 OK + strategy       │                             │
   │◀──────────────────────────────│                             │
```

---

## Documentation

Full SDK and dashboard docs: **[agenticoceandocs.vercel.app](https://agenticoceandocs.vercel.app)**

| Section | Link |
|---|---|
| SDK — defi-agent | [/sdk/defi-agent/overview](https://agenticoceandocs.vercel.app/#/sdk/defi-agent/overview) |
| SDK — vault | [/sdk/vault/overview](https://agenticoceandocs.vercel.app/#/sdk/vault/overview) |
| SDK — x402-stellar | [/sdk/x402-stellar/overview](https://agenticoceandocs.vercel.app/#/sdk/x402-stellar/overview) |
| Dashboard guide | [/dashboard/overview](https://agenticoceandocs.vercel.app/#/dashboard/overview) |

---

## Built For

**SDF Issue #633 — Stellar Rise Hackathon, February 2026**
