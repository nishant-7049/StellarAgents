# Architecture

How the three packages work together to form a complete agent-payment infrastructure on Stellar.

---

## System Overview

```
Your AI Agent (browser or backend)
        │
        │  1. Wants yield data (gated by x402)
        ▼
┌─────────────────────────────────────────┐
│         Your Backend API                 │
│  (Express + createX402Middleware)         │
│                                          │
│  • No payment header → 402 response      │
│  • Payment header present → verify +     │
│    settle, then serve the response        │
└──────────────┬──────────────────────────┘
               │
               │  2. POST /x402/settle
               ▼
┌─────────────────────────────────────────┐
│         x402 Facilitator                 │
│  (@agenticocean/x402-stellar)            │
│                                          │
│  • Decodes signed payment header         │
│  • Calls vault.agent_pay() on-chain      │
│  • Returns txHash on success             │
└──────────────┬──────────────────────────┘
               │
               │  3. agent_pay(agent, payTo, amount)
               ▼
┌─────────────────────────────────────────┐
│         UserVault (Soroban Contract)     │
│  (@agenticocean/vault)                   │
│                                          │
│  • Checks agent is authorized            │
│  • Checks daily spending limit           │
│  • Checks destination whitelist          │
│  • Transfers USDC from vault → service   │
└──────────────┬──────────────────────────┘
               │
               │  4. Agent now has yield data
               ▼
┌─────────────────────────────────────────┐
│         AI Yield Engine                  │
│  (@agenticocean/defi-agent)              │
│                                          │
│  • Reads Blend pool APYs                 │
│  • Reads Soroswap LP data               │
│  • Calls LLM for strategy               │
│  • Executes rebalancing                  │
└─────────────────────────────────────────┘
```

---

## The x402 Payment Flow

When an AI agent wants to query the yield optimizer:

1. **Agent sends request** — `GET /api/yield/query?q=best+yield`
2. **Server responds 402** — with payment requirements: amount, asset, payTo address
3. **Agent builds payment** — uses `buildX402Header()` to construct a signed Soroban auth entry authorizing `vault.agent_pay()`
4. **Agent resends request** — same request, but with `X-PAYMENT: <base64 payload>` header
5. **Server settles** — calls `settlePayment()` which submits the vault transaction on-chain
6. **USDC moves** — from agent's vault to the service provider
7. **200 OK** — yield strategy returned with `X-PAYMENT-RESPONSE: {txHash}`

The key insight: **the agent never holds funds directly**. All money lives in the smart vault, which enforces per-agent spending policies set by the vault owner.

---

## On-chain Contracts

Three Soroban contracts power the system:

### VaultFactory
Deploys individual `UserVault` instances for each user. One vault per user, deterministic address derived from the owner's public key.

### UserVault
The core smart account:
- Holds USDC on behalf of the owner
- Owner can register agents with daily spending limits and destination whitelists
- `agent_pay(agent, payTo, amount, memo)` — the x402 payment entry point
- Enforces: agent active, within daily limit, destination allowed, vault has balance

### AgentRegistry
On-chain AI agent identity (modeled after ERC-8004):
- Each registration gets a sequential NFT ID
- Stores agent metadata: name, capabilities, pricing, endpoint URL
- Publicly queryable so anyone can discover registered agents

---

## Data Flow: Yield Optimization

```
BlendClient.loadPool()          → Live APYs from Blend lending pool
SoroswapClient.getPools()       → Live LP APYs from Soroswap AMM
                    ↓
            Pool context string
                    ↓
        LLM (Claude/Groq/Gemini)
        "Given these rates and
        low risk tolerance..."
                    ↓
        Structured JSON strategy
        { strategies: [...], total_apy }
                    ↓
        Rebalancer.setTargets()
        (sets drift threshold monitoring)
```

---

## Security Model

| What | How |
|------|-----|
| Agent can't overspend | `daily_limit` enforced per 24h window, resets automatically |
| Agent can't pay wrong addresses | `allowed_destinations` whitelist on each policy |
| Vault owner can revoke | `remove_agent()` immediately deactivates the agent |
| No admin key needed for payments | Facilitator (not admin) submits agent_pay() with agent's signed auth entry |
| Immutable vault logic | Soroban contracts have no admin upgrade key |
