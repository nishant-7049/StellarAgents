# SoroswapClient

Client for [Soroswap](https://soroswap.finance) — the primary AMM DEX on Stellar. Provides swap quotes, LP position data, and liquidity pool APYs.

## Usage

```typescript
import { SoroswapClient } from "@agenticocean/defi-agent";

const soroswap = new SoroswapClient({
  stellarRpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
  usdcAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  soroswapApiKey: process.env.SOROSWAP_API_KEY, // optional
});
```

---

## Methods

### `getQuote(params)`

Get a price quote for a token swap.

```typescript
const quote = await soroswap.getQuote({
  assetIn: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",  // USDC
  assetOut: "native",  // XLM
  amount: 10_0000000n,  // 10 USDC (7 decimal places)
});

if (quote) {
  const usdcIn = Number(quote.amountIn) / 1e7;
  const xlmOut = Number(quote.amountOut) / 1e7;
  console.log(`${usdcIn} USDC → ${xlmOut} XLM`);
  console.log(`Price impact: ${(quote.priceImpact * 100).toFixed(2)}%`);
}
```

**Returns: `SwapQuote | null`**

```typescript
{
  amountIn: string;       // exact input amount (stroops)
  amountOut: string;      // estimated output amount (stroops)
  priceImpact: number;    // e.g., 0.003 = 0.3%
  route: string[];        // token addresses in the swap path
  protocol: string;       // "soroswap" or "soroswap-mock"
}
```

> **Reminder:** Stellar uses 7 decimal places. 1 USDC = `10_000_000` stroops = `10_0000000` in Stellar notation.

---

### `getPools()`

Get available liquidity pool data with estimated APYs.

```typescript
const pools = await soroswap.getPools();
pools.forEach(p => {
  console.log(`${p.token0}/${p.token1}: ${p.apy}% APY`);
});
```

**Returns: `PoolData[]`**

```typescript
{
  pairAddress: string;  // LP pair contract address
  token0: string;       // first token address
  token1: string;       // second token address
  reserve0: string;     // liquidity of token0 (stroops)
  reserve1: string;     // liquidity of token1 (stroops)
  apy: number;          // estimated LP APY from fees
}
```

---

### `loadLPPosition(vaultAddress, pairAddress?)`

Reads a wallet's current LP token balance and estimates its USDC value. Used by the rebalancer to measure the Soroswap portion of a portfolio.

```typescript
const position = await soroswap.loadLPPosition("C...VAULT_ADDRESS...");
console.log(`LP value: $${position.valueUSDC.toFixed(2)} USDC`);
```

**Returns:**
```typescript
{
  pairAddress: string;  // LP pair that was queried
  valueUSDC: number;    // estimated USDC value of vault's LP position
}
```

Returns `{ valueUSDC: 0 }` gracefully if vault has no LP position.

---

## Without an API Key

`SoroswapClient` works without a `soroswapApiKey`. When no key is provided:
- `getQuote()` returns a mock quote (1 USDC ≈ 4 XLM)
- `getPools()` returns a hardcoded USDC/XLM pool at 12.5% APY

This is fine for demos and strategy generation, where exact swap amounts don't matter.

---

## Understanding LP APY

Soroswap LP APY comes from two sources:
1. **Trading fees** — 0.3% of every swap in the pool, shared proportionally with liquidity providers
2. **Farming rewards** — some pools have additional USDC or AQUA token incentives

**Impermanent loss (IL)** — If the prices of the two tokens in a pair diverge significantly, you may end up with less value than if you had just held the tokens. High-APY pools (like USDC/XLM) carry more IL risk than stablecoin pairs (like USDC/EURC).

For users who want yield without IL, use Blend lending instead.
