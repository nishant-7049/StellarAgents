# settlePayment

Facilitator-side function. Decodes the agent's payment payload, submits the vault transaction to Soroban, and returns the settlement result.

You don't usually call this directly — `createX402Middleware` calls it for you. Use this directly if you're building a custom settlement flow.

## Usage

```typescript
import { settlePayment } from "@agenticocean/x402-stellar";

const result = await settlePayment(payload, {
  facilitatorSecret: process.env.FACILITATOR_SECRET_KEY,
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
});

if (result.success) {
  console.log(`Settled! txHash: ${result.txHash}`);
} else {
  console.error(`Settlement failed: ${result.error}`);
}
```

---

## Parameters

```typescript
settlePayment(
  payload: PaymentPayload,          // decoded from the X-PAYMENT header
  options: SettlementOptions
): Promise<SettlementResult>

interface SettlementOptions {
  facilitatorSecret: string;        // signs + pays gas for the settlement tx
  rpcUrl: string;
  networkPassphrase: string;
}
```

---

## How Settlement Works

1. **Decode payload** — extract vault address, agent signer, amount, payTo, and signed auth entry
2. **Build transaction** — construct `vault.agent_pay(agent, payTo, amount, memo)` call (or deserialize `assembledTxXdr` if provided)
3. **Simulate** — call Soroban RPC `simulateTransaction` to get the footprint
4. **Inject auth** — replace the simulation's auth entry with the agent's pre-signed one
5. **Assemble + sign** — facilitator signs with their own keypair (as the transaction source, paying XLM fees)
6. **Submit** — send to Soroban RPC
7. **Wait** — poll `getTransaction` for up to 30 seconds; fall back to Horizon if the RPC poll throws a parse error
8. **Return** — `{success: true, txHash}` on confirmation, or `{success: false, txHash?, error}` on any failure

---

## SettlementResult

```typescript
interface SettlementResult {
  success: boolean;
  txHash?: string;   // always present when tx was submitted (success or failure)
  error?: string;    // present on failure, describes cause
}
```

`txHash` is returned on failure paths too (when the hash is known) so callers can look up the transaction manually.

---

## Timeout behavior

If the 30-second RPC poll ends without confirmation:

```json
{ "success": false, "txHash": "abc123...", "error": "timeout: tx not confirmed after 30s" }
```

The transaction may still land on-chain after this point. Callers should treat this as **unknown** state and check the `txHash` on [Stellar Expert](https://stellar.expert/explorer/testnet) or Horizon before retrying — never resubmit the same auth entry without verifying.

---

## HTTP status codes (POST /api/x402/settle)

The reference backend maps settlement results to HTTP status codes:

| Condition | HTTP |
|-----------|------|
| `success: true` | `200` |
| Timeout or Horizon inconclusive | `503` (retryable — check txHash first) |
| `TRY_AGAIN_LATER` from RPC | `503` |
| Schema validation failure | `400` |
| Amount cap exceeded | `400` |
| `payTo` not whitelisted | `400` |
| Rate limit exceeded | `429` |
| On-chain error (agent inactive, limit, etc.) | `400` |

---

## Common Errors

| Error | Cause |
|-------|-------|
| `agent_not_found` | Agent address not registered on the vault |
| `agent_inactive` | Agent was deactivated by vault owner |
| `exceeds_daily_limit` | Agent has hit their 24h spending cap |
| `destination_not_allowed` | `payTo` address not in agent's whitelist |
| `insufficient_balance` | Vault doesn't have enough USDC |
| `auth_expired` | The signed auth entry's `expirationLedger` has passed |
| `simulation failed` | Invalid transaction or contract not found |
| `timeout: tx not confirmed after 30s` | Submitted but unconfirmed — check txHash |
| `horizon: tx status unknown` | Horizon returned non-200 for the txHash |
| `send: TRY_AGAIN_LATER` | RPC overloaded — retry after a brief wait |

---

## Facilitator Account Setup

The facilitator account needs:
1. **XLM balance** — to pay Soroban transaction fees (~0.001 XLM per settlement)
2. **No USDC needed** — the vault sends USDC directly

On testnet, fund the facilitator via Friendbot:
```
https://friendbot.stellar.org/?addr=G...FACILITATOR_PUBLIC_KEY...
```

The facilitator keypair should be a dedicated server-side key, not user-facing. Keep the secret key in your environment variables — never commit it.
