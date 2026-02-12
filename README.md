# AgentNet Stellar

**Give Your AI Agents a Wallet on Stellar**

AgentNet enables AI agents to autonomously pay for services using Stellar smart vaults with delegated spending controls, powered by the x402 payment protocol.

## Architecture

- **Smart Vaults** (Soroban) — Per-user C-accounts holding USDC with agent-delegated spending
- **Agent Registry** (Soroban) — ERC-8004 equivalent NFT registry for AI agent identity
- **x402 Payment Protocol** — HTTP 402-based micropayments for agent-to-service transactions
- **AI Yield Optimizer** — Claude-powered DeFi strategy engine using Blend + Soroswap
- **Rebalancer** — Automated portfolio rebalancing via cron

## Stack

| Layer | Technology |
|-------|-----------|
| Contracts | Soroban (Rust), soroban-sdk 22.0.0 |
| Backend | Express 5, TypeScript, Blend SDK, Soroswap SDK |
| Frontend | NextJS 15, Tailwind CSS v4, Freighter Wallet |
| AI | Claude API (Sonnet 4.5) |
| Network | Stellar Testnet |

## Getting Started

```bash
pnpm install
pnpm dev:backend   # starts on :3001
pnpm dev:web       # starts on :3000
```

## Built for

SDF Issue #633 — Stellar Hackathon, February 2026
