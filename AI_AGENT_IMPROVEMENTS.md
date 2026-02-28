# @agenticocean/defi-agent — AI Yield Agent

## What We Built

The `@agenticocean/defi-agent` SDK (v0.3.0) powers the chat section with a **multi-LLM, AI-powered yield optimization agent** backed by live DeFi analytics from Blend Protocol and Soroswap.

---

## Multi-LLM Provider Support

The AI provider is **auto-detected from the API key prefix** — no config needed:

| Key prefix | Provider |
|-----------|---------|
| `sk-ant-` | Anthropic Claude |
| `AIza` | Google Gemini |
| `gsk_` | Groq |
| `xai-` | xAI Grok |

```typescript
import { YieldOptimizer } from "@agenticocean/defi-agent";

const optimizer = new YieldOptimizer({
  stellarRpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  aiApiKey: process.env.AI_API_KEY,   // Any of the 4 providers
  blendPoolId: "CCB...",
});
```

---

## Frontend — Chat Components

### StrategyDisplay — Professional Portfolio Visualization
- Visual allocation chart with color-coded risk levels
- Animated progress bars for each strategy
- APY breakdown with protocol details
- Risk badges (Low/Moderate/High)
- Portfolio summary card with total estimated APY
- Disclaimer for regulatory compliance

### Enhanced QueryInput
- Visual risk selector (Low / Moderate / High)
- Smart placeholder with example queries
- Cost badge showing 0.01 USDC per query
- Loading spinner during query processing
- Enter key submit support

### ChatWindow
- Example queries as clickable cards
- Helpful hints about x402 payments
- Auto-scroll to latest message

---

## AI Agent Capabilities

### Data Sources

1. **Blend Protocol** (Lending)
   - Supply APY for USDC/XLM
   - Borrow rates
   - Pool utilization metrics
   - BLND emissions

2. **Soroswap** (DEX/AMM)
   - LP pair yields
   - Swap routes
   - Price impact analysis

3. **RWA Yields** (Real World Assets)
   - Ondo USDY: ~4.8% (US Treasury-backed)
   - Centrifuge deJTRSY: ~4.5% (Institutional)

4. **DeFindex Vaults**
   - Auto-compound strategies: ~9.1% APY
   - Multi-strategy vaults: ~11.3% APY

### Strategy Generation

- Risk-adjusted allocation based on user preference
- Diversified portfolios across protocols
- APY optimization with safety buffers
- Impermanent loss consideration for LP positions
- BLND emissions factored in for Blend pools

---

## Example Strategies

### Low Risk (Conservative)
```
40% Ondo USDY           — 4.8% APY (US Treasury)
40% Blend Fixed V2      — 7.2% APY (Lending)
20% Soroswap USDC/EURC  — 3.8% APY (Stablecoin LP)
Total APY: 5.6%
```

### Moderate Risk (Balanced)
```
35% DeFindex Auto-Compound — 9.1% APY (Vault)
30% Blend Fixed V2         — 7.2% APY (Lending)
20% Ondo USDY              — 4.8% APY (Safety)
15% Soroswap USDC/XLM      — 12.5% APY (LP)
Total APY: 8.1%
```

### High Risk (Aggressive)
```
35% DeFindex Multi-Strategy — 11.3% APY (Vault)
30% Soroswap USDC/XLM      — 12.5% APY (LP)
25% Blend YieldBlox V2     — 8.5% APY (BLND boost)
10% Ondo USDY              — 4.8% APY (Base)
Total APY: 10.4%
```

---

## How It Works

### Backend (`/api/yield/query`)
1. **x402 Payment Gate** — Requires 0.01 USDC via vault.agent_pay()
2. **Provider Detection** — API key prefix selects Claude/Gemini/Groq/xAI
3. **Live Data Fetch** — Queries Blend SDK + Soroswap SDK for real rates
4. **Strategy Generation** — LLM generates risk-adjusted allocation
5. **Fallback** — Mock strategies if no AI key configured
6. **Rebalancer Update** — Sets target allocation in rebalancer

### Frontend Flow
1. User selects risk tolerance (Low/Moderate/High)
2. User types query
3. Frontend → Backend returns 402 Payment Required
4. x402 header built with vault signature
5. Payment settled → AI response returned
6. StrategyDisplay renders allocation cards

---

## SDK Technical Stack

**Package:** `@agenticocean/defi-agent` v0.3.0

**Dependencies:**
- `@blend-capital/blend-sdk` — Blend Protocol integration
- `@soroswap/sdk` — Soroswap DEX integration
- `@stellar/stellar-sdk` — Soroban RPC
- AI SDK auto-selected based on key prefix

**Rebalancer:**
- Cron-based (every 5 minutes)
- Reads current allocations vs AI targets
- Executes supply/withdraw via Blend SDK
- 5% drift threshold before rebalancing

---

## Key Features

- Multi-LLM: Claude, Gemini, Groq, xAI (auto-detected)
- Real-Time APY Data from live Blend/Soroswap pools
- Interactive UI with animated charts, badges, tooltips
- x402 Integration — seamless on-chain payments
- Graceful fallback to mock data if DeFi protocols unavailable
- Mobile responsive
