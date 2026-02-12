#!/usr/bin/env tsx
/**
 * x402 End-to-End Test — Real Testnet
 *
 * Tests the FULL x402 payment flow:
 * 1. Agent builds X-PAYMENT header (with signed SorobanAuthorizationEntry)
 * 2. Agent sends HTTP request with header to backend
 * 3. Backend's x402 middleware extracts and validates the header
 * 4. Facilitator settles the payment on-chain (agent_pay via vault)
 * 5. Backend returns 200 with yield strategy + payment proof
 * 6. Verify on-chain: vault balance decreased, facilitator received USDC
 *
 * Prerequisites:
 * - Backend running on localhost:3001 (pnpm dev:backend)
 * - .env and .env.contracts populated with real testnet addresses
 * - Demo vault funded with USDC and agent authorized
 *
 * Usage: npx tsx scripts/test-x402-e2e.ts
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Contract,
  nativeToScVal,
  scValToNative,
  authorizeEntry,
  xdr,
} from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ── Load environment ──

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config({ path: path.join(rootDir, ".env.contracts"), override: true });

const RPC_URL = process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const VAULT_ADDRESS = process.env.DEMO_VAULT_ADDRESS!;
const USDC_SAC = process.env.USDC_SAC_ADDRESS!;
const FACILITATOR_SECRET = process.env.FACILITATOR_SECRET_KEY!;
const AGENT_SECRET = process.env.AGENT_SIGNER_SECRET_KEY!;

// ── Helpers ──

const rpc = new Server(RPC_URL);

function log(step: string, msg: string, data?: any) {
  const prefix = `[x402-e2e] [${step}]`;
  if (data) {
    console.log(`${prefix} ${msg}`, typeof data === "object" ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`${prefix} ${msg}`);
  }
}

function logError(step: string, msg: string, err?: any) {
  console.error(`[x402-e2e] [${step}] ERROR: ${msg}`, err?.message || err || "");
}

async function getVaultBalance(): Promise<bigint> {
  const vault = new Contract(VAULT_ADDRESS);
  const facilitatorKp = Keypair.fromSecret(FACILITATOR_SECRET);
  const account = await rpc.getAccount(facilitatorKp.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(vault.call("balance"))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (!("result" in sim) || !sim.result) {
    throw new Error("Failed to simulate balance query");
  }

  return BigInt(scValToNative(sim.result.retval));
}

async function getTokenBalance(address: string): Promise<bigint> {
  const usdc = new Contract(USDC_SAC);
  const facilitatorKp = Keypair.fromSecret(FACILITATOR_SECRET);
  const account = await rpc.getAccount(facilitatorKp.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      usdc.call("balance", nativeToScVal(address, { type: "address" }))
    )
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (!("result" in sim) || !sim.result) {
    throw new Error("Failed to simulate token balance query");
  }

  return BigInt(scValToNative(sim.result.retval));
}

// ── Main Test ──

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  x402 End-to-End Test — Stellar Testnet");
  console.log("=".repeat(70) + "\n");

  // Validate config
  if (!VAULT_ADDRESS || !USDC_SAC || !FACILITATOR_SECRET || !AGENT_SECRET) {
    logError("config", "Missing required env vars. Ensure .env and .env.contracts exist.");
    process.exit(1);
  }

  const agentKp = Keypair.fromSecret(AGENT_SECRET);
  const facilitatorKp = Keypair.fromSecret(FACILITATOR_SECRET);
  const PAYMENT_AMOUNT = "100000"; // 0.01 USDC in stroops (7 decimals)

  log("config", "Test configuration:", {
    vault: VAULT_ADDRESS,
    agent: agentKp.publicKey(),
    facilitator: facilitatorKp.publicKey(),
    paymentAmount: `${PAYMENT_AMOUNT} stroops (0.01 USDC)`,
    backend: BACKEND_URL,
  });

  // ── Step 1: Check initial balances ──
  log("step-1", "Checking initial vault balance...");
  let vaultBalanceBefore: bigint;
  let facilitatorBalanceBefore: bigint;
  try {
    vaultBalanceBefore = await getVaultBalance();
    facilitatorBalanceBefore = await getTokenBalance(facilitatorKp.publicKey());
    log("step-1", `Vault balance: ${vaultBalanceBefore} stroops (${Number(vaultBalanceBefore) / 10_000_000} USDC)`);
    log("step-1", `Facilitator USDC balance: ${facilitatorBalanceBefore} stroops`);
  } catch (err) {
    logError("step-1", "Failed to read initial balances", err);
    process.exit(1);
  }

  if (vaultBalanceBefore < BigInt(PAYMENT_AMOUNT)) {
    logError("step-1", `Vault balance (${vaultBalanceBefore}) < payment amount (${PAYMENT_AMOUNT}). Deposit more USDC.`);
    process.exit(1);
  }

  // ── Step 2: Check backend is running ──
  log("step-2", "Checking backend health...");
  try {
    const healthResp = await fetch(`${BACKEND_URL}/health`);
    const health = await healthResp.json();
    log("step-2", "Backend health:", health);
  } catch (err) {
    logError("step-2", "Backend not reachable. Start with: pnpm dev:backend", err);
    process.exit(1);
  }

  // ── Step 3: Request without payment → expect 402 ──
  log("step-3", "Requesting /api/yield/query without payment (expect 402)...");
  const noPayResp = await fetch(`${BACKEND_URL}/api/yield/query?q=best+yield`);
  if (noPayResp.status !== 402) {
    logError("step-3", `Expected 402, got ${noPayResp.status}`);
    process.exit(1);
  }
  const requirements = await noPayResp.json();
  log("step-3", "Got 402 response:", requirements);

  // ── Step 4: Build signed auth entry ──
  log("step-4", "Building signed SorobanAuthorizationEntry...");

  const vault = new Contract(VAULT_ADDRESS);
  const memo = `x402_${Date.now().toString(36)}`;

  // Build the agent_pay tx (using facilitator as source — they'll submit it)
  const account = await rpc.getAccount(facilitatorKp.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      vault.call(
        "agent_pay",
        nativeToScVal(agentKp.publicKey(), { type: "address" }),
        nativeToScVal(facilitatorKp.publicKey(), { type: "address" }),
        nativeToScVal(BigInt(PAYMENT_AMOUNT), { type: "i128" }),
        nativeToScVal(memo, { type: "symbol" }),
      )
    )
    .setTimeout(60)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (!("result" in sim)) {
    logError("step-4", "Simulation failed", sim);
    process.exit(1);
  }

  const authEntries = sim.result?.auth || [];
  if (authEntries.length === 0) {
    logError("step-4", "No auth entries from simulation");
    process.exit(1);
  }

  log("step-4", `Got ${authEntries.length} auth entries from simulation`);

  // Sign the auth entry with agent's private key
  const latestLedger = sim.latestLedger;
  const validUntilLedger = latestLedger + 1000; // ~83 minutes

  const signedAuth = await authorizeEntry(
    authEntries[0],
    agentKp,
    validUntilLedger,
    Networks.TESTNET,
  );

  log("step-4", "Auth entry signed successfully", {
    validUntilLedger,
    authXdrLength: signedAuth.toXDR("base64").length,
  });

  // ── Step 5: Build X-PAYMENT header with assembled tx ──
  log("step-5", "Assembling transaction with signed auth...");

  // Replace unsigned auth with signed auth in simulation, then assemble.
  // This ensures the footprint includes the correct auth nonce storage keys.
  sim.result!.auth = [signedAuth];
  const assembled = assembleTransaction(tx, sim).build();

  log("step-5", "Building X-PAYMENT header...");

  const x402Payload = {
    x402Version: 1,
    scheme: "stellar-vault",
    network: "stellar:testnet",
    payload: {
      vaultContract: VAULT_ADDRESS,
      agentId: 1,
      agentSigner: agentKp.publicKey(),
      payTo: facilitatorKp.publicKey(),
      amount: PAYMENT_AMOUNT,
      asset: USDC_SAC,
      memo,
      signedAuthEntry: signedAuth.toXDR("base64"),
      assembledTxXdr: assembled.toXDR("base64"),
      expirationLedger: validUntilLedger,
    },
  };

  const xPaymentHeader = Buffer.from(JSON.stringify(x402Payload)).toString("base64");
  log("step-5", `X-PAYMENT header built (${xPaymentHeader.length} chars)`);

  // ── Step 6: Send request with payment ──
  log("step-6", "Sending request with X-PAYMENT header...");

  const startTime = Date.now();
  const paidResp = await fetch(
    `${BACKEND_URL}/api/yield/query?q=best+yield&risk=moderate`,
    {
      headers: {
        "X-PAYMENT": xPaymentHeader,
      },
    }
  );
  const elapsed = Date.now() - startTime;

  log("step-6", `Response status: ${paidResp.status} (${elapsed}ms)`);

  if (paidResp.status !== 200) {
    const errorBody = await paidResp.text();
    logError("step-6", `Expected 200, got ${paidResp.status}`, errorBody);

    // If 402, the settlement failed — let's see why
    if (paidResp.status === 402) {
      try {
        const errJson = JSON.parse(errorBody);
        logError("step-6", "Settlement error details:", errJson);
      } catch {}
    }
    process.exit(1);
  }

  // ── Step 7: Verify response ──
  const body = await paidResp.json();
  const paymentResponse = paidResp.headers.get("x-payment-response");

  log("step-7", "Response body (summary):", {
    hasStrategies: Array.isArray(body.strategies),
    strategyCount: body.strategies?.length,
    totalApy: body.total_estimated_apy,
    x402Proof: body.x402,
    summary: body.summary?.slice(0, 100),
  });

  if (paymentResponse) {
    log("step-7", "X-PAYMENT-RESPONSE header:", JSON.parse(paymentResponse));
  }

  const txHash = body.x402?.txHash || (paymentResponse && JSON.parse(paymentResponse).txHash);
  if (!txHash) {
    logError("step-7", "No txHash in response — settlement may have failed silently");
  } else {
    log("step-7", `Transaction hash: ${txHash}`);
    log("step-7", `Stellar Expert: https://stellar.expert/explorer/testnet/tx/${txHash}`);
  }

  // ── Step 8: Verify on-chain balances ──
  log("step-8", "Waiting 5s for ledger finality...");
  await new Promise(r => setTimeout(r, 5000));

  log("step-8", "Checking post-payment balances...");
  const vaultBalanceAfter = await getVaultBalance();
  const facilitatorBalanceAfter = await getTokenBalance(facilitatorKp.publicKey());

  const vaultDelta = vaultBalanceBefore - vaultBalanceAfter;
  const facilitatorDelta = facilitatorBalanceAfter - facilitatorBalanceBefore;

  log("step-8", "Balance changes:", {
    vault: {
      before: `${vaultBalanceBefore} (${Number(vaultBalanceBefore) / 10_000_000} USDC)`,
      after: `${vaultBalanceAfter} (${Number(vaultBalanceAfter) / 10_000_000} USDC)`,
      delta: `${vaultDelta} stroops (${Number(vaultDelta) / 10_000_000} USDC)`,
    },
    facilitator: {
      before: `${facilitatorBalanceBefore}`,
      after: `${facilitatorBalanceAfter}`,
      delta: `${facilitatorDelta} stroops`,
    },
  });

  // ── Step 9: Assertions ──
  console.log("\n" + "=".repeat(70));
  console.log("  RESULTS");
  console.log("=".repeat(70) + "\n");

  let allPassed = true;

  function assert(name: string, condition: boolean, detail: string) {
    if (condition) {
      console.log(`  PASS  ${name}: ${detail}`);
    } else {
      console.log(`  FAIL  ${name}: ${detail}`);
      allPassed = false;
    }
  }

  assert(
    "402 without payment",
    noPayResp.status === 402,
    `Status ${noPayResp.status}`,
  );

  assert(
    "200 with payment",
    paidResp.status === 200,
    `Status ${paidResp.status}`,
  );

  assert(
    "Has strategies",
    Array.isArray(body.strategies) && body.strategies.length > 0,
    `${body.strategies?.length || 0} strategies returned`,
  );

  assert(
    "Has x402 proof",
    !!body.x402?.txHash,
    body.x402?.txHash || "missing",
  );

  assert(
    "Vault balance decreased",
    vaultDelta === BigInt(PAYMENT_AMOUNT),
    `Delta: ${vaultDelta} (expected: ${PAYMENT_AMOUNT})`,
  );

  assert(
    "Facilitator received USDC",
    facilitatorDelta === BigInt(PAYMENT_AMOUNT),
    `Delta: ${facilitatorDelta} (expected: ${PAYMENT_AMOUNT})`,
  );

  assert(
    "X-PAYMENT-RESPONSE header present",
    !!paymentResponse,
    paymentResponse ? "present" : "missing",
  );

  console.log("\n" + "=".repeat(70));
  if (allPassed) {
    console.log("  ALL TESTS PASSED — x402 payment flow verified end-to-end!");
  } else {
    console.log("  SOME TESTS FAILED — see details above");
  }
  console.log("=".repeat(70) + "\n");

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  logError("fatal", "Unhandled error", err);
  process.exit(1);
});
