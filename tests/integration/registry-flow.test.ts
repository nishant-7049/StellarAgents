import { describe, it, expect } from "vitest";

const RPC_URL = "https://soroban-testnet.stellar.org";
const REGISTRY = process.env.AGENT_REGISTRY_ADDRESS || "";

describe("Agent Registry Flow (Testnet)", () => {
  it("should register an agent on-chain", async () => {
    if (!REGISTRY) {
      console.log("Skipping: no AGENT_REGISTRY_ADDRESS set");
      return;
    }

    const { Keypair, Networks, TransactionBuilder, Contract, nativeToScVal } = await import("@stellar/stellar-sdk");
    const { Server, assembleTransaction } = await import("@stellar/stellar-sdk/rpc");

    const rpc = new Server(RPC_URL);
    const owner = Keypair.random();
    await fetch(`https://friendbot.stellar.org/?addr=${owner.publicKey()}`);
    await new Promise(r => setTimeout(r, 3000));

    const registry = new Contract(REGISTRY);
    const account = await rpc.getAccount(owner.publicKey());
    const vault = Keypair.random().publicKey();
    const signer = Keypair.random().publicKey();
    const handle = `test-agent-${Date.now()}`;

    const tx = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        registry.call(
          "mint_identity",
          nativeToScVal(owner.publicKey(), { type: "address" }),
          nativeToScVal("Test Yield Agent", { type: "string" }),
          nativeToScVal(handle, { type: "string" }),
          nativeToScVal('{"capabilities":["yield"]}', { type: "string" }),
          nativeToScVal(vault, { type: "address" }),
          nativeToScVal(signer, { type: "address" }),
        )
      )
      .setTimeout(60)
      .build();

    const sim = await rpc.simulateTransaction(tx);
    expect("result" in sim).toBe(true);

    const assembled = assembleTransaction(tx, sim as any).build();
    assembled.sign(owner);
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

  it("should query agent count", async () => {
    if (!REGISTRY) {
      console.log("Skipping: no AGENT_REGISTRY_ADDRESS set");
      return;
    }

    const { Keypair, Networks, TransactionBuilder, Contract } = await import("@stellar/stellar-sdk");
    const { Server } = await import("@stellar/stellar-sdk/rpc");

    const rpc = new Server(RPC_URL);
    const user = Keypair.random();
    await fetch(`https://friendbot.stellar.org/?addr=${user.publicKey()}`);
    await new Promise(r => setTimeout(r, 3000));

    const registry = new Contract(REGISTRY);
    const account = await rpc.getAccount(user.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(registry.call("active_count"))
      .setTimeout(30)
      .build();

    const sim = await rpc.simulateTransaction(tx);
    expect("result" in sim).toBe(true);
  }, 30_000);
});
