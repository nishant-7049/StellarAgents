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
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
};

const vaultFactory = new VaultFactory(config);
const userVault = new UserVault(config);
const agentRegistry = new AgentRegistry(config);
```

## Contract Addresses

You'll need the deployed contract addresses. For testnet, use these:

```typescript
const CONTRACTS = {
  vaultFactory: "CASU6R7UN2ZOO46WQA6T7TNKIUJK75MNJB2KJFRVMI6FAZHQKUN6CDTW",
  agentRegistry: "CC7CSOZE2KA2WVSFIQPJKGNHCETOKK4UCEHT66CGXLNA5ECA4HHPHH7V",
  usdcSac: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
};
```
