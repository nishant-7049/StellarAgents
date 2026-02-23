# YieldOptimizer

The main entry point for AI-powered yield strategy generation. Wraps data fetching, LLM calling, JSON parsing, and rebalancer wiring into a single `optimize()` call.

---

## Basic Usage

```typescript
import { YieldOptimizer } from "@agenticocean/defi-agent";

const optimizer = new YieldOptimizer({
  stellarRpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
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

## Internal Pipeline — what `optimize()` actually does

Every call to `optimize()` runs this exact sequence:

```
Step 1: Fetch data in parallel
  ├── BlendClient.loadPool()          → live APYs, utilization per reserve
  └── SoroswapClient.getPools()       → LP pool APYs

Step 2: formatPoolContext()
  Converts the raw data into a plain-text block, e.g.:
  ┌──────────────────────────────────────────────────────┐
  │ === BLEND PROTOCOL (Lending) ===                     │
  │   USDC: Supply APY 7.2% | Borrow APY 9.8% | Util 67%│
  │   XLM:  Supply APY 4.1% | Borrow APY 6.5% | Util 40%│
  │                                                      │
  │ === SOROSWAP (AMM DEX) ===                           │
  │   USDC/XLM: LP APY ~12.5%                           │
  │                                                      │
  │ === RWA YIELDS ===                                   │
  │   Ondo USDY: 4.8% (US Treasury-backed)              │
  │   Centrifuge deJTRSY: 4.5%                          │
  │                                                      │
  │ === DEFINDEX VAULTS ===                              │
  │   Auto-Compound Blend Vault: ~9.1%                  │
  │   Multi-Strategy Vault: ~11.3%                      │
  └──────────────────────────────────────────────────────┘

Step 3: Call LLM
  system: SYSTEM_PROMPT  (the protocol rules + JSON schema)
  user:   buildUserPrompt(query, poolContext, risk, amount)
          → 'User query: "safe yield"
             Risk tolerance: low
             Amount to allocate: 1000 USDC

             LIVE POOL DATA:
             [context block from step 2]

             Generate the optimal allocation strategy as JSON.'

Step 4: parseJson()
  Extracts the first {...} block from the LLM response.
  Throws if no JSON found → falls back to hardcoded strategy.

Step 5: Wire into rebalancer (if configured)
  If vaultContract + agentSignerSecret are set:
    → reads current on-chain positions (readCurrentPortfolio)
    → sets rebalancer targets with real currentPct values
    → rebalancer is now ready to drift-check on its next tick
```

---

## The System Prompt

The LLM receives this system prompt on every call (exported as `SYSTEM_PROMPT`):

```
You are a DeFi yield optimization AI for Stellar blockchain.
You analyze live pool data from Blend Protocol, Soroswap DEX, DeFindex vaults, and RWA tokens
(Ondo USDY, Centrifuge deRWAs) to recommend optimal yield strategies.

RESPOND WITH ONLY A JSON OBJECT (no markdown, no explanation outside JSON):
{
  "strategies": [
    {
      "protocol": "Protocol Name",
      "action": "What to do (e.g. 'Supply USDC to Blend Fixed V2')",
      "allocation_pct": 35.0,
      "estimated_apy": 7.2,
      "risk_level": "low|moderate|high",
      "details": "Brief explanation including risk factors"
    }
  ],
  "total_estimated_apy": 8.1,
  "summary": "2-3 sentence strategy summary"
}

RULES:
- allocation_pct values MUST sum to exactly 100
- Max 5 strategies
- low risk: favor USDY, Blend fixed pools, stablecoin LPs
- moderate: mix lending, auto-compound vaults, small LP allocation
- high: heavier LP, multi-strategy vaults, leveraged if available
- Always include at least one low-risk component
- Consider impermanent loss risk for AMM positions
- Factor in BLND emission rewards for Blend pools
```

The live pool data from step 2 is injected into the **user** message, not the system prompt — so the LLM always sees fresh rates, not stale ones from training data.

---

## `optimize(query, riskTolerance, amount?)`

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

Each item in `strategies`:

```typescript
{
  protocol: string;        // "Blend Fixed V2", "Ondo USDY", "Soroswap USDC/XLM", etc.
  action: string;          // "Supply USDC", "Hold USDY", "Provide LP"
  allocation_pct: number;  // 0-100, all items sum to 100
  estimated_apy: number;   // percentage (e.g., 7.2 means 7.2%)
  risk_level: "low" | "moderate" | "high";
  details: string;         // brief explanation of the position
}
```

---

## Risk Profiles

### `"low"` — Capital preservation
Favors: RWA tokens (Ondo USDY), stable lending pools (Blend fixed), stablecoin LP pairs (USDC/EURC). Target APY: 5–7%.

### `"moderate"` — Balanced
Favors: DeFindex auto-compound vaults, Blend lending, small LP allocation. Target APY: 7–10%.

### `"high"` — Yield maximization
Favors: Multi-strategy vaults, Soroswap LP pairs, Blend yield-boost pools. Target APY: 10–13%.

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

## Customizing Strategies

### Change LLM rules

`SYSTEM_PROMPT` is exported. Override the rules block to change LLM behavior:

```typescript
import { YieldOptimizer, buildUserPrompt } from "@agenticocean/defi-agent";

// Subclass to inject a custom system prompt
class MyOptimizer extends YieldOptimizer {
  // The optimizer uses SYSTEM_PROMPT internally.
  // To override: pass a custom prompt via your own LLM wrapper
  // and call setTargetAllocation() on the rebalancer yourself.
}
```

The cleanest approach for a fully custom strategy is to **skip `optimize()`** and use the data layer directly:

```typescript
import { BlendClient, SoroswapClient, Rebalancer } from "@agenticocean/defi-agent";

const blend = new BlendClient(config);
const soroswap = new SoroswapClient(config);

// 1. Fetch your own data
const pool = await blend.loadPool();
const pools = await soroswap.getPools();

// 2. Apply your own strategy logic (rules-based, ML model, or LLM)
const myTargets = myStrategy(pool, pools);

// 3. Set targets on the rebalancer directly
const rebalancer = new Rebalancer(blend, soroswap, {
  driftThresholdPct: 5,
  agentSignerSecret: process.env.AGENT_SIGNER_SECRET_KEY,
  vaultContract: process.env.VAULT_CONTRACT,
  facilitatorUrl: process.env.FACILITATOR_URL,
});
rebalancer.setTargetAllocation(myTargets);

// 4. Execute
await rebalancer.checkAndRebalance();
```

### Add a new protocol to the pool context

`formatPoolContext()` is a private method, but you can replicate and extend it:

```typescript
function myFormatPoolContext(blend, soroswap, aquariusPools) {
  const lines = [];
  // existing sources
  lines.push("=== BLEND PROTOCOL ===");
  for (const r of blend.reserves) {
    lines.push(`  ${r.symbol}: Supply APY ${r.supplyApy.toFixed(1)}% | Util ${(r.utilization*100).toFixed(0)}%`);
  }
  // Add your new protocol
  lines.push("\n=== AQUARIUS ===");
  for (const pool of aquariusPools) {
    lines.push(`  ${pool.pair}: Bribe APY ~${pool.briberApy}%`);
  }
  return lines.join("\n");
}
```

Then pass this custom context in your own `buildUserPrompt()` call to whatever LLM you use.

### Change the fallback (no-AI) strategies

The hardcoded fallbacks are inside `fallbackStrategy()` in `yield-optimizer.ts`. If you're extending the SDK, override this method in a subclass. If you're using the backend reference implementation directly, edit `apps/backend/src/defi/rebalancer.ts` — the backend's `queryAIWithX402()` function constructs the same fallback strategies independently.

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
  stellarRpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
});
// Returns hardcoded moderate strategy
const strategy = await optimizer.optimize("best yield", "moderate");
```

---

## With Rebalancer Integration

When `vaultContract` and `agentSignerSecret` are set, `optimize()` automatically reads the current on-chain portfolio and wires new targets into the rebalancer:

```typescript
const optimizer = new YieldOptimizer({
  stellarRpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
  aiApiKey: process.env.AI_API_KEY,
  blendPoolId: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
  usdcAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  vaultContract: process.env.VAULT_CONTRACT,
  agentSignerSecret: process.env.AGENT_SIGNER_SECRET_KEY,
  facilitatorUrl: "http://localhost:3001",
});

// 1. Generates strategy AND wires rebalancer targets
const strategy = await optimizer.optimize("maximize yield", "high", 5000);

// 2. The rebalancer is now ready — call it on a schedule
const rebalancer = optimizer.getRebalancer();
setInterval(async () => {
  const result = await rebalancer.checkAndRebalance();
  if (result.executedActions.length > 0) {
    console.log("Rebalanced:", result.executedActions);
  }
}, 5 * 60 * 1000); // every 5 minutes
```
