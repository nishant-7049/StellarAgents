# Dashboard Overview

The AgenticOcean dashboard is a web interface that lets you manage your AI agent infrastructure without writing any code.

**URL:** `http://localhost:3000` (local) or your deployed URL

---

## Navigation

The sidebar gives you access to all features:

| Page | URL | What you do there |
|------|-----|-------------------|
| Dashboard | `/app` | Overview — vault stats, agent status, quick actions |
| Vault | `/app/vault` | Create vault, deposit USDC, manage agents |
| Agents | `/app/agents` | Browse registered agents, see capabilities and pricing |
| Chat | `/app/chat` | Ask the AI yield optimizer — pay per query via x402 |
| Portfolio | `/app/portfolio` | See deployed positions, earnings, rebalance history |
| Register | `/app/register` | Register your AI agent on-chain |
| History | `/app/history` | Transaction history for your vault |

---

## Prerequisites

1. **Freighter wallet** — install the [Freighter browser extension](https://freighter.app) and create or import a Stellar account
2. **Testnet XLM** — for testnet development, fund your Freighter account via [Stellar Friendbot](https://friendbot.stellar.org/?addr=YOUR_ADDRESS)
3. **USDC** — on testnet, use the setup script; on mainnet, deposit real USDC into your vault

---

## Typical Workflow

### As a vault owner (funding an agent)

1. [Connect wallet](connect-wallet.md)
2. [Create a vault](create-vault.md) — one-time setup
3. Deposit USDC into the vault
4. [Register your agent](register-agent.md) — give it an on-chain identity
5. [Grant the agent access](agent-access.md) — set daily spending limit
6. [Chat with the AI](chat.md) — the agent pays via x402

### As a developer (integrating an existing agent)

1. Deploy your service behind `createX402Middleware`
2. Register your agent in the registry (dashboard or API)
3. Set up a vault with your agent's signer key authorized
4. Your agent calls `buildX402Header` before each paid request

---

## Dashboard Summary Stats

The main dashboard (`/app`) shows:

- **Vault Balance** — total USDC in your vault
- **Active Agents** — number of authorized agent addresses
- **Weighted APY** — estimated yield on deployed funds
- **Total Earned** — USDC earned since strategy deployment
- **Recent Activity** — last transactions and rebalances

---

## Testnet vs Mainnet

The dashboard connects to **Stellar Testnet** by default. The network indicator in the top right shows the current network. Testnet transactions have no real-world value — ideal for development and demos.

For mainnet, set `NEXT_PUBLIC_STELLAR_NETWORK=mainnet` and follow the [Mainnet guide](../getting-started/mainnet.md).
