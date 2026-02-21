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
2. **Build transaction** — construct `vault.agent_pay(agent, payTo, amount, memo)` call
3. **Simulate** — call Soroban RPC `simulateTransaction` to get the footprint
4. **Inject auth** — replace the simulation's auth entry with the agent's pre-signed one
5. **Assemble + sign** — facilitator signs with their own keypair (as the transaction source, paying XLM fees)
6. **Submit** — send to Soroban RPC as a fee-bump transaction
7. **Wait** — poll until confirmed or timeout (30 seconds)
8. **Return** — `{success: true, txHash}` or `{success: false, error}`

---

## SettlementResult

```typescript
interface SettlementResult {
  success: boolean;
  txHash?: string;   // present on success
  error?: string;    // present on failure
}
```

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
