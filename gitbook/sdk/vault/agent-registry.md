# AgentRegistry

Read and write access to the on-chain `AgentRegistry` contract — an ERC-8004-inspired agent identity system on Stellar. Each registered agent gets a sequential NFT-like ID, a structured metadata record, and a **globally unique human-readable handle** (like ENS names for AI agents).

## Usage

```typescript
import { AgentRegistry } from "@agenticocean/vault";

const AGENT_REGISTRY = "CDKHR3UUKCKXJ6CRKWKUZI3SKWAAKJMU6TGHRBM2VJJBCKEO6ETH55AU";

const registry = new AgentRegistry(AGENT_REGISTRY, {
  rpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
});
```

---

## Read Methods

### `listAgents(startId?, limit?)`

Get a paginated list of active agents.

```typescript
const agents = await registry.listAgents(1, 20);
agents.forEach(agent => {
  console.log(`[${agent.id}] @${agent.handle} — ${agent.name}`);
  const meta = JSON.parse(agent.agentUri);
  console.log(`  Capabilities: ${meta.capabilities?.join(", ")}`);
  console.log(`  Price: ${meta.pricing?.amount} stroops/query`);
});
```

**Returns:** `AgentInfo[]`

---

### `getAgent(agentId)`

Fetch a single agent by its numeric ID.

```typescript
const agent = await registry.getAgent(1);
console.log(`Name: ${agent.name}`);
console.log(`Handle: @${agent.handle}`);
console.log(`Owner: ${agent.owner}`);
console.log(`Vault: ${agent.vaultAddress}`);
console.log(`Signer: ${agent.agentSigner}`);
console.log(`Active: ${agent.isActive}`);
```

**Returns:** `AgentInfo | null`

---

### `getAgentByHandle(handle)`

Resolve a human-readable handle to the full `AgentInfo`. Works like ENS — pass the handle string, get back the agent record.

```typescript
const agent = await registry.getAgentByHandle("stellar-yield-bot");
if (agent) {
  console.log(`Agent #${agent.id}: ${agent.name}`);
  console.log(`Owner: ${agent.owner}`);
}
```

**Returns:** `AgentInfo | null`

> Handles are globally unique and first-come, first-served. Once claimed, the handle maps permanently to an agent until it is transferred.

---

### `isHandleAvailable(handle)`

Check whether a handle is still unclaimed before registering.

```typescript
const available = await registry.isHandleAvailable("my-agent");
if (available) {
  console.log("Handle is free — you can claim it.");
} else {
  console.log("Handle already taken.");
}
```

**Returns:** `boolean`

---

### `getAgentByOwner(ownerAddress)`

Find the agent ID registered by a given owner.

```typescript
const agentId = await registry.getAgentByOwner("G...OWNER...");
if (agentId !== null) {
  const agent = await registry.getAgent(agentId);
  console.log(`Your agent: @${agent.handle}`);
}
```

**Returns:** `number | null`

---

### `getAgentCount()`

Total number of active agents.

```typescript
const count = await registry.getAgentCount();
console.log(`${count} agents registered`);
```

---

## AgentInfo Structure

```typescript
interface AgentInfo {
  id: number;              // sequential ID (starts at 1)
  owner: string;           // Stellar public key of the registrant
  name: string;            // display name
  handle: string;          // unique on-chain handle (e.g. "stellar-yield-bot")
  agentUri: string;        // JSON string — see below
  vaultAddress: string;    // vault that funds this agent's x402 payments
  agentSigner: string;     // public key used to sign agent_pay() calls
  registeredAt: number;    // Unix timestamp
  isActive: boolean;       // false if deactivated by owner
}
```

### `agentUri` JSON format

```json
{
  "capabilities": ["yield_optimization", "portfolio_rebalancing"],
  "endpoints": {
    "query": "https://api.example.com/yield/query",
    "health": "https://api.example.com/health"
  },
  "pricing": {
    "protocol": "x402",
    "amount": "100000",
    "asset": "USDC",
    "description": "0.01 USDC per yield query"
  },
  "model": "llama-3.3-70b-versatile",
  "version": "0.1.0"
}
```

---

## Handle System

Every agent registration requires a unique **handle** — a short, URL-friendly identifier similar to an ENS name or GitHub username.

### Handle rules

| Rule | Detail |
|------|--------|
| Length | 3–32 characters |
| Allowed chars | Lowercase letters (`a-z`), digits (`0-9`), hyphens (`-`) |
| Leading/trailing hyphens | Not allowed |
| Uniqueness | Globally unique — first come, first served |
| Transferable | Handle stays with the agent when ownership is transferred |

### Valid examples

```
stellar-yield-bot
yieldmax42
alpha-rebalancer
my-agent
```

### Invalid examples

```
Yield-Bot        ← uppercase not allowed
-yieldbot        ← leading hyphen
yieldbot-        ← trailing hyphen
ab               ← too short (< 3 chars)
```

### Handle errors

| Error | Code | Meaning |
|-------|------|---------|
| `HandleAlreadyTaken` | 5 | Another agent claimed this handle |
| `HandleTooShort` | 6 | Handle is fewer than 3 characters |
| `HandleTooLong` | 7 | Handle exceeds 32 characters |
| `HandleInvalidChars` | 8 | Contains uppercase, spaces, or special characters |

---

## Registering an Agent (requires signing)

Registration now requires a `handle` parameter in addition to name and metadata. Use `isHandleAvailable()` first to avoid wasted transaction fees.

```typescript
import { signTransaction } from "@stellar/freighter-api";

// Check availability first
const available = await registry.isHandleAvailable("stellar-yield-bot");
if (!available) throw new Error("Handle taken");

const agentMetadata = JSON.stringify({
  capabilities: ["yield_optimization"],
  endpoints: { query: "https://api.example.com/yield/query" },
  pricing: { protocol: "x402", amount: "100000", asset: "USDC" },
  model: "llama-3.3-70b-versatile",
  version: "0.1.0",
});

// Build the register transaction — note: handle is the 3rd argument
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC })
  .addOperation(
    registryContract.call(
      "register",
      nativeToScVal(ownerAddress, { type: "address" }),
      nativeToScVal("My Yield Agent", { type: "string" }),
      nativeToScVal("stellar-yield-bot", { type: "string" }),  // handle
      nativeToScVal(agentMetadata, { type: "string" }),
      nativeToScVal(vaultAddress, { type: "address" }),
      nativeToScVal(agentSignerPublicKey, { type: "address" }),
    )
  )
  .setTimeout(60)
  .build();

const sim = await rpc.simulateTransaction(tx);
const assembled = assembleTransaction(tx, sim).build();
const signed = await signTransaction(assembled.toXDR(), { networkPassphrase: Networks.PUBLIC });
```

---

## Transferring Agent Ownership

The `transfer_agent()` function moves ownership to a new address. The handle stays mapped to the agent — it does **not** transfer to the new owner's address separately.

```typescript
// transfer_agent(currentOwner, agentId, newOwner)
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC })
  .addOperation(
    registryContract.call(
      "transfer_agent",
      nativeToScVal(currentOwnerAddress, { type: "address" }),
      nativeToScVal(1, { type: "u32" }),                         // agentId
      nativeToScVal(newOwnerAddress, { type: "address" }),
    )
  )
  .setTimeout(60)
  .build();
```

---

## ERC-8004 Mapping

AgenticOcean's registry implements the Stellar equivalent of [ERC-8004](https://github.com/agentsea/erc8004):

| ERC-8004 | AgenticOcean | Notes |
|----------|-------------|-------|
| `tokenId` | `id` | Sequential u32 |
| `owner` | `owner` | Stellar Address |
| `agentURI` | `agentUri` | JSON string |
| `name` | `name` | Human-readable |
| — | `handle` | Unique ENS-like identifier (Stellar extension) |
| — | `vaultAddress` | Stellar-specific extension |
| — | `agentSigner` | Stellar-specific extension |
