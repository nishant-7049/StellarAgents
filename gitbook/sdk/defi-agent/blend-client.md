# BlendClient

TypeScript client for the [Blend Protocol](https://blend.capital) lending pool on Stellar. Reads live pool data, loads user positions, and builds supply/withdraw operations.

## Usage

```typescript
import { BlendClient } from "@agenticocean/defi-agent";

const blend = new BlendClient({
  stellarRpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
  blendPoolId: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
});
```

---

## Methods

### `loadPool(poolId?)`

Fetches the full pool state from the Blend SDK. Returns APYs, utilization rates, and reserve data for all assets.

```typescript
const pool = await blend.loadPool();
// or with a specific pool:
const pool = await blend.loadPool("C...POOL_ID...");
```

**Returns: `BlendPoolData`**

```typescript
{
  poolId: string;
  poolName: string;
  reserves: Array<{
    assetId: string;        // contract address of the asset
    symbol: string;         // "USDC", "XLM", etc.
    supplyApy: number;      // APY earned by lenders (e.g., 7.2 for 7.2%)
    borrowApy: number;      // APY paid by borrowers
    totalSupply: string;    // total supplied, in stroops
    totalBorrow: string;    // total borrowed, in stroops
    utilization: number;    // 0-1 (e.g., 0.67 = 67% utilized)
  }>;
  emissions: {
    blndPerDay: number;     // BLND token emissions per day
    estimatedBlndApy: number;
  };
}
```

**Important:** APY values are already in percentage form — `7.2` means 7.2%, not 0.072.

---

### `loadUserPosition(vaultAddress, poolId?)`

Reads a wallet's current supply and borrow positions in a Blend pool. Used by the rebalancer to determine real `currentPct` values.

```typescript
const position = await blend.loadUserPosition("C...VAULT_ADDRESS...");
```

**Returns: `UserBlendPosition`**

```typescript
{
  poolId: string;
  estimatedSupplyValue: number;   // USD value of supplied assets
  estimatedBorrowValue: number;   // USD value of borrowed assets (0 for lenders)
  netApr: number;                 // net APR (supply earnings - borrow cost)
}
```

Returns zeroed values gracefully if the vault has no position (no error thrown).

---

### `getDefaultPoolId()`

Returns the pool ID from config.

```typescript
const poolId = blend.getDefaultPoolId();
```

---

## Fallback Behavior

If `@blend-capital/blend-sdk` is not installed, or if the pool RPC call fails, `loadPool()` returns mock data with realistic APY values:

```
USDC: 7.2% supply APY, 67% utilization
XLM: 4.1% supply APY, 40% utilization
```

This lets you build and test without a live Blend pool connection.

---

## Understanding Blend Rates

Blend uses a kinked interest rate model:
- Low utilization (<50%): rates are low, set by minimum rate parameter
- High utilization (>80%): rates increase sharply to incentivize repayments

**Utilization = totalBorrow / totalSupply**

As a supplier, you earn `supplyApy`. The rate updates every time someone supplies, borrows, repays, or withdraws.

---

## Mainnet Pool Address

The primary mainnet pool:

```
CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF
```

Backstop contract:
```
CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA
```
