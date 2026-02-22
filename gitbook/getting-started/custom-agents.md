# Building Custom Agents (Rebalancing Strategy)

You can build your own autonomous agent on top of the AgenticOcean SDKs by customizing **when** the agent rebalances and **what** allocation targets it chooses.

This page explains the recommended extension points and how to observe what your agent is doing.

---

## What you can customize

- **Decision policy** (your “strategy”): how targets are chosen (LLM-driven, rules-based, external signals, etc.)
- **Gates**: minimum hold time, minimum expected improvement, max rebalances/day, max spend/day
- **Execution scope**: which protocols you allow the agent to execute on-chain (e.g., Blend-only today)
- **Observability**: how you record actions, tx hashes, and portfolio snapshots

---

## Recommended control loop

Your agent loop should follow this structure:

1. **Read portfolio state**
   - Prefer on-chain reads where possible (vault balance + protocol positions)
   - Reconcile tracked state if it drifts from on-chain reality
2. **Decide targets**
   - Use an LLM strategy (`YieldOptimizer.optimize()`) or your own rules engine
3. **Apply gates**
   - Skip if the portfolio is too “fresh” (e.g., < 6 hours)
   - Skip if expected improvement is too small (e.g., < 0.25%)
4. **Execute**
   - Execute only the protocols you support safely (Blend execution is implemented; others can be tracked-only)
5. **Record**
   - Record *after* you have tx hashes (and ideally after confirmation)

---

## Example: strategy + Blend-only execution

```ts
import { YieldOptimizer, BlendClient, SoroswapClient, Rebalancer } from "@agenticocean/defi-agent";

const config = {
  stellarRpcUrl: process.env.STELLAR_RPC_URL!,
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE!,
  aiApiKey: process.env.AI_API_KEY,
  usdcAddress: process.env.USDC_ADDRESS!,
  blendPoolId: process.env.BLEND_POOL_ID!,
};

const blend = new BlendClient(config);
const soroswap = new SoroswapClient({ ...config, soroswapApiKey: process.env.SOROSWAP_API_KEY });

const rebalancer = new Rebalancer(blend, soroswap, {
  driftThresholdPct: 0, // if you already decided to rebalance, execute immediately
  agentSignerSecret: process.env.AGENT_SIGNER_SECRET_KEY,
  vaultContract: process.env.VAULT_CONTRACT,
  facilitatorUrl: process.env.FACILITATOR_URL, // expects POST /api/x402/settle
});

const optimizer = new YieldOptimizer(config, rebalancer);

// 1) Decide targets via AI
const strategy = await optimizer.optimize("optimize yield for my USDC", "moderate", 1000);

// 2) Map to executable targets (Blend-only for now)
const targets = strategy.strategies
  .filter(s => s.protocol.toLowerCase().includes("blend"))
  .map(s => ({ protocol: "blend", asset: config.usdcAddress, targetPct: s.allocation_pct, currentPct: 0 }));

rebalancer.setTargetAllocation(targets);

// 3) Execute
const result = await rebalancer.checkAndRebalance();
console.log("Executed actions:", result.executedActions);
```

---

## Observability: how to see what your agent did

In the reference backend, portfolio state is exposed via:

- `GET /api/portfolio/:wallet` — aggregated portfolio view (vault balance + tracked positions + PnL)

For deeper observability, record:

- **Every tx hash** submitted by the agent (x402 payments and execution txs)
- **Before/after allocations** (protocolKey + amountUsdc + allocationPct)
- **Decision metadata**: reason, expected APY, thresholds used, and whether any protocols were “tracked-only”

---

## Current protocol support

- **Blend**: on-chain reads supported; autonomous execution supported via vault-based agent signing + facilitator submission
- **Soroswap**: quotes + LP position reads supported; autonomous LP execution is not yet implemented in the reference rebalancer

