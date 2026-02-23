# @agenticocean/x402-stellar

Implementation of the [x402 HTTP payment protocol](https://github.com/coinbase/x402) for Stellar. Enables AI agents to pay for API services using USDC from their smart vault — directly at the HTTP layer, with no subscriptions or API keys.

---

## Install

```bash
npm install @agenticocean/x402-stellar
```

---

## What is x402?

HTTP 402 is the "Payment Required" status code — unused since 1995, finally getting a real implementation. The x402 protocol turns any API endpoint into a pay-per-use service:

1. **No payment?** → `402 Payment Required` with payment instructions
2. **Payment attached?** → verify + settle on-chain → `200 OK`

In AgenticOcean, payment is a signed Soroban auth entry that authorizes `vault.agent_pay()`. The facilitator submits it to Stellar and returns a `txHash` as proof.

---

## What's included

| Export | Description |
|--------|-------------|
| `buildX402Header` | Agent-side: build the `X-PAYMENT` header for a request |
| `createX402Middleware` | Server-side: Express middleware that gates routes behind payment |
| `settlePayment` | Facilitator-side: verifies + submits the vault transaction |
| `formatUsdc` | Convert stroops to human-readable USDC string |
| `toStroops` | Convert USDC amount to stroops bigint |
| `TESTNET` / `MAINNET` | Pre-configured network configs |

---

## How payment flows

```
AI Agent                    Your API Server              Soroban RPC
   │                              │                           │
   ├──── GET /api/yield/query ───►│                           │
   │                              │◄── 402 {amount, payTo} ──┤
   │                              │                           │
   │  [build X-PAYMENT header]    │                           │
   │  [sign vault.agent_pay()]    │                           │
   │                              │                           │
   ├── GET /api/yield/query ─────►│                           │
   │   X-PAYMENT: base64(payload) │                           │
   │                              ├── POST /x402/settle ─────►│
   │                              │                           │
   │                              │◄── {txHash: "abc..."} ───┤
   │                              │   (USDC moved on-chain)   │
   │                              │                           │
   │◄── 200 OK ──────────────────┤                           │
   │    X-PAYMENT-RESPONSE: ...   │                           │
```

---

## Key Concepts

### The X-PAYMENT header

A base64-encoded JSON payload that the agent sends with every paid request:

```json
{
  "x402Version": 1,
  "scheme": "stellar-vault",
  "network": "stellar:mainnet",
  "payload": {
    "vaultContract": "C...VAULT_ADDRESS...",
    "agentSigner": "G...AGENT_PUBLIC_KEY...",
    "payTo": "G...FACILITATOR_PUBLIC_KEY...",
    "amount": "100000",
    "asset": "USDC_SAC_ADDRESS",
    "memo": "yield_query_abc123",
    "signedAuthEntry": "base64-encoded-xdr...",
    "expirationLedger": 12345678
  }
}
```

The `signedAuthEntry` is the agent's signed Soroban authorization for `vault.agent_pay()`. Without the vault's private USDC, without admin access — just a scoped, expiring authorization.

### Stroops

Stellar uses 7 decimal places. 1 USDC = `10,000,000` stroops. The `amount` field in the payment payload is always in stroops.

```typescript
import { toStroops, formatUsdc } from "@agenticocean/x402-stellar";

toStroops(0.01)  // 100000n (0.01 USDC)
toStroops(1)     // 10000000n (1 USDC)
formatUsdc(100000n)   // "0.01"
formatUsdc(10000000n) // "1.00"
```

---

## Quick Demo

**Server** — add a payment gate to a route (Express):

```typescript
import express from "express";
import { createX402Middleware } from "@agenticocean/x402-stellar";

const app = express();

const x402 = createX402Middleware({
  rpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  horizonUrl: "https://horizon.stellar.org",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
  facilitatorSecret: process.env.FACILITATOR_SECRET_KEY!,
  usdcAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
});

app.get("/api/yield/query", x402({
  price: "100000", // 0.01 USDC in stroops
  description: "AI yield optimization query",
}), (req: any, res) => {
  res.json({ strategies: [...], x402: req.x402 });
});
```

**Agent** — attach payment to a request:

```typescript
import { buildX402Header } from "@agenticocean/x402-stellar";

const header = await buildX402Header({
  vaultContract: "C...VAULT...",
  agentSigner: "G...AGENT_PUBLIC_KEY...",
  agentSecret: process.env.AGENT_SIGNER_SECRET_KEY!,
  payTo: "G...FACILITATOR_PUBLIC_KEY...",
  amount: "100000",
  memo: "yield_query",
  agentId: 1,
  usdcAddress: "C...USDC_SAC_ADDRESS...",
  rpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
});

const response = await fetch(url, {
  headers: { "X-PAYMENT": header },
});
```

---

## Network

This SDK is configured for **Stellar Mainnet** (Public Network):

- Soroban RPC: `https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY`
- Horizon: `https://horizon.stellar.org`
- Passphrase: `Public Global Stellar Network ; September 2015`
- USDC SAC: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

See:

- [Mainnet guide](../../getting-started/mainnet.md)
