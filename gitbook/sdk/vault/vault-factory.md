# VaultFactory

Interacts with the on-chain `VaultFactory` contract, which deploys and tracks individual `UserVault` instances for each user.

## Usage

```typescript
import { VaultFactory } from "@agenticocean/vault";

const VAULT_FACTORY = "CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM";

const factory = new VaultFactory(VAULT_FACTORY, {
  rpcUrl: "https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
});
```

---

## Methods

### `getVault(ownerAddress)`

Look up a user's vault address. Returns `null` if the user hasn't created a vault yet.

```typescript
const vaultAddress = await factory.getVault("G...USER_PUBLIC_KEY...");

if (vaultAddress) {
  console.log(`Vault: ${vaultAddress}`);
} else {
  console.log("No vault yet — create one from the dashboard");
}
```

**Returns:** `string | null`

---

### `hasVault(ownerAddress)`

Check if a user has a vault without fetching the address.

```typescript
const has = await factory.hasVault("G...OWNER...");
```

**Returns:** `boolean`

---

### `vaultCount()`

Total number of vaults deployed through this factory.

```typescript
const count = await factory.vaultCount();
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

const rpc = new Server("https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY");
const owner = await getPublicKey();
const account = await rpc.getAccount(owner);

const vaultFactoryContract = new Contract(VAULT_FACTORY);
const tx = new TransactionBuilder(account, {
  fee: BASE_FEE,
  networkPassphrase: Networks.PUBLIC,
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
  networkPassphrase: Networks.PUBLIC,
});

// Submit
const result = await rpc.sendTransaction(
  TransactionBuilder.fromXDR(signed, Networks.TESTNET)
);
```

The vault address is deterministic — derived from a monotonically increasing salt in the factory — and each owner can only register one vault. You can look it up after creation using `getVault()`.

---

## One vault per user

Each owner address can only have one vault. Calling `create_vault` for an address that already has a vault returns a `UserAlreadyHasVault` error from the contract.
