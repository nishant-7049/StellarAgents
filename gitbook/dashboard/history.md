# Transaction History

The **History** page (`/app/history`) shows the on-chain transaction history for your vault address, fetched live from Stellar Horizon.

---

## What you'll see

Each transaction card shows:

| Field | Description |
|-------|-------------|
| **Type icon** | Lightning bolt (Soroban contract call), arrow up (payment), arrow down (receive) |
| **Description** | Human-readable label (e.g., "agent_pay: yield query", "Deposit") |
| **Badge** | "Soroban" for contract interactions, "Stellar" for native payments |
| **Timestamp** | When the transaction was included in a ledger |
| **Amount** | USDC or XLM amount if a payment operation |
| **External link** | Opens the transaction on Stellar Expert for full details |

---

## Transaction types

### `invoke_host_function` (Soroban)
Contract interactions — deposits, withdrawals, agent_pay calls, strategy executions.

### `payment`
Direct token transfers — USDC deposits, USDC withdrawals.

### `create_account`
The initial vault creation transaction (first entry).

---

## Demo mode

If you don't have a vault yet, the History page shows transactions for the demo vault address — so you can see what a real vault's history looks like before creating your own.

---

## Viewing on Stellar Expert

Click the external link icon on any transaction to open it in [Stellar Expert](https://stellar.expert/explorer/testnet). There you can see:

- Full XDR of the transaction
- All operations and their effects
- Contract data changes (for Soroban)
- The exact ledger it was included in

---

## x402 Payments in History

Each `agent_pay` call shows up as a `invoke_host_function` operation with a memo like `"yield_query_abc123"`. The memo is set by the agent when building the x402 header — it acts as an audit trail linking the payment to the specific service request.
