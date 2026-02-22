# @agenticocean/defi-agent

AI-powered DeFi yield optimization for the Stellar blockchain. Query live rates from Blend and Soroswap, generate allocation strategies with any major LLM, and run an autonomous rebalancer that keeps your portfolio on-target.

---

## When to use this SDK

Use `@agenticocean/defi-agent` when you want:

- A **structured yield strategy** response (`optimize()` returns a JSON allocation plan)
- Live on-chain inputs from **Blend** and **Soroswap**
- A lightweight **rebalancer loop** (drift monitoring + on-chain Blend execution)
- A drop-in AI layer you can plug a **different LLM into** without changing anything else

## Install

```bash
npm install @agenticocean/defi-agent
```

---

## Architecture — how it all fits together

```
┌─────────────────────────────────────────────────────────────┐
│                      YieldOptimizer                         │
│                                                             │
│  1. BlendClient.loadPool()   → live APYs, utilization       │
│  2. SoroswapClient.getPools() → LP pool APYs                │
│  3. formatPoolContext()       → structured text block       │
│  4. LLM call (Claude/Gemini/Groq/Grok)                      │
│     system: SYSTEM_PROMPT (the rules)                       │
│     user:   "query" + poolContext + risk + amount           │
│  5. parseJson()               → YieldStrategy[]             │
│  6. Rebalancer.setTargetAllocation() ← auto-wired           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ strategy result
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Rebalancer                           │
│                                                             │
│  (runs on its own schedule — every 5 min in the backend)    │
│                                                             │
│  1. readCurrentPortfolio(vault)                             │
│     → BlendClient.loadUserPosition()                        │
│     → SoroswapClient.loadLPPosition()                       │
│  2. Compare currentPct vs targetPct for each protocol       │
│  3. drift > driftThresholdPct? → execute                    │
│  4. Withdrawals first, then supplies (order matters)        │
│  5. Execution via BlendClient.executeViaVault()             │
│     → builds x402 payment payload                           │
│     → POST {facilitatorUrl}/api/x402/settle                 │
│     → vault.agent_pay() runs on-chain                       │
│     → USDC moves vault → Blend pool                         │
└─────────────────────────────────────────────────────────────┘
```

No admin key ever leaves your server. Every on-chain action is authorized by the **agent's signing key** (`AGENT_SIGNER_SECRET_KEY`) and enforced by the **UserVault contract** — which checks daily limits and allowed destinations before any USDC moves.

---

## What's included

| Export | Description |
|--------|-------------|
| `YieldOptimizer` | Main entry point — fetches live rates + calls LLM for strategy |
| `BlendClient` | Reads Blend lending pool data; builds supply/withdraw operations |
| `SoroswapClient` | Gets Soroswap swap quotes and LP positions |
| `Rebalancer` | Monitors drift vs target allocation; executes via vault |
| `SYSTEM_PROMPT` | The default LLM system prompt (exported — can be replaced) |
| `buildUserPrompt` | Builds the per-request user prompt with live pool context |

## Type exports

| Type | Description |
|------|-------------|
| `AgentAIConfig` | Main config object passed to all classes |
| `YieldStrategy` | Single protocol allocation in a strategy |
| `StrategyResponse` | Full response from `YieldOptimizer.optimize()` |
| `BlendPoolData` | Pool data returned from `BlendClient.loadPool()` |
| `UserBlendPosition` | User's current Blend supply/borrow position |
| `SwapQuote` | Quote returned from `SoroswapClient.getQuote()` |
| `PortfolioSnapshot` | Current on-chain portfolio (blend + soroswap positions) |
| `AllocationTarget` | Target allocation for rebalancer |
| `RebalancerOptions` | Config for the Rebalancer class |
| `RebalanceResult` | Result of `checkAndRebalance()` — executed tx hashes |

---

## Multi-LLM Support

Pass a single `aiApiKey` — the SDK detects the provider automatically from the key prefix:

| Prefix | Provider | Model used |
|--------|----------|-----------|
| `sk-ant-...` | Anthropic Claude | `claude-sonnet-4-6` |
| `AIza...` | Google Gemini | `gemini-2.0-flash-lite` |
| `gsk_...` | Groq (Llama) | `llama-3.3-70b-versatile` |
| `xai-...` | xAI Grok | `grok-3-mini` |

No `aiApiKey`? The optimizer falls back to hardcoded strategies based on risk tolerance, so it works without an LLM key for demos and testing.

---

## AgentAIConfig

All classes accept the same config object:

```typescript
interface AgentAIConfig {
  // Required
  stellarRpcUrl: string;          // "https://soroban-testnet.stellar.org"
  networkPassphrase: string;      // "Test SDF Network ; September 2015"

  // AI provider (auto-detected from prefix)
  aiApiKey?: string;              // gsk_..., sk-ant-..., AIza..., xai-...

  // DeFi protocol addresses
  usdcAddress?: string;           // USDC SAC contract address
  blendPoolId?: string;           // Blend lending pool contract address

  // Rebalancer / x402
  agentSignerSecret?: string;     // Secret key for signing rebalance transactions
  vaultContract?: string;         // Your UserVault contract address
  facilitatorUrl?: string;        // x402 facilitator endpoint

  // Optional: Soroswap API key for live swap quotes
  soroswapApiKey?: string;

  // Optional: custom logger (console-compatible)
  logger?: LoggerLike;
}
```

---

## Testnet Contract Addresses

| Contract | Address |
|----------|---------|
| Blend Pool (YieldBox V2) | `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF` |
| USDC SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

These are Stellar testnet addresses. Mainnet addresses differ.

---

## Where to customize

| If you want to… | Change this |
|-----------------|-------------|
| Add a new protocol (e.g. Aquarius) | Extend `formatPoolContext()` + update `SYSTEM_PROMPT` protocol list |
| Change LLM rules | Edit `SYSTEM_PROMPT` or pass a custom one |
| Change how risk levels map to strategies | Edit `fallbackStrategy()` in `YieldOptimizer` |
| Add on-chain execution for Soroswap | Add a case in `Rebalancer.checkAndRebalance()` for `target.protocol === "soroswap"` |
| Change drift threshold | `driftThresholdPct` in `RebalancerOptions` |
| Gate rebalancing by hold time or min improvement | Add your own gate logic before calling `checkAndRebalance()` |

See [Building Custom Agents](../../../getting-started/custom-agents.md) for a full walkthrough.

---

## Mainnet

Switch to mainnet by changing endpoints + passphrase:

- RPC: `https://soroban.stellar.org`
- Passphrase: `Public Global Stellar Network ; September 2015`

You'll also need the **mainnet USDC SAC address** (derive it from the USDC issuer) and a **mainnet Blend pool ID**.

See: [Mainnet guide](../../../getting-started/mainnet.md)
