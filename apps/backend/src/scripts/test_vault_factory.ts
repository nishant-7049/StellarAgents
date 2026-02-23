import { Address, Contract, nativeToScVal, TransactionBuilder, Networks, scValToNative } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

dotenv.config({ path: "../../.env" });
dotenv.config({ path: "../../.env.contracts", override: true });
dotenv.config({ path: ".env", override: true });

import dotenv from "dotenv";

const rpc = new Server("https://soroban.stellar.org");
const FACTORY = process.env.VAULT_FACTORY_ADDRESS || "CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM";
const READ_SOURCE = "GB4WBZZRI3RWJI7IUBOMO4R7SILFN2IWNXRWTLIGM7E7ZF3YV6N5HNME";

async function main() {
  const account = await rpc.getAccount(READ_SOURCE);
  const contract = new Contract(FACTORY);

  // Test vault_count (no args)
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(contract.call("vault_count"))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if ("result" in sim) {
    console.log("vault_count:", scValToNative(sim.result!.retval));
    console.log("VaultFactory is ALIVE and responding!");
  } else {
    console.log("Simulation failed:", (sim as any).error);
  }
}
main().catch(e => console.error(e.message));
