# Installation

```bash
npm install @agenticocean/vault
# or
pnpm add @agenticocean/vault
```

## Dependencies

`@agenticocean/vault` depends on `@stellar/stellar-sdk` for Soroban RPC calls. It is listed as a peer dependency — install it if you don't have it already:

```bash
npm install @stellar/stellar-sdk
```

## Setup

```typescript
import {
  VaultFactory,
  UserVault,
  AgentRegistry,
} from "@agenticocean/vault";

const config = {
  rpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
};

const CONTRACTS = {
  vaultFactory: "CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM",
  agentRegistry: "CDKHR3UUKCKXJ6CRKWKUZI3SKWAAKJMU6TGHRBM2VJJBCKEO6ETH55AU",
};

const vaultFactory = new VaultFactory(CONTRACTS.vaultFactory, config);
const agentRegistry = new AgentRegistry(CONTRACTS.agentRegistry, config);

// UserVault is constructed per-vault instance:
const userVault = new UserVault("C...YOUR_VAULT_ADDRESS...", config);
```

## Contract Addresses

Mainnet deployments (Stellar Public Network):

```typescript
const CONTRACTS = {
  vaultFactory:         "CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM",
  agentRegistry:        "CDKHR3UUKCKXJ6CRKWKUZI3SKWAAKJMU6TGHRBM2VJJBCKEO6ETH55AU",
  reputationRegistry:   "CB6B4EBQ3JXLGUWF5WGMQV63PL3K2WQP5LMEL2BZDIDTEPCIC5BDH6ZB",
  validationRegistry:   "CDX65CKW2NZQZK5U7DQRK6KVOBI4PTLQVGHYAEQ7OPPY2KRCDUAS2AL5",
  usdcSac:              "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
};
```

See: [Mainnet guide](../../getting-started/mainnet.md)
