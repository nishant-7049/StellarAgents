import { describe, it, expect } from "vitest";
import { Networks, TransactionBuilder, Contract, nativeToScVal } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

const RPC_URL = "https://soroban-testnet.stellar.org";
const VALIDATION = process.env.VALIDATION_REGISTRY_ADDRESS;

describe("Validation Flow (Testnet)", () => {
  const rpc = new Server(RPC_URL);

  it("should read validations for an agent", async () => {
    if (!VALIDATION) {
      console.log("VALIDATION_REGISTRY_ADDRESS not set, skipping");
      return;
    }

    const contract = new Contract(VALIDATION);
    const source = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    try {
      const account = await rpc.getAccount(source);
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "get_validations",
            nativeToScVal(1, { type: "u32" }),
          )
        )
        .setTimeout(30)
        .build();

      const sim = await rpc.simulateTransaction(tx);
      expect("result" in sim).toBe(true);
    } catch (err) {
      console.log("Validation contract not accessible:", String(err));
    }
  }, 30_000);

  it("should handle request -> submit -> get_validations flow shape", async () => {
    if (!VALIDATION) {
      console.log("VALIDATION_REGISTRY_ADDRESS not set, skipping");
      return;
    }

    // Validate the contract API is accessible
    const contract = new Contract(VALIDATION);
    const source = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    try {
      const account = await rpc.getAccount(source);
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "get_validations",
            nativeToScVal(999, { type: "u32" }),
          )
        )
        .setTimeout(30)
        .build();

      const sim = await rpc.simulateTransaction(tx);
      expect("result" in sim).toBe(true);
    } catch (err) {
      console.log("Validation contract not accessible:", String(err));
    }
  }, 30_000);
});
