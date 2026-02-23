# UserVault

Read-only access to a deployed `UserVault` contract. Check balances, spending history, and agent policies without signing transactions.

## Usage

```typescript
import { UserVault } from "@agenticocean/vault";

const VAULT_ADDRESS = "C...YOUR_VAULT_ADDRESS...";

const vault = new UserVault(VAULT_ADDRESS, {
  rpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
});
```

---

## Methods

### `getBalance()`

Get the USDC balance held in the vault (in stroops).

```typescript
const balanceStroops = await vault.getBalance();
const balanceUsdc = Number(balanceStroops) / 1e7;
console.log(`Balance: $${balanceUsdc.toFixed(2)} USDC`);
```

**Returns:** `string` (stroops as string to avoid BigInt serialization issues)

> **Stroops:** 1 USDC = 10,000,000 stroops on Stellar (7 decimal places, not 6 like EVM).

---

### `getTotalSpent()`

Lifetime USDC spent through `agent_pay()` — all agents combined.

```typescript
const spent = await vault.getTotalSpent();
const spentUsdc = Number(spent) / 1e7;
console.log(`Total agent payments: $${spentUsdc.toFixed(4)} USDC`);
```

**Returns:** `string` (stroops)

---

### `getAgentPolicy(agentAddress)`

Fetch a specific agent's spending policy on this vault.

```typescript
const policy = await vault.getAgentPolicy("G...AGENT_ADDRESS...");

if (policy) {
  const limit = Number(policy.dailyLimit) / 1e7;
  const spent = Number(policy.spentToday) / 1e7;
  console.log(`Daily limit: $${limit.toFixed(2)} USDC`);
  console.log(`Spent today: $${spent.toFixed(4)} USDC`);
  console.log(`Active: ${policy.isActive}`);
  console.log(`Destinations: ${policy.allowedDestinations.length === 0 ? "any" : policy.allowedDestinations.join(", ")}`);
}
```

**Returns:** `AgentPolicy | null`

---

### `getRemainingLimit(agentAddress)`

How much USDC the agent can still spend today (auto-resets after 24 hours).

```typescript
const remaining = await vault.getRemainingLimit("G...AGENT...");
const remainingUsdc = Number(remaining) / 1e7;
console.log(`Remaining today: $${remainingUsdc.toFixed(4)} USDC`);
```

**Returns:** `string` (stroops; returns `"0"` if agent not found)

---

## Understanding Daily Limits

The `daily_limit` resets every 24 hours based on the ledger timestamp (not UTC midnight). When an agent first spends, the 24-hour window starts. The next reset happens exactly 86,400 seconds later.

Example: agent has a `$1 USDC` daily limit, spends `$0.05` — remaining = `$0.95`. After 24 hours, the window resets and they can spend `$1` again.

---

## Modifying Agent Access (requires signing)

To add, remove, or modify agents, you need a signed transaction from the vault owner. These are write operations — use the dashboard or build a transaction with Freighter.

From the dashboard:
- **Add agent**: [Vault page → Manage Agents → Add Agent](../../dashboard/agent-access.md)
- **Remove agent**: [Vault page → Manage Agents → Revoke](../../dashboard/agent-access.md)

From code (with Freighter):

```typescript
// Grant an agent 1 USDC/day with no destination restrictions
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC })
  .addOperation(
    vaultContract.call(
      "add_agent",
      nativeToScVal(ownerAddress, { type: "address" }),
      nativeToScVal(agentAddress, { type: "address" }),
      nativeToScVal(10_000_000n, { type: "i128" }),  // 1 USDC daily limit
      nativeToScVal([], { type: "vec" }),             // empty = any destination
    )
  )
  .setTimeout(60)
  .build();
```
