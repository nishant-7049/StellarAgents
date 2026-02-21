# AgentRegistry

Read and write access to the on-chain `AgentRegistry` contract — an ERC-8004-inspired agent identity system on Stellar. Each registered agent gets a sequential NFT-like ID and a structured metadata record.

## Usage

```typescript
import { AgentRegistry } from "@agenticocean/vault";

const registry = new AgentRegistry({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
});

const AGENT_REGISTRY = "CC7CSOZE2KA2WVSFIQPJKGNHCETOKK4UCEHT66CGXLNA5ECA4HHPHH7V";
```

---

## Read Methods

### `listAgents(registryAddress, startId?, limit?)`

Get a paginated list of active agents.

```typescript
const agents = await registry.listAgents(AGENT_REGISTRY, 1, 20);
agents.forEach(agent => {
  console.log(`[${agent.id}] ${agent.name} — ${agent.owner}`);
  const meta = JSON.parse(agent.agentUri);
  console.log(`  Capabilities: ${meta.capabilities?.join(", ")}`);
  console.log(`  Price: ${meta.pricing?.amount} stroops/query`);
});
```

**Returns:** `AgentInfo[]`

---

### `getAgent(registryAddress, agentId)`

Fetch a single agent by its numeric ID.

```typescript
const agent = await registry.getAgent(AGENT_REGISTRY, 1);
console.log(`Name: ${agent.name}`);
console.log(`Owner: ${agent.owner}`);
console.log(`Vault: ${agent.vaultAddress}`);
console.log(`Signer: ${agent.agentSigner}`);
console.log(`Active: ${agent.isActive}`);
```

**Returns:** `AgentInfo | null`

---

### `getAgentByOwner(registryAddress, ownerAddress)`

Find the agent ID registered by a given owner.

```typescript
const agentId = await registry.getAgentByOwner(AGENT_REGISTRY, "G...OWNER...");
if (agentId !== null) {
  const agent = await registry.getAgent(AGENT_REGISTRY, agentId);
  console.log(`Your agent: ${agent.name}`);
}
```

**Returns:** `number | null`

---

### `getAgentCount(registryAddress)`

Total number of active agents.

```typescript
const count = await registry.getAgentCount(AGENT_REGISTRY);
console.log(`${count} agents registered`);
```

---

## AgentInfo Structure

```typescript
interface AgentInfo {
  id: number;              // sequential ID (starts at 1)
  owner: string;           // Stellar public key of the registrant
  name: string;            // display name
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

## Registering an Agent (requires signing)

To register, use the dashboard's [Register Agent page](../../dashboard/register-agent.md) or build a signed transaction:

```typescript
import { signTransaction } from "@stellar/freighter-api";

const agentMetadata = JSON.stringify({
  capabilities: ["yield_optimization"],
  endpoints: { query: "https://api.example.com/yield/query" },
  pricing: { protocol: "x402", amount: "100000", asset: "USDC" },
  model: "llama-3.3-70b-versatile",
  version: "0.1.0",
});

// Build the register transaction
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(
    registryContract.call(
      "register",
      nativeToScVal(ownerAddress, { type: "address" }),
      nativeToScVal("My Yield Agent", { type: "string" }),
      nativeToScVal(agentMetadata, { type: "string" }),
      nativeToScVal(vaultAddress, { type: "address" }),
      nativeToScVal(agentSignerPublicKey, { type: "address" }),
    )
  )
  .setTimeout(60)
  .build();

const sim = await rpc.simulateTransaction(tx);
const assembled = assembleTransaction(tx, sim).build();
const signed = await signTransaction(assembled.toXDR(), { networkPassphrase: Networks.TESTNET });
```

---

## ERC-8004 Mapping

AgentiCOcean's registry implements the Stellar equivalent of [ERC-8004](https://github.com/agentsea/erc8004):

| ERC-8004 | AgentiCOcean | Notes |
|----------|-------------|-------|
| `tokenId` | `id` | Sequential u32 |
| `owner` | `owner` | Stellar Address |
| `agentURI` | `agentUri` | JSON string |
| `name` | `name` | Human-readable |
| — | `vaultAddress` | Stellar-specific extension |
| — | `agentSigner` | Stellar-specific extension |
