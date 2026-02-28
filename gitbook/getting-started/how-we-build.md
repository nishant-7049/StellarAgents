# How We Build — Standards, Technology & Revenue

A concise breakdown of the three core things AgenticOcean is built on, the open standards we use, and how the project sustains itself.

---

## 1. ERC-8004 Explorer — On-Chain AI Agent Identity

### What is ERC-8004?

[ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) is an emerging agent identity standard that defines a way to register AI agents on-chain with a structured, queryable identity record — similar to how ERC-721 defines NFTs. Each registered agent gets:

- A **sequential numeric ID** (like an NFT token ID)
- An **`agentUri`** — a JSON document describing what the agent does, what it costs, and which LLM powers it
- An **owner** address (the human who deployed it)
- A **vault address** and **signer key** for autonomous fund management

We implement ERC-8004 on Stellar via the `AgentRegistry` Soroban smart contract. It is not a port of an Ethereum contract — it is a native Stellar/Soroban implementation of the same concept, adapted for Stellar's address model and Soroban's auth system.

### How we built the Explorer

The **ERC-8004 Explorer** (`/explorer`) is the public-facing interface to the `AgentRegistry` contract. Here is what powers it:

**On-chain data layer**
- `AgentRegistry` stores each agent's identity: name, owner, vault address, agent signer key, and `agentUri` (JSON capabilities + pricing + model)
- `GET /api/explorer/agents` — lists all registered agents, parses `agentUri`, and enriches each with reputation data
- `GET /api/explorer/agents/:id` — full agent profile including capabilities, pricing, LLM model, endpoint URLs, and decoded transaction history

**Activity feed**
- `GET /api/explorer/activity` — queries Horizon's operations endpoint for both the `VaultFactory` and `AgentRegistry` contract addresses, decodes each `invoke_host_function` operation into human-readable events (x402 payment, deposit, registration, etc.)
- Each event is colour-coded: green = x402 payment, indigo = registry event, amber = vault event

**Stats charts (agent profile page)**
- `GET /api/explorer/agents/:id/stats` reads up to 200 Horizon operations from the agent's vault address, groups by day, and returns 30-day query volume and USDC spend series
- When Horizon is unavailable (testnet downtime, local dev), the backend returns seeded mock data with an `isMock: true` flag and a "Demo data" badge in the UI — the UI always shows something useful

**Agent identity structure (the `agentUri` JSON)**
```json
{
  "capabilities": ["yield", "rebalancing"],
  "pricing": {
    "protocol": "x402",
    "amount": "100000",
    "asset": "USDC"
  },
  "model": "claude-sonnet-4-6",
  "version": "0.1.0",
  "endpoints": {
    "query": "https://api.agenticocean.xyz/api/yield/query"
  }
}
```

This makes every agent self-describing. Any client can read the registry, find an agent's price and endpoint, pay via x402, and consume the service — with no API keys or off-chain agreements needed.

---

## 2. x402 — HTTP-Native Micropayments

### What is x402?

x402 is an open HTTP payment protocol proposed by Coinbase. It revives the dormant HTTP `402 Payment Required` status code as a real machine-to-machine payment mechanism. The flow:

1. Client hits an API endpoint
2. Server returns `402` with a payment requirements object (amount, asset, where to pay)
3. Client builds a signed payment payload and retries the request with an `X-Payment` header
4. Server settles the payment on-chain, then processes the original request

No API keys. No subscriptions. Pay-per-use at the HTTP layer, settled in real USDC.

### Our implementation: `@agenticocean/x402-stellar`

The standard x402 spec is blockchain-agnostic. We implement it for Stellar using the **`stellar-vault` scheme** — our own extension on top of the base protocol:

| Standard x402 field | Our value |
|---------------------|-----------|
| `scheme` | `"stellar-vault"` |
| `network` | `"stellar:testnet"` or `"stellar:mainnet"` |
| `asset` | USDC SAC contract address |
| `payTo` | Facilitator's Stellar keypair (G...) |
| `amount` | Stroops (7 decimals, e.g. `100000` = 0.01 USDC) |

**What makes our scheme special** — instead of the client signing a raw token transfer, the client signs a `SorobanAuthorizationEntry` for `vault.agent_pay(agent, payTo, amount, memo)`. This means:

- The payment goes **from the agent's vault**, not a personal wallet
- The vault contract **enforces the daily spend limit** on every payment before any USDC moves
- The facilitator just fee-bumps and submits — they never touch USDC directly
- The vault owner can **revoke access** at any time by calling `remove_agent()`

**How settlement works end-to-end:**
```
1. Agent builds vault.agent_pay() tx, simulates on RPC
2. Agent signs the SorobanAuthorizationEntry with its signer key
3. Agent encodes everything as base64 JSON → X-Payment header
4. Server's x402 middleware decodes the header
5. Facilitator injects the signed auth entry, fee-bumps, submits to RPC
6. RPC polls until SUCCESS (up to 30s); returns success: false on timeout
7. 200 OK returned to agent with X-Payment-Response header (txHash)
```

**Security hardening on our `/settle` endpoint:**
- Zod strict schema validation (network enum, address regex, literal scheme)
- 10 USDC per-call cap (`MAX_SETTLE_AMOUNT_STROOPS`)
- `payTo` must be a keypair account (`G...`), not a contract — prevents contracts draining vaults
- Per-signer sliding-window rate limit (10 req/60s) with bounded memory cleanup
- HTTP 503 for retryable states (timeout, Horizon inconclusive, RPC TRY_AGAIN_LATER)

**Admin access via x402:** Even our own ops endpoints (`GET /admin/summaries`) require x402 payment. We issue a session token (`X-Admin-Session`) after the first successful payment, valid for a configurable TTL — so we pay once per session rather than on every page refresh.

---

## 3. DeFi Agent on Stellar — `@agenticocean/defi-agent`

### What it does

The AI yield optimizer reads **live on-chain rates** from Blend and Soroswap, generates an allocation strategy using any major LLM, and runs an autonomous rebalancer that keeps the vault's positions on-target.

### Protocols we integrate

| Protocol | Type | How we use it |
|----------|------|---------------|
| **Blend Protocol** | Lending (Stellar-native) | Read pool APYs via `@blend-capital/blend-sdk`; execute supply/withdraw via `vault.agent_pay()` |
| **Soroswap** | AMM DEX (Stellar-native) | Read LP pool APYs; swap quotes via `@soroswap/sdk` |
| **Ondo USDY** | RWA (US Treasuries) | Included in AI strategy context as a low-risk allocation option |
| **DeFindex** | Yield vaults (Stellar-native) | Included in AI strategy context as auto-compound option |

### The agent loop

```
Every 5 minutes (cron):
  1. Read current on-chain positions (Blend supply value + Soroswap LP value)
  2. Compare to target allocation from last AI strategy
  3. Gate 1: position age < MIN_POSITION_HOLD_HOURS? → skip
  4. Gate 2: expected APY improvement < MIN_APY_IMPROVEMENT_PCT? → skip
  5. Drift > driftThresholdPct? → execute rebalance
     → ALL withdrawals first (free up USDC)
     → THEN all supplies (deploy freed USDC)
     → Each action = vault.agent_pay() → x402 facilitator → on-chain

Every AI query (user-triggered via x402):
  1. Fetch live Blend + Soroswap rates
  2. Format as structured pool context block
  3. Call LLM with SYSTEM_PROMPT + live context
  4. Parse JSON strategy response
  5. Set new target allocation on rebalancer
```

### Multi-LLM support

The SDK auto-detects the provider from the API key prefix:
- `sk-ant-...` → Anthropic Claude (`claude-sonnet-4-6`)
- `AIza...` → Google Gemini (`gemini-2.0-flash-lite`)
- `gsk_...` → Groq / Llama (`llama-3.3-70b-versatile`)
- `xai-...` → xAI Grok (`grok-3-mini`)

No API key? Hardcoded fallback strategies are returned — the SDK never throws.

---

## Revenue Model

We have three revenue streams, all flowing through the same x402 infrastructure:

### 1. Per-query AI fee (primary)
Every yield strategy query costs **0.01 USDC** (configurable via `ADMIN_X402_PRICE_STROOPS`), settled on-chain via x402 from the agent's vault. The payment goes directly to our facilitator address. At scale:

| Daily queries | Monthly revenue |
|---------------|----------------|
| 100 | ~$3 |
| 1,000 | ~$30 |
| 10,000 | ~$300 |
| 100,000 | ~$3,000 |

This is intentionally low — the goal is volume, not per-unit margin. A well-running vault queries multiple times a day.

### 2. Protocol fee on rebalancing AUM (future)
As the rebalancer manages more vaults, we can charge a small basis-point fee on assets under management at rebalance time — settled through the same x402 flow, just a different `payTo` address and a larger `amount`. The vault's daily spend limit governs how much the agent can charge per 24h, so the vault owner always has a hard cap.

### 3. SDK / infrastructure licensing (B2B)
Teams that want to deploy their own agent infrastructure using our SDKs (`@agenticocean/defi-agent`, `@agenticocean/vault`, `@agenticocean/x402-stellar`) can pay a monthly flat fee for:
- A dedicated facilitator endpoint (instead of running their own)
- Priority RPC access
- Monitoring + alerting for their rebalancer

This is the highest-margin stream but requires sales/support. We start with self-serve and add this later.

### What we do NOT do
- No token launch
- No protocol governance fee (no DAO tax on yield)
- No custody — vaults are user-owned Soroban contracts, we never hold USDC
- No subscription wall — every feature works without paying us upfront; you only pay when the agent actually queries

---

## Standards Summary

| Standard | Description | Where we use it |
|----------|-------------|-----------------|
| **x402** | HTTP 402-based machine-to-machine micropayment protocol (Coinbase proposal) | All API endpoints: AI queries, admin ops, agent-to-service payments |
| **ERC-8004** | On-chain AI agent identity standard (sequential ID, agentUri, owner) | `AgentRegistry` Soroban contract + Explorer frontend |
| **Soroban auth** | Stellar's smart contract authorization model — `SorobanAuthorizationEntry` + `require_auth()` | Agent signing flow inside `vault.agent_pay()` |
| **SEP-41** | Stellar token interface standard (the USDC SAC is a SEP-41 token) | All USDC transfers inside `UserVault` |
| **Horizon API** | Stellar's historical transaction + operations API | Explorer activity feed, agent stats, payment history |
| **Soroban RPC** | Stellar's smart contract execution + simulation API | All vault interactions, x402 settlement, rebalancer |
