# AgenticOcean — Pitch Deck

## 4-Minute Presentation

---

## SLIDE 1 — Title

**AgenticOcean**

> AI Agents with Wallets on Stellar

**ERC-8004 · x402 · DeFi Agent**

- **ERC-8004** — On-chain identity & discovery for AI agents
- **x402** — Pay-per-use HTTP micropayments in USDC, no API keys
- **DeFi Agent** — Autonomous yield optimizer & rebalancer on Stellar

---

## SLIDE 2 — The Problem

**Current AI agents can't handle money**

- AI agents can generate strategies — but can't _execute_ them
- No on-chain identity → can't be trusted or discovered
- API keys for every service → friction, billing walls, no composability
- DeFi yields change constantly → manual rebalancing = leaving money on the table

---

## SLIDE 3 — Our Solution

**Three primitives that solve this**

|     | What                                    | Standard               |
| --- | --------------------------------------- | ---------------------- |
| 🪪   | On-chain agent identity + explorer      | ERC-8004               |
| 💳  | Pay-per-use HTTP micropayments          | x402                   |
| 🤖  | Autonomous yield optimizer + rebalancer | Blend + Soroswap + LLM |

> An AI agent that has its own wallet, pays for its own intelligence, and manages DeFi positions — autonomously

---

## SLIDE 4 — ERC-8004 Explorer

**On-chain identity for every AI agent**

- Each agent registered on-chain gets: **numeric ID**, **owner**, **vault address**, **`@handle`**
- `agentUri` JSON stores: capabilities, price per query, LLM model, API endpoint — fully self-describing
- Any client can discover the agent, its price, and its endpoint from the registry — **no off-chain agreements**
- **Explorer UI** shows: all registered agents, live activity feed (payments, registrations, vault events), 30-day usage charts, reputation scores
- Built on `AgentRegistry` Soroban smart contract — our native Stellar implementation of ERC-8004

---

## SLIDE 5 — x402 HTTP Payments

**Pay-per-use, settled in USDC, no API keys**

- x402 is an open Coinbase protocol — brings `402 Payment Required` to life for machine-to-machine payments
- **Our extension (`stellar-vault` scheme):** agent signs a `vault.agent_pay()` authorization instead of a raw token transfer
- The **UserVault contract** enforces every payment: agent active? within daily limit? destination allowed? → then USDC transfers
- Vault owner can **revoke agent access anytime** — one contract call
- **Security hardening:** Zod schema validation · 10 USDC per-call cap · `payTo` must be keypair account · per-signer rate limit · HTTP 503 for retryable errors
- Pay-once **session tokens** for admin endpoints — no paying on every page refresh

---

## SLIDE 6 — AI DeFi Agent

**Autonomous yield optimization on Stellar**

- Reads **live rates** from Blend (lending) and Soroswap (AMM) — always fresh, never cached in the prompt
- Calls any major LLM (Claude, Gemini, Groq, xAI) — **auto-detected from API key prefix**
- Returns a structured JSON allocation strategy: protocol · % allocation · APY · risk level
- **Autonomous rebalancer runs every 5 minutes:**
  - Gate 1: position < 6h old → skip
  - Gate 2: APY improvement < 0.25% → skip
  - Drift detected → withdraw over-allocated first, then supply under-allocated
  - Every action goes through `vault.agent_pay()` → x402 → on-chain
- Records every decision (reason, APY delta, tx hashes) — full observability

---

## SLIDE 7 — Standards We Use on Stellar

**Built on open standards**

| Standard         | What it is                                                     | Where we use it                      |
| ---------------- | -------------------------------------------------------------- | ------------------------------------ |
| **ERC-8004**     | On-chain AI agent identity (numeric ID, agentUri, owner)       | AgentRegistry contract + Explorer    |
| **x402**         | HTTP micropayment protocol — `402 Payment Required` (Coinbase) | Every paid API endpoint              |
| **SEP-41**       | Stellar token interface standard (USDC SAC = SEP-41 token)     | All USDC transfers inside UserVault  |
| **SEP-10**       | Stellar Web Authentication — wallet-based auth                 | Frontend wallet connect (Freighter)  |
| **Soroban auth** | Stellar's delegated smart contract authorization model         | `vault.agent_pay()` agent signing    |
| **Horizon API**  | Stellar's historical transaction + operations API              | Explorer activity feed + agent stats |

---

## SLIDE 8 — Revenue Model

**Three streams, all on-chain**

- **① Per-query AI fee** — 0.01 USDC per yield strategy query via x402 · configurable · no billing system needed
- **② Rebalancing fee** — small basis-point fee on AUM at each rebalance · capped by vault's daily spend limit
- **③ Infrastructure licensing** — teams pay flat monthly fee to use our hosted facilitator + SDK support

> We never hold user funds · No token · No DAO tax · Every payment settled directly on-chain
