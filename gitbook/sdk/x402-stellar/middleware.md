# createX402Middleware

Server-side Express middleware that gates a route behind x402 payment. Returns a `402 Payment Required` response when no payment is present, and verifies + settles on-chain when the `X-PAYMENT` header is attached.

## Usage

```typescript
import express from "express";
import { createX402Middleware } from "@agenticocean/x402-stellar";

const app = express();

// Apply to a single route
app.use(
  "/api/yield/query",
  createX402Middleware({
    price: "100000",                     // 0.01 USDC per request
    description: "AI yield optimization query",
    facilitatorSecret: process.env.FACILITATOR_SECRET_KEY,
    usdcAddress: process.env.USDC_SAC_ADDRESS,
    rpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  })
);

app.get("/api/yield/query", (req, res) => {
  // req.x402 is available after successful payment
  console.log(`Paid by vault: ${req.x402.payer}`);
  console.log(`TxHash: ${req.x402.txHash}`);
  res.json({ strategies: [/* ... */] });
});
```

---

## Parameters: `X402MiddlewareOptions`

```typescript
interface X402MiddlewareOptions {
  // Amount in stroops (1 USDC = 10_000_000)
  price: string;

  // Human-readable description shown in the 402 response
  description: string;

  // Facilitator's Stellar secret key — used to sign + submit vault transactions
  facilitatorSecret: string;

  // Contract addresses
  usdcAddress?: string;
  rpcUrl?: string;
  networkPassphrase?: string;

  // Optional: custom logger
  logger?: LoggerLike;
}
```

---

## 402 Response Format

When no `X-PAYMENT` header is present, the middleware returns:

```json
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "stellar-vault",
      "network": "stellar:mainnet",
      "asset": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      "amount": "100000",
      "payTo": "G...FACILITATOR_PUBLIC_KEY...",
      "maxTimeoutSeconds": 60,
      "description": "AI yield optimization query"
    }
  ]
}
```

---

## Success Response Headers

After successful payment, the response includes:

```
X-PAYMENT-RESPONSE: {"txHash":"abc123...","network":"stellar:testnet"}
```

---

## `req.x402` Object

After successful verification, the middleware attaches payment info to the request:

```typescript
req.x402 = {
  txHash: string;      // Stellar transaction hash
  payer: string;       // vault contract address that paid
  agentId?: number;    // agent ID if registered in AgentRegistry
}
```

---

## Applying to Multiple Routes

```typescript
import { createX402Middleware } from "@agenticocean/x402-stellar";

const paymentConfig = {
  facilitatorSecret: process.env.FACILITATOR_SECRET_KEY!,
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  usdcAddress: process.env.USDC_SAC_ADDRESS!,
};

// Different prices for different endpoints
app.use("/api/yield/query", createX402Middleware({
  ...paymentConfig,
  price: "100000",        // 0.01 USDC
  description: "Yield query",
}));

app.use("/api/yield/premium", createX402Middleware({
  ...paymentConfig,
  price: "1000000",       // 0.10 USDC
  description: "Premium yield analysis with rebalancing",
}));

app.use("/api/data/feed", createX402Middleware({
  ...paymentConfig,
  price: "10000",         // 0.001 USDC
  description: "Market data feed",
}));
```

---

## TypeScript Augmentation

Add the `x402` property to Express's `Request` type:

```typescript
// types/express.d.ts
import "express";

declare module "express" {
  interface Request {
    x402?: {
      txHash: string;
      payer: string;
      agentId?: number;
    };
  }
}
```
