/**
 * Restore expired Soroban contract ledger entries.
 *
 * All four contracts (VaultFactory, AgentRegistry, ReputationRegistry, ValidationRegistry)
 * have expired TTLs. This script restores them so they are queryable again.
 *
 * Run from apps/backend:
 *   npx tsx src/scripts/restore-contracts.ts
 */
import dotenv from "dotenv";
import path from "path";
import {
  Keypair, TransactionBuilder, Networks, Operation,
  SorobanDataBuilder, Address, xdr,
} from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";

// Load env
const rootDir = path.resolve(process.cwd(), "../..");
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config({ path: path.join(rootDir, ".env.contracts"), override: true });
dotenv.config({ path: path.join(process.cwd(), ".env"), override: true });

const RPC_URL = process.env.STELLAR_RPC_URL || "https://soroban.stellar.org";
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || "";

const CONTRACTS: Record<string, string> = {
  VaultFactory:         process.env.VAULT_FACTORY_ADDRESS || "",
  AgentRegistry:        process.env.AGENT_REGISTRY_ADDRESS || "",
  ReputationRegistry:   process.env.REPUTATION_REGISTRY_ADDRESS || "",
  ValidationRegistry:   process.env.VALIDATION_REGISTRY_ADDRESS || "",
};

// WASM hash for UserVault — must be restored so VaultFactory.create_vault() can deploy new vaults
const VAULT_WASM_HASH = process.env.VAULT_WASM_HASH || "";

const rpc = new Server(RPC_URL);

function contractCodeKey(wasmHashHex: string): xdr.LedgerKey {
  const hashBytes = Buffer.from(wasmHashHex, "hex");
  return xdr.LedgerKey.contractCode(
    new xdr.LedgerKeyContractCode({ hash: hashBytes })
  );
}

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

async function restoreEntry(
  admin: Keypair,
  name: string,
  key: xdr.LedgerKey,
): Promise<void> {
  console.log(`\n[Restore] ${name}...`);
  const account = await rpc.getAccount(admin.publicKey());

  // Build a transaction with RestoreFootprint op
  // The expired key goes into readWrite of the SorobanData
  const sorobanData = new SorobanDataBuilder()
    .setReadWrite([key])
    .build();

  const tx = new TransactionBuilder(account, {
    fee: "10000000",           // High base fee — simulation will refine
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(Operation.restoreFootprint({}))
    .setSorobanData(sorobanData)
    .setTimeout(60)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (!("result" in sim) && "error" in sim) {
    const simErr = (sim as any);
    // If simulation fails because the entry is already alive, skip
    if (simErr.error?.includes("already live") || simErr.error?.includes("not expired")) {
      console.log(`  ${name} is already live, skipping.`);
      return;
    }
    console.error(`  Simulation failed for ${name}:`, simErr.error);
    throw new Error(`Simulation failed: ${simErr.error}`);
  }

  // assembleTransaction injects the correct resource fees
  const assembled = assembleTransaction(tx, sim as any).build();
  assembled.sign(admin);

  const sendResult = await rpc.sendTransaction(assembled);
  if (sendResult.status !== "PENDING") {
    throw new Error(`Send failed: ${sendResult.status}`);
  }

  // Poll for confirmation
  let txResult = await rpc.getTransaction(sendResult.hash);
  let waited = 0;
  while (txResult.status === "NOT_FOUND" && waited < 30) {
    await new Promise(r => setTimeout(r, 1000));
    txResult = await rpc.getTransaction(sendResult.hash);
    waited++;
  }

  if (txResult.status === "SUCCESS") {
    console.log(`  ✓ ${name} restored. txHash: ${sendResult.hash}`);
  } else {
    throw new Error(`Restore tx failed: ${txResult.status}`);
  }
}

async function bumpEntry(
  admin: Keypair,
  name: string,
  key: xdr.LedgerKey,
  ledgersToLive: number = 535_000, // ~1 year at ~6s/ledger
): Promise<void> {
  console.log(`[Bump TTL] ${name}...`);
  const account = await rpc.getAccount(admin.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: "10000000",
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(
      Operation.extendFootprintTtl({ extendTo: ledgersToLive })
    )
    .setSorobanData(
      new SorobanDataBuilder().setReadOnly([key]).build()
    )
    .setTimeout(60)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (!("result" in sim) && "error" in sim) {
    console.warn(`  Bump simulation failed for ${name}:`, (sim as any).error);
    return; // Non-fatal
  }

  const assembled = assembleTransaction(tx, sim as any).build();
  assembled.sign(admin);

  const sendResult = await rpc.sendTransaction(assembled);
  if (sendResult.status !== "PENDING") {
    console.warn(`  Bump send failed for ${name}: ${sendResult.status}`);
    return;
  }

  let txResult = await rpc.getTransaction(sendResult.hash);
  let waited = 0;
  while (txResult.status === "NOT_FOUND" && waited < 30) {
    await new Promise(r => setTimeout(r, 1000));
    txResult = await rpc.getTransaction(sendResult.hash);
    waited++;
  }

  if (txResult.status === "SUCCESS") {
    console.log(`  ✓ ${name} TTL extended. txHash: ${sendResult.hash}`);
  } else {
    console.warn(`  Bump tx failed for ${name}: ${txResult.status}`);
  }
}

async function main() {
  if (!ADMIN_SECRET) {
    console.error("ADMIN_SECRET_KEY not set");
    process.exit(1);
  }

  const admin = Keypair.fromSecret(ADMIN_SECRET);
  console.log("Admin:", admin.publicKey());

  const latestLedger = await rpc.getLatestLedger();
  console.log("Current ledger:", latestLedger.sequence);

  // Check XLM balance
  const acct = await rpc.getAccount(admin.publicKey());
  console.log("Admin account found on network.");

  // Process each contract
  for (const [name, address] of Object.entries(CONTRACTS)) {
    if (!address) {
      console.log(`Skipping ${name}: address not set`);
      continue;
    }

    const key = contractInstanceKey(address);

    // Check current status
    const resp = await rpc.getLedgerEntries(key);
    const entry = resp.entries?.[0];
    const liveUntil = entry?.liveUntilLedgerSeq ?? 0;
    const isExpired = liveUntil <= latestLedger.sequence;

    if (!entry) {
      console.log(`${name}: NOT FOUND on network — may need full redeploy`);
      continue;
    }

    if (isExpired) {
      try {
        await restoreEntry(admin, name, key);
      } catch (e: any) {
        console.error(`  Failed to restore ${name}:`, e.message);
        continue;
      }
    } else {
      console.log(`${name}: Already live (until ledger ${liveUntil})`);
    }

    // Always bump TTL after restore (or if already live)
    try {
      await bumpEntry(admin, name, key);
    } catch (e: any) {
      console.warn(`  Failed to bump ${name}:`, e.message);
    }
  }

  // Restore UserVault WASM code (required for VaultFactory.create_vault to deploy new vaults)
  if (VAULT_WASM_HASH) {
    console.log("\n=== UserVault WASM Code ===");
    const wasmKey = contractCodeKey(VAULT_WASM_HASH);
    const wasmResp = await rpc.getLedgerEntries(wasmKey);
    const wasmEntry = wasmResp.entries?.[0];
    const wasmLiveUntil = wasmEntry?.liveUntilLedgerSeq ?? 0;
    const wasmExpired = wasmLiveUntil <= latestLedger.sequence;

    if (!wasmEntry) {
      console.log("UserVault WASM: NOT FOUND — WASM may need to be re-uploaded");
    } else if (wasmExpired) {
      console.log(`UserVault WASM: EXPIRED (liveUntil=${wasmLiveUntil}, current=${latestLedger.sequence})`);
      try {
        await restoreEntry(admin, "UserVault WASM", wasmKey);
        await bumpEntry(admin, "UserVault WASM", wasmKey);
      } catch (e: any) {
        console.error("  Failed to restore UserVault WASM:", e.message);
      }
    } else {
      console.log(`UserVault WASM: ALIVE (live until ledger ${wasmLiveUntil})`);
      await bumpEntry(admin, "UserVault WASM", wasmKey);
    }
  } else {
    console.log("\nSkipping UserVault WASM: VAULT_WASM_HASH not set");
  }

  // Verify final state
  console.log("\n=== Final Status ===");
  const finalLedger = await rpc.getLatestLedger();
  for (const [name, address] of Object.entries(CONTRACTS)) {
    if (!address) continue;
    const key = contractInstanceKey(address);
    const resp = await rpc.getLedgerEntries(key);
    const liveUntil = resp.entries?.[0]?.liveUntilLedgerSeq ?? 0;
    const status = liveUntil > finalLedger.sequence ? "ALIVE" : "STILL EXPIRED";
    console.log(`  ${name}: ${status} (live until ledger ${liveUntil})`);
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
