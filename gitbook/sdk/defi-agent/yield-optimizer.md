# YieldOptimizer

The main entry point for AI-powered yield strategy generation.

## Basic Usage

```typescript
import { YieldOptimizer } from "@agenticocean/defi-agent";

const optimizer = new YieldOptimizer({
  stellarRpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  aiApiKey: process.env.AI_API_KEY,
  blendPoolId: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
  usdcAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
});

const strategy = await optimizer.optimize(
  "I want safe yield with minimal risk",
  "low",    // risk tolerance: "low" | "moderate" | "high"
  1000      // optional: USDC amount for projected earnings
);
```

---

## `optimize(query, riskTolerance, amount?)`

Generates a yield strategy by:
1. Fetching live APYs from Blend and Soroswap
2. Formatting pool data as structured context
3. Calling your LLM with the query + live data
4. Parsing + validating the JSON strategy response

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | Natural language query (e.g., "safe yield for USDC") |
| `riskTolerance` | `string` | Yes | `"low"`, `"moderate"`, or `"high"` |
| `amount` | `number` | No | USDC amount — used for projected monthly/yearly return |

### Returns: `StrategyResponse`

```typescript
{
  query: string;
  risk_tolerance: string;
  amount_usdc?: number;
  strategies: YieldStrategy[];      // array of allocation targets
  total_estimated_apy: number;      // weighted average APY
  summary: string;                  // human-readable explanation
  data_sources: {
    blend_pools: number;
    soroswap_pools: number;
    rwa_sources: number;
  };
  disclaimer: string;
}
```

### `YieldStrategy`

Each item in the `strategies` array:

```typescript
{
  protocol: string;        // "Blend Fixed V2", "Ondo USDY", "Soroswap USDC/XLM", etc.
  action: string;          // "Supply USDC", "Hold USDY", "Provide LP"
  allocation_pct: number;  // 0-100, all items sum to 100
  estimated_apy: number;   // percentage (e.g., 7.2)
  risk_level: "low" | "moderate" | "high";
  details: string;         // brief explanation of the position
}
```

---

## Risk Profiles

### `"low"` — Capital preservation
Prioritizes: RWA tokens (Ondo USDY), stable lending pools (Blend fixed), stablecoin LP pairs (USDC/EURC). Target APY: 5–7%.

### `"moderate"` — Balanced
Prioritizes: DeFindex auto-compound vaults, Blend lending, small LP allocation. Target APY: 7–10%.

### `"high"` — Yield maximization
Prioritizes: Multi-strategy vaults, Soroswap LP pairs, Blend yield-boost pools. Target APY: 10–13%.

---

## Protocol Coverage

The optimizer knows about these Stellar DeFi protocols:

| Protocol | Type | Risk | Notes |
|----------|------|------|-------|
| Blend Fixed V2 | Lending | Low | Immutable pool, backstop protection |
| Ondo USDY | RWA | Low | US Treasury-backed, ~4.8% APY |
| Centrifuge deJTRSY | RWA | Low | Institutional debt, ~4.5% APY |
| DeFindex Auto-Compound | Vault | Moderate | Auto-compounds Blend + BLND rewards |
| DeFindex Multi-Strategy | Vault | High | Blend + Soroswap + Aquarius |
| Soroswap USDC/XLM | AMM LP | High | Fee revenue, impermanent loss risk |

---

## Access to Clients

`YieldOptimizer` exposes its internal clients for direct use:

```typescript
const blend = optimizer.getBlendClient();
const soroswap = optimizer.getSoroswapClient();
const rebalancer = optimizer.getRebalancer(); // null if no agentSignerSecret
```

---

## Fallback Behavior

If no `aiApiKey` is set (or if the API call fails), `optimize()` returns a hardcoded fallback strategy for the requested risk level. This means the SDK always returns a usable result — never throws.

```typescript
// Works without any API key
const optimizer = new YieldOptimizer({
  stellarRpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
});
// Returns hardcoded moderate strategy
const strategy = await optimizer.optimize("best yield", "moderate");
```

---

## With Rebalancer Integration

When `vaultContract` and `agentSignerSecret` are set, `optimize()` automatically updates the rebalancer's target allocation after generating the strategy:

```typescript
const optimizer = new YieldOptimizer({
  stellarRpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  aiApiKey: process.env.AI_API_KEY,
  vaultContract: "C...YOUR_VAULT...",
  agentSignerSecret: process.env.AGENT_SIGNER_SECRET_KEY,
});

// This will:
// 1. Generate the strategy (as normal)
// 2. Read current on-chain positions
// 3. Set drift-based rebalancing targets
const strategy = await optimizer.optimize("maximize yield", "high", 5000);
```
