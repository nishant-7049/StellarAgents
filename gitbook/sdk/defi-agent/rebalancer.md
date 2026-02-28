# Rebalancer

Monitors your portfolio's actual on-chain allocations and executes rebalancing transactions when drift from your target exceeds a configurable threshold. All fund movements are authorized by the agent's signing key and enforced by the UserVault contract — no admin/owner key is ever needed.

---

## How it works — full execution flow

```
checkAndRebalance()
│
├─ 1. readCurrentPortfolio(vault)
│    ├── BlendClient.loadUserPosition(vault)
│    │     → Blend SDK reads bToken balances on-chain
│    │     → converts to USDC value using oracle prices
│    └── SoroswapClient.loadLPPosition(vault)
│          → reads LP token balance
│          → estimates USDC value from reserves
│
├─ 2. For each AllocationTarget: compute drift
│    drift = |currentPct - targetPct|
│    If drift ≤ driftThresholdPct → skip
│    If drift >  driftThresholdPct → queue action
│       delta < 0 → over-allocated → WITHDRAW
│       delta > 0 → under-allocated → SUPPLY
│
├─ 3. Execute ALL withdrawals first
│    (reduces over-allocated positions to free up USDC)
│    For Blend targets:
│      usdcAmount = |delta| / 100 * totalUSDC
│      stroops    = usdcAmount * 1e7
│      BlendClient.executeViaVault({
│        poolId, agentSignerSecret, vaultContract,
│        asset, amount: stroops, facilitatorUrl,
│        memo: "rebalance_withdraw"
│      })
│      → builds vault.agent_pay() authorization entry
│      → signs with agentSignerSecret
│      → POST {facilitatorUrl}/api/x402/settle
│      → facilitator fee-bumps + submits to Soroban RPC
│      → vault.agent_pay() runs on-chain:
│          checks agent is active + within daily limit
│          transfers USDC from vault to Blend pool
│
└─ 4. Execute ALL supplies
     (same flow as withdrawals, memo: "rebalance_supply")
```

Withdrawals always run before supplies. This prevents "insufficient balance" failures when moving USDC from one over-allocated protocol to an under-allocated one.

---

## Important limitations (current)

- **Only Blend execution is implemented.** Targets for other protocols (e.g., Soroswap LP) are logged as "not executable via vault agent_pay" and **skipped** — they're tracked in the strategy but no on-chain action is taken. Adding Soroswap execution requires implementing `executeViaVault()` in `SoroswapClient`.
- **Execution requires a working facilitator endpoint.** `facilitatorUrl` must point to a running instance of `POST /api/x402/settle` (the reference backend).

---

## Usage

### Standalone

```typescript
import { BlendClient, SoroswapClient, Rebalancer } from "@agenticocean/defi-agent";

const config = {
  stellarRpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
  blendPoolId: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
  usdcAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
};

const blend = new BlendClient(config);
const soroswap = new SoroswapClient(config);

const rebalancer = new Rebalancer(blend, soroswap, {
  driftThresholdPct: 5,             // rebalance if any position drifts more than 5%
  agentSignerSecret: process.env.AGENT_SIGNER_SECRET_KEY,
  vaultContract: "C...YOUR_VAULT...",
  facilitatorUrl: "http://localhost:3001",
});
```

### Via YieldOptimizer (recommended)

```typescript
import { YieldOptimizer } from "@agenticocean/defi-agent";

const optimizer = new YieldOptimizer({
  ...config,
  aiApiKey: process.env.AI_API_KEY,
  agentSignerSecret: process.env.AGENT_SIGNER_SECRET_KEY,
  vaultContract: "C...YOUR_VAULT...",
  facilitatorUrl: "http://localhost:3001",
});

// optimize() sets the rebalancer targets automatically
await optimizer.optimize("maximize yield", "moderate", 1000);

const rebalancer = optimizer.getRebalancer();

// Then run on a schedule
setInterval(() => rebalancer.checkAndRebalance(), 5 * 60 * 1000);
```

---

## Methods

### `readCurrentPortfolio(vaultAddress)`

Reads the vault's current on-chain positions across Blend and Soroswap.

```typescript
const snapshot = await rebalancer.readCurrentPortfolio("C...VAULT...");
console.log(`Total USDC: ${snapshot.totalUSDC}`);
snapshot.positions.forEach(p => {
  console.log(`  ${p.protocol}: $${p.usdcValue.toFixed(2)} (${p.pct.toFixed(1)}%)`);
});
```

**Returns: `PortfolioSnapshot`**

```typescript
{
  totalUSDC: number;
  positions: Array<{
    protocol: "blend" | "soroswap";
    poolId: string;      // pool/pair contract address
    usdcValue: number;   // current value in USDC
    pct: number;         // percentage of total (0-100)
  }>;
}
```

---

### `setTargetAllocation(targets)`

Sets the target allocation percentages. The rebalancer drift-monitors against these.

```typescript
rebalancer.setTargetAllocation([
  { protocol: "blend",    asset: "USDC_ADDRESS", targetPct: 70, currentPct: 0 },
  { protocol: "soroswap", asset: "USDC_ADDRESS", targetPct: 30, currentPct: 0 },
]);
```

`currentPct` is updated automatically by `checkAndRebalance()` before comparing — it reads actual on-chain positions and overwrites whatever you passed here.

---

### `checkAndRebalance()`

Reads the current portfolio, checks drift vs targets, and executes rebalancing if needed.

```typescript
const result = await rebalancer.checkAndRebalance();

result.executedActions.forEach(a => {
  console.log(`${a.protocol} ${a.type}: txHash=${a.txHash}`);
});
```

**Returns: `RebalanceResult`**

```typescript
{
  executedActions: Array<{
    protocol: string;       // "blend" | "soroswap"
    type: "supply" | "withdraw";
    txHash: string;         // confirmed on-chain tx hash
  }>;
}
```

An empty `executedActions` means either:
- Portfolio is within threshold (no drift)
- `agentSignerSecret` or `vaultContract` not configured (execution skipped)
- All drifted targets are for protocols not yet executable (e.g., Soroswap)

---

### `getTargetAllocation()`

Returns the current target allocation (whatever was set by `setTargetAllocation()`):

```typescript
const targets = rebalancer.getTargetAllocation();
```

---

### `getRebalanceCount()`

How many times `checkAndRebalance()` has completed (including no-op checks):

```typescript
console.log(`Ran ${rebalancer.getRebalanceCount()} checks`);
```

---

## RebalancerOptions

```typescript
interface RebalancerOptions {
  driftThresholdPct: number;  // drift % that triggers a rebalance (e.g., 5 = 5%)
  agentSignerSecret?: string; // agent signer secret key — authorized on the vault
  vaultContract?: string;     // UserVault contract address
  facilitatorUrl?: string;    // facilitator base URL (POST /api/x402/settle)
}
```

---

## x402 Payment Flow — what happens on-chain

Every Blend supply or withdraw goes through the vault's `agent_pay()` function via x402:

```
Rebalancer
  → BlendClient.executeViaVault()
      → builds Soroban tx: vault.agent_pay(agent, blendPool, amount, "rebalance_supply")
      → simulates the tx on RPC to get footprint + auth structure
      → agent signs the SorobanAuthorizationEntry (agentSignerSecret)
      → POSTs to {facilitatorUrl}/api/x402/settle:
          {
            x402Version: 1,
            scheme: "stellar-vault",
            network: "stellar:testnet",
            payload: {
              vaultContract,
              agentSigner,
              payTo: blendPoolContract,
              amount: "5000000000",    // 500 USDC in stroops
              signedAuthEntry: "...",  // base64 XDR
              ...
            }
          }
      → facilitator fee-bumps + submits to RPC
      → waits for confirmation (up to 30s)
      → returns { success: true, txHash: "abc..." }

On-chain (UserVault contract):
  agent_pay() is called:
    ✓ agent is registered and active?
    ✓ amount <= daily limit?
    ✓ blendPool is in allowed_destinations? (if whitelist set)
    → USDC.transfer(vault → blendPool, amount)
    → emits agent_pay event with memo + nonce
```

This means:
- No owner key on the server — only the agent key
- Vault owner can revoke access at any time by calling `remove_agent()`
- Daily spend limit on the agent policy bounds total rebalancing cost

---

## Setting Up Automated Rebalancing

Run `checkAndRebalance()` on a cron schedule. The reference backend uses `node-cron`:

```typescript
import cron from "node-cron";

// Every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  const result = await rebalancer.checkAndRebalance();
  if (result.executedActions.length > 0) {
    console.log("Rebalanced:", result.executedActions);
  }
});
```

---

## Adding a New Protocol (e.g., Soroswap execution)

Currently only Blend execution is implemented. To add Soroswap LP execution:

1. **Add `executeViaVault()` to `SoroswapClient`** — similar to `BlendClient.executeViaVault()`, but building a Soroswap `swap()` or `add_liquidity()` invocation instead of a Blend `submit()`.

2. **Add a case in `checkAndRebalance()`** — inside the `toSupply` loop, add:

```typescript
} else if (target.protocol === "soroswap") {
  const result = await this.soroswapClient.executeViaVault({
    pairAddress: target.poolId,
    agentSignerSecret,
    vaultContract,
    asset: target.asset,
    amount: stroops,
    facilitatorUrl: url,
    memo: "rebalance_supply_lp",
  });
  executed.push({ protocol: "soroswap", type: "supply", txHash: result.txHash });
}
```

3. **Register the Soroswap pair contract as an allowed destination** in the UserVault's agent policy (via `add_agent()` with `allowed_destinations` set).

No other changes needed — the vault's `agent_pay()` and the x402 settlement flow are the same for any destination.

---

## Adding Gate Logic (hold time, min improvement)

If you want to add guards before `checkAndRebalance()` executes, wrap it:

```typescript
async function gatedRebalance(rebalancer, portfolioService, wallet) {
  const portfolio = await portfolioService.getPortfolio(wallet);

  // Gate 1: minimum hold time
  if (portfolio?.positions?.length > 0) {
    const oldestPosition = Math.min(...portfolio.positions.map(p => new Date(p.deployedAt).getTime()));
    const ageHours = (Date.now() - oldestPosition) / (1000 * 60 * 60);
    if (ageHours < 6) {
      console.log(`Skipping: positions only ${ageHours.toFixed(1)}h old (min 6h)`);
      return;
    }
  }

  // Gate 2: minimum APY improvement
  const currentApy = computeCurrentWeightedApy(portfolio);
  const targetApy  = computeTargetWeightedApy(rebalancer.getTargetAllocation());
  if (targetApy - currentApy < 0.25) {
    console.log(`Skipping: improvement ${(targetApy - currentApy).toFixed(2)}% < 0.25% threshold`);
    return;
  }

  // Gates passed — execute
  return rebalancer.checkAndRebalance();
}
```

The reference backend (`apps/backend/src/defi/rebalancer.ts`) implements exactly this pattern with `MIN_POSITION_HOLD_HOURS` and `MIN_APY_IMPROVEMENT_PCT` env vars.
