# Manage Agent Access

The **Vault** page (`/app/vault`) lets you control exactly which agents can spend from your vault, how much they can spend per day, and which addresses they're allowed to pay.

---

## Understanding Agent Policies

Each agent you authorize gets an `AgentPolicy` stored in your vault contract:

| Field | What it controls |
|-------|-----------------|
| **Daily limit** | Max USDC the agent can spend in any 24-hour window |
| **Allowed destinations** | Addresses the agent can pay (empty = any address) |
| **Active status** | Can be instantly revoked |

---

## Authorizing an Agent

On the Vault page, scroll to the **Agents** section and click **Add Agent**:

1. **Agent signer address** — the public key of the agent's signing keypair (the `G...` address, not the secret key). This is what the agent uses to sign `agent_pay()` auth entries.

2. **Daily limit** — enter in USDC (e.g., `1` for 1 USDC/day). The contract converts to stroops automatically.

3. **Allowed destinations** (optional) — comma-separated list of Stellar addresses the agent is allowed to pay. Leave empty to allow any destination.

4. Click **Authorize** and sign with Freighter.

---

## Setting the Right Daily Limit

| Use case | Suggested limit |
|----------|----------------|
| Testing / demo | $0.10 USDC/day |
| Single API agent | $1 USDC/day |
| Rebalancer | $5 USDC/day |
| High-frequency agent | $10–50 USDC/day |

The agent pays `0.01 USDC` per yield query. At `$1/day`, that's up to 100 queries per day.

---

## Checking Remaining Limit

On the Vault page, each authorized agent shows:
- **Daily limit** — max per 24h
- **Remaining today** — how much the agent can still spend this window
- **Status** — Active or Revoked

From the SDK:
```typescript
import { UserVault } from "@agenticocean/vault";

const vault = new UserVault(vaultAddress, {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
});

const remaining = await vault.getRemainingLimit(agentAddress);
const remainingUsdc = Number(remaining) / 1e7;
console.log(`Agent can still spend: $${remainingUsdc.toFixed(4)} USDC today`);
```

---

## Revoking an Agent

On the Vault page, click **Revoke** next to any agent. Freighter prompts you to sign a `remove_agent()` transaction. After confirmation:
- The agent's `isActive` flag is set to `false`
- Any attempt by that agent to call `agent_pay()` returns `AgentInactive` error
- The x402 payment is rejected immediately

This is instant — no waiting for a timelock.

---

## Re-authorizing a Revoked Agent

To re-authorize a previously revoked agent, click **Add Agent** again with the same signer address. The old policy is replaced with the new one.

---

## Security Best Practices

**Principle of least privilege** — give agents the minimum daily limit they need to function. A yield query agent only needs `$0.50/day`; a full rebalancer might need `$5/day`.

**Destination whitelist** — if your agent only ever pays your facilitator server, add only that address to the whitelist. This prevents the agent from being used to pay arbitrary addresses even if its signing key is compromised.

**Monitor spending** — check the [Transaction History](history.md) page regularly to see what your agents are paying for.

**Rotate signer keys** — if an agent signer secret key is ever compromised, immediately revoke it from your vault and add a new agent with a fresh keypair.
