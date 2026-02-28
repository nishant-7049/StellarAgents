# @agenticocean/vault

TypeScript SDK for interacting with AgenticOcean's Soroban smart contracts on Stellar. Provides a clean API for vault management, agent policy control, and on-chain agent identity.

---

## Install

```bash
npm install @agenticocean/vault
```

---

## What's included

| Export | Description |
|--------|-------------|
| `VaultFactory` | Deploy new user vaults; look up vault by owner address |
| `UserVault` | Read vault balance, spend history, and agent policies |
| `AgentRegistry` | List agents, look up by ID or owner, register new agents |
| `ReputationRegistry` | Agent reputation scores and feedback records |
| `ValidationRegistry` | Agent validation status |
| `ContractReader` | Low-level contract simulation helper |

---

## Config

All classes accept a `StellarClientConfig`:

```typescript
interface StellarClientConfig {
  rpcUrl: string;                  // Soroban RPC endpoint
  networkPassphrase: string;       // Stellar network passphrase
  logger?: LoggerLike;             // optional custom logger
}
```

---

## Contract Addresses

Mainnet deployments (Stellar Public Network):

| Contract | Address |
|----------|---------|
| VaultFactory | `CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM` |
| AgentRegistry | `CDKHR3UUKCKXJ6CRKWKUZI3SKWAAKJMU6TGHRBM2VJJBCKEO6ETH55AU` |
| ReputationRegistry | `CB6B4EBQ3JXLGUWF5WGMQV63PL3K2WQP5LMEL2BZDIDTEPCIC5BDH6ZB` |
| ValidationRegistry | `CDX65CKW2NZQZK5U7DQRK6KVOBI4PTLQVGHYAEQ7OPPY2KRCDUAS2AL5` |
| USDC SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

---

## Typical usage

### 1) Look up a user's vault

```ts
import { VaultFactory } from "@agenticocean/vault";

const factory = new VaultFactory("CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM", {
  rpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
});

const vault = await factory.getVault("G...OWNER_ADDRESS...");
```

### 2) Read vault balance + agent policies

```ts
import { UserVault } from "@agenticocean/vault";

const userVault = new UserVault("C...VAULT_CONTRACT...", {
  rpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
});

const balance = await userVault.getBalance();
const remaining = await userVault.getRemainingLimit("G...AGENT_ADDRESS...");
```

---

## Type Reference

### `AgentPolicy`

The spending policy assigned to each agent on a vault:

```typescript
interface AgentPolicy {
  agentAddress: string;              // agent's Stellar public key
  dailyLimit: bigint;                // max USDC per 24h (in stroops)
  spentToday: bigint;                // USDC spent in current window (stroops)
  lastReset: number;                 // Unix timestamp of window start
  allowedDestinations: string[];     // whitelist of payable addresses ([] = any)
  isActive: boolean;                 // can be revoked with remove_agent()
}
```

### `AgentInfo`

On-chain agent registration record:

```typescript
interface AgentInfo {
  id: number;                // sequential NFT-like ID
  owner: string;             // Stellar address of the registrant
  name: string;              // human-readable name
  agentUri: string;          // JSON metadata (capabilities, pricing, endpoint)
  vaultAddress: string;      // vault that funds this agent
  agentSigner: string;       // public key that signs agent_pay() calls
  registeredAt: number;      // Unix timestamp
  isActive: boolean;
}
```
