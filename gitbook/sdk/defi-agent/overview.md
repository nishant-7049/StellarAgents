# @agenticocean/defi-agent

AI-powered DeFi yield optimization for the Stellar blockchain. Query live rates from Blend and Soroswap, generate allocation strategies with any major LLM, and run an autonomous rebalancer that keeps your portfolio on-target.

---

## Install

```bash
npm install @agenticocean/defi-agent
```

## What's included

| Export | Description |
|--------|-------------|
| `YieldOptimizer` | Main entry point — fetches live rates + calls LLM for strategy |
| `BlendClient` | Reads Blend lending pool data; builds supply/withdraw operations |
| `SoroswapClient` | Gets Soroswap swap quotes and LP positions |
| `Rebalancer` | Monitors drift vs target allocation; executes rebalancing |
| `SYSTEM_PROMPT` | The default LLM system prompt (customizable) |
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

---

## Multi-LLM Support

Pass a single `aiApiKey` — the SDK detects the provider automatically from the key prefix:

| Prefix | Provider | Model used |
|--------|----------|-----------|
| `sk-ant-...` | Anthropic Claude | claude-sonnet-4-6 |
| `AIza...` | Google Gemini | gemini-2.0-flash-lite |
| `gsk_...` | Groq (Llama) | llama-3.3-70b-versatile |
| `xai-...` | xAI Grok | grok-3-mini |

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
