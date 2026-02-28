# Installation

## npm / pnpm / yarn

```bash
npm install @agenticocean/defi-agent
# or
pnpm add @agenticocean/defi-agent
# or
yarn add @agenticocean/defi-agent
```

## Peer dependencies

`@blend-capital/blend-sdk` is an optional peer dependency. Install it if you want live Blend pool data (recommended):

```bash
npm install @blend-capital/blend-sdk
```

Without `blend-sdk`, `BlendClient.loadPool()` returns mock data (fixed APY values for testing). All other functionality works normally.

## Environment variables

Create a `.env` file:

```bash
# Required for live Blend data
STELLAR_RPC_URL=https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY
STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"

# AI provider (pick one — auto-detected from prefix)
AI_API_KEY=gsk_...                # Groq (free)
# AI_API_KEY=sk-ant-...           # Anthropic Claude
# AI_API_KEY=AIza...              # Google Gemini
# AI_API_KEY=xai-...              # xAI Grok

# Blend pool address (mainnet)
BLEND_POOL_ID=CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF

# USDC SAC address (mainnet)
USDC_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

## TypeScript

The package ships with full TypeScript types (`dist/index.d.ts`). No `@types/` package needed.

```typescript
// Works with ESM and CommonJS
import { YieldOptimizer } from "@agenticocean/defi-agent";
import type { AgentAIConfig, StrategyResponse } from "@agenticocean/defi-agent";
```

## Verify installation

Run the smoke test from the repo (if you cloned the source):

```bash
cd packages/agent-ai
npx tsx test-run.ts
```

Expected output:
```
── Test 1: Low risk strategy ──
Total APY: 5.58%
Allocations:
  Ondo USDY: 60% @ 4.8% APY [low]
  ...

── Test 3: Blend pool data ──
Pool: Blend YieldBox V2
  USDC: 7.20% supply APY, 67% utilized
  ...

✅ All tests passed
```
