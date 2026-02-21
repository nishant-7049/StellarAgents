# @agenticocean/x402-stellar

x402 payment protocol for Stellar — header builder, facilitator, and Express middleware for AI agent micropayments.

## Installation

```bash
npm install @agenticocean/x402-stellar
# or
pnpm add @agenticocean/x402-stellar
```

## Quick Start

### 1. Build an x402 Payment Header (Agent side)

```typescript
import { buildX402Header } from "@agenticocean/x402-stellar";

const header = await buildX402Header({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  vaultContract: "CVAULT...",
  agentSigner: "GAGENT...",
  agentSecret: "SAGENT_SECRET...",
  payTo: "GFACILITATOR...",
  amount: "100000",        // 0.01 USDC in stroops
  memo: "yield_query_v1",
  agentId: 1,
  usdcAddress: "CUSDC...",
});

// Use in API request
const response = await fetch("https://api.example.com/yield/query", {
  headers: { "X-PAYMENT": header },
});
```

### 2. Gate your API with x402 Middleware (Vendor side)

```typescript
import express from "express";
import { createX402Middleware } from "@agenticocean/x402-stellar";

const app = express();

const x402 = createX402Middleware({
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  facilitatorSecret: process.env.FACILITATOR_SECRET!,
  usdcAddress: "CUSDC...",
});

// Gate a route — returns 402 if unpaid, 200 if paid
app.get("/premium-data", x402({ price: "100000", description: "Premium AI data" }), (req, res) => {
  res.json({ data: "...", payment: req.x402 });
});

app.listen(3001);
```

### 3. Settle a Payment (Facilitator side)

```typescript
import { settlePayment } from "@agenticocean/x402-stellar";

const result = await settlePayment(paymentPayload, {
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  facilitatorSecret: process.env.FACILITATOR_SECRET!,
});

console.log(result.success, result.txHash);
```

## API Reference

### `buildX402Header(params)`

Builds a base64-encoded x402 payment header. Signs a `vault.agent_pay()` invocation with the agent's key.

| Param | Type | Description |
|-------|------|-------------|
| `rpcUrl` | `string` | Soroban RPC endpoint |
| `networkPassphrase` | `string` | Network passphrase |
| `vaultContract` | `string` | User vault contract address |
| `agentSigner` | `string` | Agent's public key |
| `agentSecret` | `string` | Agent's secret key (for signing auth entry) |
| `payTo` | `string` | Facilitator's public key (payment destination) |
| `amount` | `string` | Amount in stroops (7 decimals) |
| `memo` | `string` | Audit memo |
| `agentId` | `number` | Agent's registry ID |
| `usdcAddress` | `string` | USDC SAC contract address |

### `createX402Middleware(options)`

Returns an Express middleware factory. Call with route config to create per-route middleware.

```typescript
const x402 = createX402Middleware({ ...options });

// Returns middleware:
x402({ price: "100000", description: "..." })
```

### `settlePayment(payload, options)`

Verifies and executes payment on-chain. Returns `{ success, txHash?, error? }`.

### `formatUsdc(stroops)`

Convert stroops to human-readable USDC string.

```typescript
formatUsdc("100000")    // → "0.01"
formatUsdc(10_000_000n) // → "1.00"
```

### `toStroops(usdc)`

Convert USDC amount to stroops (bigint).

```typescript
toStroops(0.01) // → 100000n
toStroops(5)    // → 50000000n
```

### Network Config

```typescript
import { TESTNET, MAINNET } from "@agenticocean/x402-stellar";

// TESTNET: soroban-testnet.stellar.org
// MAINNET: soroban.stellar.org
```

## Stellar USDC Decimals

**Important**: Stellar USDC uses 7 decimal places (not 6 like EVM).

- `1 USDC = 10,000,000 stroops`
- `0.01 USDC = 100,000 stroops`

## How It Works

The x402 flow on Stellar:

1. Agent requests a paid route → receives `402 Payment Required` with amount + facilitator address
2. Agent builds a `vault.agent_pay()` Soroban invocation, simulates it to get the auth entry + footprint
3. Agent signs the `SorobanAuthorizationEntry` with their key (anti-replay nonce included)
4. Agent sends the assembled transaction XDR + signed auth entry in the `X-PAYMENT` header
5. Facilitator deserializes the pre-assembled tx, signs as source (pays XLM fees), submits
6. Soroban verifies agent's signature, enforces daily spending limit, transfers USDC
7. Route returns `200 OK` with strategy + `X-PAYMENT-RESPONSE: { txHash }`

## License

MIT — AgenticOcean
