/**
 * Retry restore for ReputationRegistry and ValidationRegistry.
 */
import dotenv from "dotenv";
import path from "path";
import {
  Keypair, TransactionBuilder, Networks, Operation,
  SorobanDataBuilder, Address, xdr,
} from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";

const rootDir = path.resolve(process.cwd(), "../..");
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config({ path: path.join(rootDir, ".env.contracts"), override: true });
dotenv.config({ path: path.join(process.cwd(), ".env"), override: true });

const RPC_URL = process.env.STELLAR_RPC_URL || "https://soroban.stellar.org";
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "";

const REMAINING = {
  ReputationRegistry: process.env.REPUTATION_REGISTRY_ADDRESS || "",
  ValidationRegistry: process.env.VALIDATION_REGISTRY_ADDRESS || "",
};

const rpc = new Server(RPC_URL);

function contractInstanceKey(contractAddress: string): xdr.LedgerKey {
  const addr = new Address(contractAddress);
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: addr.toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    })
  );
}

async function sendAndWait(admin: Keypair, tx: any): Promise<string> {
  const sim = await rpc.simulateTransaction(tx);
  if ("error" in sim && !("result" in sim)) {
    throw new Error(`Sim failed: ${(sim as any).error}`);
  }
  const assembled = assembleTransaction(tx, sim as any).build();
  assembled.sign(admin);

  const sendResult = await rpc.sendTransaction(assembled);
  console.log(`  Sent: ${sendResult.hash} status=${sendResult.status}`);
  if (sendResult.status === "ERROR") {
    throw new Error(`Send ERROR: ${JSON.stringify((sendResult as any).errorResult || sendResult)}`);
  }
  if (sendResult.status !== "PENDING") {
    throw new Error(`Unexpected send status: ${sendResult.status}`);
  }

  // Poll 45s
  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const txResult = await rpc.getTransaction(sendResult.hash);
      if (txResult.status === "SUCCESS") return sendResult.hash;
      if (txResult.status === "FAILED") throw new Error("tx FAILED on-chain");
    } catch (e: any) {
      if (e.message?.includes("union switch") || e.message?.includes("Bad union")) {
        // SDK parse error — check Horizon instead
        const hz = await fetch(`https://horizon.stellar.org/transactions/${sendResult.hash}`);
        if (hz.ok) {
          const hzData = await hz.json() as any;
          if (hzData.successful) return sendResult.hash;
          if (hzData.successful === false) throw new Error("tx failed on Horizon");
        }
        continue; // still pending
      }
      throw e;
    }
  }
  // If we get here, return hash — tx may be pending but likely succeeded
  return sendResult.hash;
}

async function main() {
  const admin = Keypair.fromSecret(ADMIN_SECRET);
  const latestLedger = await rpc.getLatestLedger();
  console.log("Current ledger:", latestLedger.sequence, "| Admin:", admin.publicKey());

  for (const [name, address] of Object.entries(REMAINING)) {
    if (!address) { console.log(`Skip ${name}: no address`); continue; }
    const key = contractInstanceKey(address);

    const resp = await rpc.getLedgerEntries(key);
    const entry = resp.entries?.[0];
    if (!entry) { console.log(`${name}: not found`); continue; }

    const liveUntil = entry.liveUntilLedgerSeq ?? 0;
    const isExpired = liveUntil <= latestLedger.sequence;
    console.log(`\n${name}: liveUntil=${liveUntil} expired=${isExpired}`);

    if (isExpired) {
      console.log(`  Restoring ${name}...`);
      const account = await rpc.getAccount(admin.publicKey());
      const restoreTx = new TransactionBuilder(account, {
        fee: "10000000",
        networkPassphrase: Networks.PUBLIC,
      })
        .addOperation(Operation.restoreFootprint({}))
        .setSorobanData(new SorobanDataBuilder().setReadWrite([key]).build())
        .setTimeout(90)
        .build();

      try {
        const hash = await sendAndWait(admin, restoreTx);
        console.log(`  Restored ${name}: ${hash}`);
      } catch (e: any) {
        console.error(`  Restore failed: ${e.message}`);
        continue;
      }
    }

    // Bump TTL
    console.log(`  Bumping TTL for ${name}...`);
    const account2 = await rpc.getAccount(admin.publicKey());
    const bumpTx = new TransactionBuilder(account2, {
      fee: "10000000",
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(Operation.extendFootprintTtl({ extendTo: 535_000 }))
      .setSorobanData(new SorobanDataBuilder().setReadOnly([key]).build())
      .setTimeout(90)
      .build();

    try {
      const hash = await sendAndWait(admin, bumpTx);
      console.log(`  TTL bumped ${name}: ${hash}`);
    } catch (e: any) {
      console.warn(`  Bump failed: ${e.message}`);
    }
  }

  // Final check
  console.log("\n=== Final Status ===");
  const final = await rpc.getLatestLedger();
  for (const [name, address] of Object.entries(REMAINING)) {
    if (!address) continue;
    const key = contractInstanceKey(address);
    const resp = await rpc.getLedgerEntries(key);
    const liveUntil = resp.entries?.[0]?.liveUntilLedgerSeq ?? 0;
    console.log(`  ${name}: ${liveUntil > final.sequence ? "ALIVE" : "STILL EXPIRED"} (until ledger ${liveUntil})`);
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
