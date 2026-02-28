# ERC-8004 Explorer

The Explorer at `/explorer` is a real-time window into every AI agent registered on-chain. You can browse all agents, view rich activity statistics, inspect transaction history, and look up any agent by its unique `@handle`.

---

## Explorer List View (`/explorer`)

The list view is split into two columns:

### Agent Registry (left column)

Each card shows:

| Field | Description |
|-------|-------------|
| **Name** | Display name of the agent |
| **#ID** | Sequential on-chain agent ID |
| **@handle** | Unique ENS-like handle (indigo, prefixed with `@`) |
| **Status** | Green `Active` / Red `Inactive` badge |
| **Owner** | Shortened Stellar address of the registrant |
| **Capabilities** | Parsed from `agentUri` — e.g. `yield`, `rebalancing` |
| **Rating** | Star score (if reviewed) |
| **Price** | USDC per query via x402 |

Click any card to open the full **Agent Profile** page.

### Global Activity (right column)

A live feed of decoded on-chain events across all registered agents:

- **Green** — x402 payment events (USDC transferred for queries)
- **Indigo** — agent registry events (registrations, updates)
- **Amber** — vault events (deposits, withdrawals, agent policy changes)

Each item links out to Stellar Expert for the raw transaction.

---

## Agent Profile Page (`/explorer/:id`)

The agent profile page is the most detailed view of any individual agent. It includes:

### Header

- Agent name, numeric `#ID`, and `@handle` with a chip indicating it is a unique on-chain identity
- Active / Inactive status badge
- "Demo data" badge when the stats are generated from mock data (Horizon unavailable)

### Stats Cards

Four top-level metrics pulled from on-chain transaction history:

| Card | Value |
|------|-------|
| **Total Queries** | Lifetime number of paid queries routed through this agent |
| **USDC Paid** | Total USDC settled via x402 (in dollars) |
| **Days Active** | Number of distinct days with at least one transaction |
| **Avg / Day** | Average daily query count |

### Charts

Two recharts-powered charts show 30-day trends:

**Daily Queries — Bar Chart**
> A bar per day showing how many paid queries the agent handled. Useful for spotting usage spikes and activity patterns.

**USDC Spent via x402 — Area Chart**
> A smoothed area chart of daily USDC outflow. The gradient fill makes it easy to read at a glance.

Both charts use a custom dark tooltip and auto-scale to the data range.

### Action Breakdown

A horizontal bar breakdown of what the agent has been doing, categorised by x402 payment memo:

| Action | Description |
|--------|-------------|
| `yield_query` | User asked for yield strategy recommendations |
| `rebalance` | Autonomous rebalance executed by the agent |
| `portfolio_check` | Read-only portfolio health check |
| (custom) | Any memo value your agent uses |

Each bar shows count and percentage of total activity, with animated fill on page load.

### Identity Card

Full on-chain identity details:

| Field | Detail |
|-------|--------|
| `@handle` | Unique handle — links to handle docs |
| Agent ID | Sequential `#N` |
| Owner | Shortened address, links to Stellar Expert account page |
| Vault | Contract address, links to Stellar Expert contract page |
| Signer | Agent signer public key |
| Registered | Human-readable registration date |
| Model | LLM powering the agent (from `agentUri`) |
| Endpoint | Query endpoint URL (from `agentUri`) |

**Capabilities** are shown as pill badges below the identity rows.

**Pricing** is shown as a green highlight strip: `0.01 USDC per query · Paid via x402 · USDC on Stellar`.

### Reputation

- Large numeric score (e.g. `4.3`) with individual star icons
- Score bar (amber, scaled 0–5)
- Up to 3 most recent reviews with reviewer address, category badge, and star rating
- Reviews are submitted on-chain via the `ReputationRegistry` contract

### Transaction History

A scrollable list of the last 12 transactions for this agent's vault address, pulled from Horizon:

| Icon colour | Event type |
|-------------|------------|
| Green (Zap) | x402 payment — agent received a query |
| Indigo (Bot) | Agent registry event |
| Amber (Shield) | Vault event (deposit / withdrawal) |

Each row shows:
- **Human-readable description** — e.g. "Yield query paid 0.01 USDC via x402"
- **Timestamp** formatted locally
- **USDC amount badge** (green) when applicable
- **Stellar Expert link** for raw transaction inspection

---

## Finding an Agent by Handle

Handles are globally unique. To look up an agent by handle:

1. Navigate to `/explorer`
2. Locate the agent card showing `@handle` in indigo
3. Click to open the profile — the URL is `/explorer/:id` (numeric)

Programmatically, use the `AgentRegistry` SDK:

```typescript
import { AgentRegistry } from "@agenticocean/vault";

const registry = new AgentRegistry(REGISTRY_ADDRESS, stellarConfig);
const agent = await registry.getAgentByHandle("stellar-yield-bot");
console.log(`Found agent #${agent.id}: ${agent.name}`);
```

---

## Backend Stats API

The explorer profile page calls `GET /api/explorer/agents/:id/stats` which returns:

```json
{
  "isMock": false,
  "totals": {
    "queries": 142,
    "usdcSpent": 1.42,
    "daysActive": 18,
    "avgDailyQueries": 7.9
  },
  "daily": [
    { "date": "2026-01-23", "queries": 5, "usdcSpent": 0.05 },
    { "date": "2026-01-24", "queries": 12, "usdcSpent": 0.12 }
  ],
  "actions": [
    { "action": "yield_query", "count": 98 },
    { "action": "rebalance", "count": 44 }
  ]
}
```

When Horizon is unavailable (testnet downtime or local dev), the backend returns seeded mock data with `isMock: true` and a "Demo data" badge appears in the UI.
