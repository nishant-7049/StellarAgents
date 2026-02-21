# AgenticOcean — AI Agent Wallets + x402 on Stellar

**Give your AI agents a wallet, an identity, and the ability to pay — on Stellar.**

AgenticOcean is a full-stack infrastructure platform that enables AI agents to autonomously manage DeFi positions, pay for services via HTTP micropayments, and maintain a verifiable on-chain identity — all on the Stellar blockchain.

---

## What It Does

| Layer | What it enables |
|-------|----------------|
| **Smart Vaults** | Per-user Soroban contracts holding USDC with fine-grained, per-agent daily spending limits |
| **Agent Registry** | SRC-8004 on-chain identity — each agent gets a sequential NFT-like ID and a unique ENS-style `@handle` |
| **x402 Protocol** | HTTP 402-based micropayments: agent sends a signed payment header, service settles on-chain atomically |
| **AI Yield Optimizer** | LLM-powered DeFi strategy engine reading live rates from Blend Protocol + Soroswap DEX |
| **Rebalancer** | Autonomous cron-based portfolio rebalancer that executes Blend supply/withdraw operations |
| **Reputation + Validation** | On-chain feedback and third-party validation registries for agent accountability |
| **ERC-8004 Explorer** | Real-time explorer with agent stats charts, decoded transaction history, and reputation |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AgenticOcean Platform                       │
├──────────────────────┬──────────────────────┬───────────────────┤
│  @agenticocean/      │  @agenticocean/      │  @agenticocean/   │
│  defi-agent v0.3.0   │  vault v0.1.0        │  x402-stellar     │
│                      │                      │    v1.0.0         │
│  • AI yield engine   │  • VaultFactory      │  • Header builder │
│  • Blend SDK client  │  • UserVault client  │  • Facilitator    │
│  • Soroswap client   │  • AgentRegistry     │  • Express middle │
│  • Multi-LLM support │  • ReputationReg.    │  • Payment types  │
│  • Rebalancer        │  • ValidationReg.    │                   │
└──────────────────────┴──────────────────────┴───────────────────┘
                              ↕ Soroban RPC / Horizon
┌─────────────────────────────────────────────────────────────────┐
│                    Soroban Smart Contracts (Rust)                │
│  VaultFactory · UserVault · AgentRegistry                        │
│  ReputationRegistry · ValidationRegistry                         │
└─────────────────────────────────────────────────────────────────┘
                         Stellar Testnet / Mainnet
```

---

## Monorepo Structure

```
StellarRiseInHackathon/
├── contracts/                  ← 5 Soroban smart contracts (Rust)
│   ├── vault-factory/          ← Deploys per-user UserVault instances
│   ├── user-vault/             ← Smart account: agent_pay(), deposit(), withdraw()
│   ├── agent-registry/         ← SRC-8004 identity + unique @handle system
│   ├── reputation-registry/    ← On-chain feedback and running averages
│   └── validation-registry/    ← Third-party validation requests
│
├── packages/                   ← Published TypeScript SDKs
│   ├── agent-ai/               ← @agenticocean/defi-agent v0.3.0
│   ├── vault/                  ← @agenticocean/vault v0.1.0
│   ├── x402-stellar/           ← @agenticocean/x402-stellar v1.0.0
│   └── shared/                 ← @agentnet/shared (internal types)
│
├── apps/
│   ├── backend/                ← Express 5 + TypeScript API (port 3001)
│   └── web/                    ← Next.js 15 frontend (port 3000)
│
├── gitbook/                    ← Documentation site (docsify → Vercel)
├── docs/                       ← x402 spec, testing guide
└── tests/                      ← Unit, integration, e2e test suites
```

---

## Smart Contracts

Five Soroban contracts deployed to Stellar Testnet (soroban-sdk `=25.0.2`):

| Contract | Address | Purpose |
|----------|---------|---------|
| VaultFactory | `CASU6R7UN2ZOO46WQA6T7TNKIUJK75MNJB2KJFRVMI6FAZHQKUN6CDTW` | Deploys per-user vaults |
| UserVault WASM | hash `27b91b68...` | Smart USDC account with `agent_pay()` |
| AgentRegistry | `CC7CSOZE2KA2WVSFIQPJKGNHCETOKK4UCEHT66CGXLNA5ECA4HHPHH7V` | SRC-8004 agent identity + handles |
| ReputationRegistry | `CDC4EGENNTNK5LVBSIHCGMZMPQQQ27FPT4CESNN5G7WZCZBUVRC6HJIZ` | On-chain feedback system |
| ValidationRegistry | `CC66BNPZXYYZQFPQHEEHHYLCWA7CWAKSNVJ5UDLTX32URXCOCVUADY3P` | Third-party validation |

### Key contract feature — Agent handles

The `AgentRegistry` now implements an ENS-like unique handle system. Each agent claims a globally unique `@handle` at registration time (first-come, first-served):

```
register(owner, name, "stellar-yield-bot", agentUri, vault, signer)
           ↑              ↑ handle — 3-32 chars, a-z/0-9/hyphen, unique
```

Handles are resolvable on-chain: `get_agent_by_handle("stellar-yield-bot")` → `AgentInfo`.

---

## SDK Packages

### `@agenticocean/defi-agent` v0.3.0

AI-powered yield optimizer supporting **multiple LLM providers** — provider is auto-detected from the API key prefix:

| Key prefix | Provider |
|-----------|---------|
| `sk-ant-` | Anthropic Claude |
| `AIza` | Google Gemini |
| `gsk_` | Groq |
| `xai-` | xAI Grok |

```typescript
import { YieldOptimizer } from "@agenticocean/defi-agent";

const optimizer = new YieldOptimizer({
  stellarRpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  aiApiKey: process.env.AI_API_KEY,   // Claude, Gemini, Groq, or xAI key
  blendPoolId: "CCB...",
});

const strategy = await optimizer.optimize("Best USDC yield with moderate risk", "moderate", 1000);
console.log(`${strategy.total_estimated_apy}% APY`);
```

### `@agenticocean/vault` v0.1.0

TypeScript client for all five Soroban contracts:

```typescript
import { AgentRegistry, VaultFactory, UserVault } from "@agenticocean/vault";

// Resolve an agent by handle
const registry = new AgentRegistry(REGISTRY_ADDRESS, stellarConfig);
const agent = await registry.getAgentByHandle("stellar-yield-bot");

// Check handle availability
const available = await registry.isHandleAvailable("my-agent");
```

### `@agenticocean/x402-stellar` v1.0.0

x402 payment protocol for Stellar — build payment headers agent-side, settle on-chain server-side:

```typescript
// Agent side — build the X-PAYMENT header
import { buildX402Header } from "@agenticocean/x402-stellar";
const header = await buildX402Header({ vaultContract, agentSignerSecret, payTo, amount });

// Server side — gate a route with the middleware
import { createX402Middleware } from "@agenticocean/x402-stellar";
app.use("/api/yield/query", createX402Middleware({ price: "100000", asset: "USDC" }));
```

---

## Backend API

Express 5 server with 17 route modules:

| Route | Description |
|-------|-------------|
| `GET /health` | Server status + contract addresses |
| `GET /api/agents` | List registered agents from on-chain |
| `GET /api/agents/:id` | Single agent detail |
| `GET /api/vaults/:owner` | Vault balance + agent policies |
| `GET /api/yield/query` ⚡ | **x402-gated** AI yield strategy (0.01 USDC/query) |
| `POST /api/yield/query` ⚡ | Same via POST body |
| `GET /api/explorer/agents` | Explorer agent list with parsed metadata |
| `GET /api/explorer/agents/:id` | Full agent profile |
| `GET /api/explorer/agents/:id/stats` | Daily query/USDC stats (last 30 days) |
| `GET /api/explorer/activity` | Decoded global on-chain activity feed |
| `GET /api/portfolio` | Portfolio positions and APY data |
| `GET /api/reputation/:id/summary` | Agent reputation summary |
| `GET /api/reputation/:id/feedback` | Paginated feedback entries |
| `GET /api/validation/:id` | Validation records for an agent |
| `GET /api/stats` | Platform-wide statistics |
| `GET /api/events` | Soroban event stream |
| `POST /api/x402/settle` | Manually settle an x402 payment |
| `POST /api/tx/build` | Build + simulate a Soroban transaction |
| `GET /api/credits` | Credit balance for a wallet |
| `POST /api/rebalance/trigger` | Manual rebalance trigger |

---

## Frontend

Next.js 15 (App Router) with 10 dashboard pages:

| Page | Route | What it does |
|------|-------|-------------|
| Landing | `/` | Marketing page — architecture, pricing, CTA |
| Dashboard | `/app` | Overview — vault stats, agent status, APY |
| Vault | `/vault` | Create vault, deposit/withdraw USDC, manage agents |
| Agents | `/agents` | Agent marketplace — browse by capability |
| Chat | `/chat` | AI yield query — pays via x402, shows strategy cards |
| Portfolio | `/portfolio` | Deployed positions, earnings, rebalance history |
| Register | `/register` | Register agent with unique `@handle` |
| History | `/history` | Transaction history with Stellar Expert links |
| Explorer | `/explorer` | ERC-8004 explorer — all agents + global activity |
| Explorer detail | `/explorer/:id` | Agent profile: stats charts, action breakdown, tx history |
| Credits | `/credits` | Credit balance and top-up |

### Explorer feature highlights

The `/explorer/:id` agent profile page includes:
- **4 stats cards** — Total Queries, USDC Paid, Days Active, Avg/Day
- **Bar chart** — Daily query volume over last 30 days (recharts)
- **Area chart** — USDC spent via x402 over last 30 days (recharts)
- **Action breakdown** — Animated progress bars by payment memo type
- **Rich transaction history** — Decoded human-readable descriptions, colored by type
- **Reputation panel** — Star rating, score bar, individual review cards

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Contracts | Soroban (Rust), soroban-sdk `=25.0.2` |
| Contract tests | `cargo test --workspace` (21+ tests) |
| Backend | Express 5, TypeScript ESM, Winston, Zod |
| Database | MongoDB / Mongoose |
| DeFi | `@blend-capital/blend-sdk`, `@soroswap/sdk` |
| Billing | Stripe |
| Frontend | Next.js 15, Tailwind CSS v4, Freighter API |
| Charts | Recharts |
| AI | Claude / Gemini / Groq / xAI (auto-detected) |
| Network | Stellar Testnet (Mainnet-ready) |
| Docs | Docsify → Vercel ([agenticoceandocs.vercel.app](https://agenticoceandocs.vercel.app)) |
| Package manager | pnpm 10 + Turborepo |

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm 10
- Rust + `wasm32-unknown-unknown` target (for contract builds)
- Freighter browser extension (for frontend testing)

### Install

```bash
pnpm install
```

### Run

```bash
pnpm dev:backend   # Express API on :3001
pnpm dev:web       # Next.js on :3000
```

### Build contracts

```bash
cd contracts && cargo build --release --target wasm32-unknown-unknown
```

### Test contracts

```bash
cd contracts && cargo test --workspace
```

### Build SDKs

```bash
pnpm build:sdk
```

### Environment

Copy `.env.example` in `apps/backend/` and fill in:

```bash
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
AGENT_REGISTRY_ADDRESS=CC7CSOZE2KA2WVSFIQPJKGNHCETOKK4UCEHT66CGXLNA5ECA4HHPHH7V
VAULT_FACTORY_ADDRESS=CASU6R7UN2ZOO46WQA6T7TNKIUJK75MNJB2KJFRVMI6FAZHQKUN6CDTW
USDC_SAC_ADDRESS=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
FACILITATOR_SECRET_KEY=S...
AI_API_KEY=...   # sk-ant-, AIza, gsk_, or xai- prefix — provider auto-detected
```

---

## Documentation

Full SDK and dashboard documentation: **[agenticoceandocs.vercel.app](https://agenticoceandocs.vercel.app)**

Local: `gitbook/` folder (docsify — open `index.html` or run any static server).

| Doc | Location |
|-----|----------|
| SDK reference | [agenticoceandocs.vercel.app/sdk/defi-agent/overview](https://agenticoceandocs.vercel.app/#/sdk/defi-agent/overview) |
| Dashboard guide | [agenticoceandocs.vercel.app/dashboard/overview](https://agenticoceandocs.vercel.app/#/dashboard/overview) |
| x402 spec | `docs/x402-stellar-spec.md` |
| Deployment record | `DEPLOYMENT.md` |
| Test flow | `TEST_FLOW.md` |

---

## Built for

SDF Issue #633 — Stellar Hackathon, February 2026
