# Rebalancer

Monitors your portfolio's actual on-chain allocations and executes rebalancing transactions when the drift from your target exceeds a configurable threshold.

## How it works

1. **Read current portfolio** — queries Blend position (supply - borrow) and Soroswap LP position for the vault
2. **Compare to targets** — calculates drift percentage for each protocol
3. **Check threshold** — if any position drifts more than `driftThresholdPct`, rebalance is triggered
4. **Execute in order** — withdraws first, then supplies (to avoid balance issues)

## Usage

### Standalone

```typescript
import { BlendClient, SoroswapClient, Rebalancer } from "@agenticocean/defi-agent";

const config = {
  stellarRpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  blendPoolId: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
  usdcAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  agentSignerSecret: process.env.AGENT_SIGNER_SECRET_KEY,
  vaultContract: "C...YOUR_VAULT...",
  facilitatorUrl: "http://localhost:3001",
};

const blend = new BlendClient(config);
const soroswap = new SoroswapClient(config);

const rebalancer = new Rebalancer(blend, soroswap, {
  driftThresholdPct: 5,  // rebalance if any position drifts more than 5%
});
```

### Via YieldOptimizer

```typescript
import { YieldOptimizer } from "@agenticocean/defi-agent";

const optimizer = new YieldOptimizer({
  ...config,
  agentSignerSecret: process.env.AGENT_SIGNER_SECRET_KEY,
  vaultContract: "C...YOUR_VAULT...",
});

// Calling optimize() automatically sets the rebalancer's targets
await optimizer.optimize("balanced yield", "moderate", 1000);

// The rebalancer targets are now set — call checkAndRebalance() periodically
const rebalancer = optimizer.getRebalancer();
const result = await rebalancer.checkAndRebalance("C...YOUR_VAULT...");
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

Sets the target allocation percentages. The rebalancer will drift-monitor against these.

```typescript
rebalancer.setTargetAllocation([
  { protocol: "blend",    asset: "USDC_ADDRESS", targetPct: 70, currentPct: 0 },
  { protocol: "soroswap", asset: "USDC_ADDRESS", targetPct: 30, currentPct: 0 },
]);
```

`currentPct` is updated automatically by `checkAndRebalance()` before comparing.

---

### `checkAndRebalance(vaultAddress)`

Reads the current portfolio, checks drift vs targets, and executes rebalancing if needed.

```typescript
const result = await rebalancer.checkAndRebalance("C...VAULT...");

if (result.rebalanced) {
  console.log(`Rebalanced! APY improved by ${result.netApyChange}%`);
  console.log(`Transactions: ${result.txHashes.join(", ")}`);
} else {
  console.log(`No rebalance needed: ${result.reason}`);
}
```

**Execution order:**
1. All **withdrawals** are executed first (reduces over-allocated positions)
2. All **supplies** are executed next (increases under-allocated positions)

This prevents "insufficient balance" errors when moving funds from one protocol to another.

---

## RebalancerOptions

```typescript
interface RebalancerOptions {
  driftThresholdPct: number;  // percentage drift that triggers rebalance (e.g., 5 = 5%)
}
```

---

## Setting Up Automated Rebalancing

For a backend server, run `checkAndRebalance()` on a cron schedule:

```typescript
import cron from "node-cron";

// Every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  const result = await rebalancer.checkAndRebalance(VAULT_ADDRESS);
  if (result.rebalanced) {
    console.log("Rebalanced:", result);
  }
});
```

The vault's `agent_pay()` function handles payment for each rebalance action via the x402 protocol — the agent signs each transaction using `agentSignerSecret`, and the facilitator submits the fee-bumped transaction.

---

## x402 Payment for Rebalancing

Each rebalance action goes through the vault's `agent_pay()`:

```
Rebalancer → builds vault.agent_pay() invocation
           → signs SorobanAuthorizationEntry (agentSignerSecret)
           → sends to facilitator (facilitatorUrl/x402/settle)
           → facilitator submits fee-bumped tx to Soroban RPC
           → USDC transfers from vault to protocol
```

This means:
- No admin key needed on the server
- The vault owner can revoke the rebalancer's access at any time by removing the agent
- Daily spending limits on the agent policy prevent runaway rebalancing
