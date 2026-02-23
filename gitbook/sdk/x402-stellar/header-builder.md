# buildX402Header

Agent-side function. Constructs a signed `X-PAYMENT` header that authorizes `vault.agent_pay()` for a specific request.

## Usage

```typescript
import { buildX402Header } from "@agenticocean/x402-stellar";

// 1. First, get the payment requirements from the server's 402 response
const response = await fetch("https://api.example.com/yield/query");
if (response.status !== 402) throw new Error("Expected 402");
const requirements = await response.json();
// requirements = { accepts: [{ scheme, amount, payTo, asset, maxTimeoutSeconds }] }

// 2. Build the payment header
const paymentHeader = await buildX402Header({
  vaultContract: "C...YOUR_VAULT...",
  agentSignerSecret: process.env.AGENT_SIGNER_SECRET_KEY,
  paymentRequirements: requirements,
  rpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
  memo: "yield_query",  // optional — shows up in transaction history
});

// 3. Retry the request with payment
const paid = await fetch("https://api.example.com/yield/query", {
  headers: { "X-PAYMENT": paymentHeader },
});
const data = await paid.json();
const txHash = paid.headers.get("X-PAYMENT-RESPONSE");
```

---

## Parameters

```typescript
buildX402Header(params: {
  // Your vault contract address
  vaultContract: string;

  // Secret key of the agent signer (registered on the vault)
  agentSignerSecret: string;

  // The 402 response body from the server
  paymentRequirements: PaymentRequirements;

  // Stellar RPC endpoint
  rpcUrl: string;
  networkPassphrase: string;

  // Optional memo for the transaction (appears in history)
  memo?: string;
})
```

---

## Returns

`Promise<string>` — base64-encoded JSON payload, ready to use as the `X-PAYMENT` header value.

---

## What the header contains

The header is a base64-encoded JSON object:

```json
{
  "x402Version": 1,
  "scheme": "stellar-vault",
  "network": "stellar:mainnet",
  "payload": {
    "vaultContract": "C...VAULT...",
    "agentSigner": "G...AGENT_PUBLIC_KEY...",
    "payTo": "G...SERVER_FACILITATOR...",
    "amount": "100000",
    "asset": "USDC_SAC_ADDRESS",
    "memo": "yield_query",
    "signedAuthEntry": "AAAAAQ...base64-xdr...",
    "expirationLedger": 12345678
  }
}
```

The `signedAuthEntry` is a `SorobanAuthorizationEntry` XDR — it authorizes exactly one `vault.agent_pay()` invocation with the specified amount and payTo address. It expires after a few ledgers (roughly 1-2 minutes on Stellar).

---

## Security properties

| Property | Guarantee |
|----------|-----------|
| **Scoped** | Only authorizes payment to the specific `payTo` address |
| **Amount-bound** | Cannot pay more than the signed `amount` |
| **Expiring** | Auth entry expires — cannot be replayed after `expirationLedger` |
| **Vault-enforced** | Daily limit and destination whitelist enforced on-chain |
| **Key safety** | `agentSignerSecret` never leaves your server — only the signed auth entry is sent |

---

## Full Integration Example

```typescript
async function queryWithPayment(apiUrl: string, query: string) {
  // First request — expect 402
  const firstResponse = await fetch(`${apiUrl}?q=${encodeURIComponent(query)}`);

  if (firstResponse.status === 200) {
    return firstResponse.json(); // free endpoint, no payment needed
  }

  if (firstResponse.status !== 402) {
    throw new Error(`Unexpected status: ${firstResponse.status}`);
  }

  const requirements = await firstResponse.json();

  // Build payment header
  const paymentHeader = await buildX402Header({
    vaultContract: process.env.VAULT_CONTRACT!,
    agentSignerSecret: process.env.AGENT_SIGNER_SECRET_KEY!,
    paymentRequirements: requirements,
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  });

  // Retry with payment
  const paidResponse = await fetch(`${apiUrl}?q=${encodeURIComponent(query)}`, {
    headers: { "X-PAYMENT": paymentHeader },
  });

  if (!paidResponse.ok) {
    const err = await paidResponse.json();
    throw new Error(`Payment failed: ${err.error}`);
  }

  const txHash = paidResponse.headers.get("X-PAYMENT-RESPONSE");
  console.log(`Paid! txHash: ${txHash}`);

  return paidResponse.json();
}
```
