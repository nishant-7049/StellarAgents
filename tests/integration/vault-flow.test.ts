import { describe, it, expect, beforeAll } from "vitest";

const RPC_URL = "https://soroban-testnet.stellar.org";
const FACTORY = process.env.VAULT_FACTORY_ADDRESS || "";

describe("Vault Lifecycle (Testnet)", () => {
  it("should skip if no factory address deployed", async () => {
    if (!FACTORY) {
      console.log("Skipping vault-flow tests: no VAULT_FACTORY_ADDRESS set");
      return;
    }

    // Dynamic import only when we actually run
    const { Keypair, Networks, TransactionBuilder, Contract, nativeToScVal } = await import("@stellar/stellar-sdk");
    const { Server, assembleTransaction } = await import("@stellar/stellar-sdk/rpc");

    const rpc = new Server(RPC_URL);
    const user = Keypair.random();

    // Fund via friendbot
    await fetch(`https://friendbot.stellar.org/?addr=${user.publicKey()}`);
    await new Promise(r => setTimeout(r, 3000));

    const factory = new Contract(FACTORY);
    const account = await rpc.getAccount(user.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(factory.call("create_vault", nativeToScVal(user.publicKey(), { type: "address" })))
      .setTimeout(60)
      .build();

    const sim = await rpc.simulateTransaction(tx);
    expect("result" in sim).toBe(true);

    const assembled = assembleTransaction(tx, sim as any).build();
    assembled.sign(user);
    const result = await rpc.sendTransaction(assembled);
    expect(result.status).toBe("PENDING");

    let txResult = await rpc.getTransaction(result.hash);
    let waited = 0;
    while (txResult.status === "NOT_FOUND" && waited < 30) {
      await new Promise(r => setTimeout(r, 1000));
      txResult = await rpc.getTransaction(result.hash);
      waited++;
    }
    expect(txResult.status).toBe("SUCCESS");
  }, 60_000);

  it("should check vault exists via factory", async () => {
    if (!FACTORY) {
      console.log("Skipping: no VAULT_FACTORY_ADDRESS");
      return;
    }

    const { Keypair, Networks, TransactionBuilder, Contract, nativeToScVal } = await import("@stellar/stellar-sdk");
    const { Server } = await import("@stellar/stellar-sdk/rpc");

    const rpc = new Server(RPC_URL);
    const user = Keypair.random();
    await fetch(`https://friendbot.stellar.org/?addr=${user.publicKey()}`);
    await new Promise(r => setTimeout(r, 3000));

    const factory = new Contract(FACTORY);
    const account = await rpc.getAccount(user.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(factory.call("has_vault", nativeToScVal(user.publicKey(), { type: "address" })))
      .setTimeout(30)
      .build();

    const sim = await rpc.simulateTransaction(tx);
    expect("result" in sim).toBe(true);
  }, 30_000);
});
