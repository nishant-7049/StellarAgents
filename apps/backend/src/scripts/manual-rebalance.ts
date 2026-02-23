/**
 * Manual Rebalance Script
 *
 * Diagnoses why the autonomous rebalancer isn't running and bootstraps
 * the first positions for the demo agent's vault.
 *
 * Run: npx tsx src/scripts/manual-rebalance.ts
 *
 * What it does:
 *   1. Show current on-chain vault balance
 *   2. Show existing MongoDB portfolio (if any)
 *   3. Show agent's remaining daily limit on the vault
 *   4. Fetch live Blend APY
 *   5. Seed initial positions in MongoDB (70% Blend, 30% Soroswap)
 *   6. Attempt a real vault.agent_pay() → Blend pool to verify on-chain auth
 *   7. Record confirmed tx hash in MongoDB
 *   8. Summary: rebalancer will now pick it up on next cron tick
 */

import { connectDB } from "../db/mongoose.js";
import { portfolioService } from "../services/portfolio.service.js";
import { vaultService } from "../services/vault.service.js";
import { blendClient } from "../defi/blend-client.js";
import { config } from "../config.js";
import { Keypair } from "@stellar/stellar-sdk";
import { BlendClient } from "@agenticocean/defi-agent";

// ── Demo agent constants ─────────────────────────────────────────────────────
const DEMO_WALLET = "GDLCSUDUCBLY5Z727TAZ4ZLUTKYM2CC74FM77M3GJ7IA2BYEQRD6CRZ6";
const DEMO_VAULT  = "CBUAGWLFKHMVXOOLI32D4HWYCDFKA5LYWHB5XJDC52XMI2YI5PPJZPKZ";
const DEMO_AGENT_SIGNER_PUB = "GCULCDARDBS5OV5XLP2APEVZVJMQ6SP6L6EA3AEQ4NOBI2TYJBU64YNI";
const BLEND_POOL  = "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF";
const BACKEND_URL = `http://localhost:${config.PORT || "3001"}`;

// Initial target allocation: 70% Blend (on-chain), 30% Soroswap (tracked only)
const BLEND_PCT     = 70;
const SOROSWAP_PCT  = 30;

// Test supply amount: 1 USDC (to verify agent auth, not a real rebalance)
const TEST_SUPPLY_USDC   = 1.0;
const TEST_SUPPLY_STROOPS = BigInt(Math.round(TEST_SUPPLY_USDC * 1e7));

// ── Helpers ──────────────────────────────────────────────────────────────────

function sep(title: string) {
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(64));
}

function ok(msg: string)   { console.log(`  ✅  ${msg}`); }
function warn(msg: string) { console.log(`  ⚠️   ${msg}`); }
function info(msg: string) { console.log(`  ℹ️   ${msg}`); }
function fail(msg: string) { console.log(`  ❌  ${msg}`); }

function fmt(n: number, decimals = 2) { return n.toFixed(decimals); }
function stroopsToUsdc(s: string | number) {
  return Number(s) / 1e7;
}

// ── Step 1: On-chain vault balance ──────────────────────────────────────────

async function checkVaultBalance() {
  sep("STEP 1 — On-chain vault balance");
  try {
    const raw = await vaultService.getBalance(DEMO_VAULT);
    const usdc = stroopsToUsdc(raw);
    ok(`Vault ${DEMO_VAULT.slice(0, 10)}… balance: ${fmt(usdc)} USDC`);
    return usdc;
  } catch (err: any) {
    warn(`Could not read vault balance: ${err.message}`);
    return 0;
  }
}

// ── Step 2: MongoDB portfolio state ─────────────────────────────────────────

async function checkMongoDB() {
  sep("STEP 2 — MongoDB portfolio state");
  const portfolio = await portfolioService.getPortfolio(DEMO_WALLET);

  if (!portfolio) {
    warn("No portfolio entry in MongoDB for the demo wallet");
    info("This is why the rebalancer does nothing — it only processes tracked wallets");
    return null;
  }

  ok(`Portfolio found: ${portfolio.positions.length} position(s)`);
  console.log(`\n  totalInvested: $${fmt(portfolio.totalInvested)}`);
  for (const p of portfolio.positions) {
    console.log(
      `  ${p.protocol.padEnd(22)} ${String(p.allocationPct).padStart(4)}%  ` +
      `$${fmt(p.amountUsdc)} USDC  APY ${fmt(p.entryApy)}%`
    );
  }
  if (portfolio.lastDecision) {
    console.log(`\n  Last decision: [${portfolio.lastDecision.action}] ${portfolio.lastDecision.reason}`);
  }
  return portfolio;
}

// ── Step 3: Agent daily limit ────────────────────────────────────────────────

async function checkAgentLimit() {
  sep("STEP 3 — Agent daily spend limit on vault");
  try {
    const policy = await vaultService.getAgentPolicy(DEMO_VAULT, DEMO_AGENT_SIGNER_PUB);
    if (!policy) {
      warn("Agent not authorized on vault — add_agent() must be called first");
      return false;
    }
    const remaining = await vaultService.getRemainingLimit(DEMO_VAULT, DEMO_AGENT_SIGNER_PUB);
    const remainingUsdc = stroopsToUsdc(remaining);
    const dailyLimitUsdc = stroopsToUsdc(policy.daily_limit ?? policy.dailyLimit ?? 0);

    ok(`Agent authorized: daily limit = ${fmt(dailyLimitUsdc)} USDC`);
    ok(`Remaining today:  ${fmt(remainingUsdc)} USDC`);
    return remainingUsdc > 0;
  } catch (err: any) {
    warn(`Agent policy check failed: ${err.message}`);
    info("The agent may not be authorized on this vault yet");
    return false;
  }
}

// Fallback APYs — used when Blend testnet pool returns 0 or is unreachable
const FALLBACK_APYS = { blend: 7.2, soroswap: 12.5 };

// ── Step 4: Live Blend APY ───────────────────────────────────────────────────

async function checkBlendApy() {
  sep("STEP 4 — Live Blend protocol rates");
  try {
    const pool = await blendClient.loadPool(BLEND_POOL);
    const usdcReserve = pool.reserves.find(r =>
      r.symbol.toUpperCase().includes("USDC") || r.assetId === config.USDC_SAC_ADDRESS
    );
    // Use live APY only if > 0 — Blend testnet pools often return 0 when utilization is low
    const liveApy = usdcReserve?.supplyApy || pool.reserves[0]?.supplyApy || 0;
    const apy = liveApy > 0 ? liveApy : FALLBACK_APYS.blend;
    ok(`Blend pool: ${pool.poolName}`);
    if (liveApy > 0) {
      ok(`USDC supply APY: ${fmt(apy)}% (live)`);
    } else {
      warn(`Blend pool returned 0% APY (low utilization or testnet state) — using fallback ${fmt(apy)}%`);
    }
    return apy;
  } catch (err: any) {
    warn(`Blend APY fetch failed: ${err.message} — using fallback ${FALLBACK_APYS.blend}%`);
    return FALLBACK_APYS.blend;
  }
}

// ── Step 5: Seed MongoDB positions ───────────────────────────────────────────

async function seedPositions(vaultUsdc: number, blendApy: number) {
  sep("STEP 5 — Seed initial portfolio positions in MongoDB");

  const total = vaultUsdc > 0 ? vaultUsdc : 100;
  const blendAmount   = (BLEND_PCT    / 100) * total;
  const soroAmount    = (SOROSWAP_PCT / 100) * total;

  const positions = [
    {
      protocol:      "Blend USDC",
      protocolKey:   "blend",
      amountUsdc:    blendAmount,
      allocationPct: BLEND_PCT,
      entryApy:      blendApy,
      deployedAt:    new Date().toISOString(),
    },
    {
      protocol:      "Soroswap USDC/XLM",
      protocolKey:   "soroswap",
      amountUsdc:    soroAmount,
      allocationPct: SOROSWAP_PCT,
      entryApy:      12.5,
      deployedAt:    new Date().toISOString(),
    },
  ];

  const weightedApy = positions.reduce((s, p) => s + p.entryApy * p.allocationPct / 100, 0);

  await portfolioService.recordPositions({
    wallet:       DEMO_WALLET,
    vaultAddress: DEMO_VAULT,
    positions,
    totalAmount:  total,
    txHashes:     [],
    reason:       "manual_bootstrap",
  });

  ok(`Seeded ${positions.length} positions for ${DEMO_WALLET.slice(0, 10)}…`);
  console.log(`\n  Total tracked:  $${fmt(total)} USDC`);
  for (const p of positions) {
    console.log(`  ${p.protocol.padEnd(22)} ${p.allocationPct}%  $${fmt(p.amountUsdc)}  APY ${fmt(p.entryApy)}%`);
  }
  console.log(`\n  Weighted APY:   ${fmt(weightedApy)}%`);

  return positions;
}

// ── Step 6: On-chain test — vault.agent_pay() → Blend pool ──────────────────

async function testOnChainExecution() {
  sep("STEP 6 — On-chain test: vault.agent_pay() → Blend pool");

  const agentSecret = config.AGENT_SIGNER_SECRET_KEY;
  if (!agentSecret) {
    warn("AGENT_SIGNER_SECRET_KEY not set in .env — skipping on-chain test");
    info("To enable, set AGENT_SIGNER_SECRET_KEY=<secret> in your .env file");
    return null;
  }

  const agentPub = Keypair.fromSecret(agentSecret).publicKey();
  if (agentPub !== DEMO_AGENT_SIGNER_PUB) {
    warn(`Agent signer mismatch:`);
    console.log(`  Expected: ${DEMO_AGENT_SIGNER_PUB}`);
    console.log(`  Got:      ${agentPub}`);
    warn("Make sure AGENT_SIGNER_SECRET_KEY matches the registered agent signer");
    return null;
  }

  ok(`Agent signer confirmed: ${agentPub.slice(0, 12)}…`);
  info(`Attempting vault.agent_pay() for ${TEST_SUPPLY_USDC} USDC → Blend pool`);
  info(`This calls: vault(${DEMO_VAULT.slice(0, 10)}…).agent_pay(agent, blendPool, ${TEST_SUPPLY_STROOPS} stroops)`);

  try {
    // Use the SDK BlendClient directly (same instance used by rebalancer)
    const sdkBlend = new BlendClient({
      stellarRpcUrl:      config.STELLAR_RPC_URL,
      networkPassphrase:  config.STELLAR_NETWORK_PASSPHRASE,
      usdcAddress:        config.USDC_SAC_ADDRESS,
      blendPoolId:        BLEND_POOL,
    });

    const result = await sdkBlend.executeViaVault({
      poolId:           BLEND_POOL,
      agentSignerSecret: agentSecret,
      vaultContract:    DEMO_VAULT,
      asset:            config.USDC_SAC_ADDRESS,
      amount:           TEST_SUPPLY_STROOPS,
      facilitatorUrl:   BACKEND_URL,
      memo:             "manual_rebalance_test",
    });

    ok(`On-chain tx confirmed!`);
    console.log(`  txHash: ${result.txHash}`);
    console.log(`  Explorer: https://stellar.expert/explorer/testnet/tx/${result.txHash}`);
    return result.txHash;
  } catch (err: any) {
    fail(`On-chain execution failed: ${err.message}`);
    if (err.message?.includes("AgentNotFound") || err.message?.includes("agent_not_found")) {
      info("The agent is not authorized on this vault. Call vault.add_agent() first.");
    } else if (err.message?.includes("ExceedsDailyLimit")) {
      info("The agent's daily spending limit is exhausted. It resets after 24 hours.");
    } else if (err.message?.includes("InsufficientBalance")) {
      info("Vault has insufficient USDC balance.");
    }
    console.log("\n  Error details:", err.message);
    return null;
  }
}

// ── Step 7: Record on-chain result ───────────────────────────────────────────

async function recordOnChainResult(txHash: string | null, blendApy: number, vaultUsdc: number) {
  if (!txHash) return;
  sep("STEP 7 — Recording on-chain tx in MongoDB");

  const total = vaultUsdc > 0 ? vaultUsdc : 100;
  const positions = [
    {
      protocol:      "Blend USDC",
      protocolKey:   "blend",
      amountUsdc:    (BLEND_PCT / 100) * total,
      allocationPct: BLEND_PCT,
      entryApy:      blendApy,
      deployedAt:    new Date().toISOString(),
      txHash,
    },
    {
      protocol:      "Soroswap USDC/XLM",
      protocolKey:   "soroswap",
      amountUsdc:    (SOROSWAP_PCT / 100) * total,
      allocationPct: SOROSWAP_PCT,
      entryApy:      12.5,
      deployedAt:    new Date().toISOString(),
    },
  ];

  await portfolioService.recordPositions({
    wallet:       DEMO_WALLET,
    vaultAddress: DEMO_VAULT,
    positions,
    totalAmount:  total,
    txHashes:     [txHash],
    reason:       "manual_rebalance_confirmed",
  });

  ok(`Positions recorded with tx hash: ${txHash.slice(0, 16)}…`);
}

// ── Summary ──────────────────────────────────────────────────────────────────

function printSummary(txHash: string | null, vaultUsdc: number, blendApy: number) {
  sep("SUMMARY");

  ok(`Demo wallet tracked in MongoDB: ${DEMO_WALLET.slice(0, 10)}…`);
  ok(`Vault: ${DEMO_VAULT.slice(0, 10)}… ($${fmt(vaultUsdc)} USDC on-chain)`);
  ok(`Blend APY: ${fmt(blendApy)}%  |  Soroswap LP APY: ~12.5%`);
  ok(`Allocation: ${BLEND_PCT}% Blend + ${SOROSWAP_PCT}% Soroswap`);

  if (txHash) {
    ok(`On-chain test tx: ${txHash.slice(0, 20)}…`);
  } else {
    info("No on-chain tx — check AGENT_SIGNER_SECRET_KEY or agent authorization");
  }

  console.log(`
  NEXT STEPS:
  ──────────────────────────────────────────────────────
  1. The autonomous rebalancer now sees this wallet and will
     process it every ${config.REBALANCE_INTERVAL_MINUTES || 5} minutes.

  2. Gate: 6-hour minimum hold before first rebalance.
     After that, rebalancer triggers if APY improves ≥ 0.25%.

  3. Monitor rebalancer logs for:
     "Rebalancer: checking 1 wallet(s) [mode: x402+AI]"

  4. View live portfolio at: http://localhost:3000/chat
     (Live Agent Demo page shows real positions + activity)

  5. Check MongoDB state anytime:
     GET http://localhost:3001/api/portfolio/${DEMO_WALLET}
  `);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "═".repeat(64));
  console.log("  Manual Rebalance — Demo Agent Bootstrap");
  console.log(`  Agent #20 "defi-agent" — Testnet`);
  console.log("═".repeat(64));

  await connectDB();

  const vaultUsdc  = await checkVaultBalance();
  const portfolio  = await checkMongoDB();
  const agentOk    = await checkAgentLimit();
  const blendApy   = await checkBlendApy();

  if (!portfolio || portfolio.positions.length === 0) {
    await seedPositions(vaultUsdc, blendApy);
  } else {
    info("Positions already exist — skipping seed");
  }

  const txHash = agentOk ? await testOnChainExecution() : null;

  if (!agentOk) {
    sep("STEP 6 — Skipped (agent limit check failed)");
    warn("Fix agent authorization before attempting on-chain execution");
  }

  await recordOnChainResult(txHash, blendApy, vaultUsdc);
  printSummary(txHash, vaultUsdc, blendApy);

  process.exit(0);
}

main().catch(err => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
