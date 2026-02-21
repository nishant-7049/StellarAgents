# VaultFactory

Interacts with the on-chain `VaultFactory` contract, which deploys and tracks individual `UserVault` instances for each user.

## Usage

```typescript
import { VaultFactory } from "@agenticocean/vault";

const factory = new VaultFactory({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
});

const VAULT_FACTORY = "CASU6R7UN2ZOO46WQA6T7TNKIUJK75MNJB2KJFRVMI6FAZHQKUN6CDTW";
```

---

## Methods

### `getVaultForOwner(factoryAddress, ownerAddress)`

Look up a user's vault address. Returns `null` if the user hasn't created a vault yet.

```typescript
const vaultAddress = await factory.getVaultForOwner(
  VAULT_FACTORY,
  "G...USER_PUBLIC_KEY..."
);

if (vaultAddress) {
  console.log(`Vault: ${vaultAddress}`);
} else {
  console.log("No vault yet — create one from the dashboard");
}
```

**Returns:** `string | null`

---

### `hasVault(factoryAddress, ownerAddress)`

Check if a user has a vault without fetching the address.

```typescript
const has = await factory.hasVault(VAULT_FACTORY, "G...OWNER...");
```

**Returns:** `boolean`

---

### `getVaultCount(factoryAddress)`

Total number of vaults deployed through this factory.

```typescript
const count = await factory.getVaultCount(VAULT_FACTORY);
console.log(`${count} vaults created`);
```

**Returns:** `number`

---

## Creating a Vault (Frontend)

Vault creation requires a signed transaction from the owner's wallet. In a frontend context using Freighter:

```typescript
import { VaultFactory } from "@agenticocean/vault";
import { signTransaction, getPublicKey } from "@stellar/freighter-api";
import { TransactionBuilder, Networks, Contract, nativeToScVal, BASE_FEE } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";

const rpc = new Server("https://soroban-testnet.stellar.org");
const owner = await getPublicKey();
const account = await rpc.getAccount(owner);

const vaultFactoryContract = new Contract(VAULT_FACTORY);
const tx = new TransactionBuilder(account, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    vaultFactoryContract.call(
      "create_vault",
      nativeToScVal(owner, { type: "address" })
    )
  )
  .setTimeout(60)
  .build();

const sim = await rpc.simulateTransaction(tx);
const assembled = assembleTransaction(tx, sim).build();
const signed = await signTransaction(assembled.toXDR(), {
  networkPassphrase: Networks.TESTNET,
});

// Submit
const result = await rpc.sendTransaction(
  TransactionBuilder.fromXDR(signed, Networks.TESTNET)
);
```

The vault address is deterministic — derived from the owner's public key as a salt — so you can look it up immediately after creation using `getVaultForOwner()`.

---

## One vault per user

Each owner address can only have one vault. Calling `create_vault` for an address that already has a vault returns a `UserAlreadyHasVault` error from the contract.
