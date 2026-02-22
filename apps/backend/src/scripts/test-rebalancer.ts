/**
 * Test script: autonomous rebalancer + x402 flow
 * Run: tsx src/scripts/test-rebalancer.ts
 */
import { portfolioService } from "../services/portfolio.service.js";
import { blendClient } from "../defi/blend-client.js";
import { soroswapClient } from "../defi/soroswap-client.js";
import { config } from "../config.js";
import { Keypair } from "@stellar/stellar-sdk";

const THRESHOLD = parseFloat(config.REBALANCE_DRIFT_THRESHOLD_PCT);
const BACKEND_URL = `http://localhost:${config.PORT || "3001"}`;

const TEST_WALLET = "GTEST_REBALANCER_DEMO_001";
const TEST_VAULT  = "CVAULT_DEMO_REBALANCER_001";

// ── Helpers ────────────────────────────────────────────────────────────────────

function sep(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

function printPositions(positions: any[], label: string) {
  console.log(`\n${label}`);
  for (const p of positions) {
    const bar = "█".repeat(Math.round(p.allocationPct / 5));
    console.log(`  ${bar.padEnd(20)} ${p.protocol.padEnd(25)} ${p.allocationPct}%  APY ${(p.entryApy ?? p.currentApy ?? 0).toFixed(1)}%  $${p.amountUsdc.toFixed(0)}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  sep("STEP 1 — Live market rates");

  const liveApys: Record<string, number> = {
    blend: 7.2, soroswap: 12.5, ondo: 4.8,
    defindex: 9.1, aquarius: 8.5, centrifuge: 4.5, idle: 0, other: 0,
  };
  try {
    const blend = await blendClient.loadPool();
    if (blend.reserves[0]?.supplyApy) liveApys.blend = blend.reserves[0].supplyApy;
    console.log("Blend pool loaded from testnet");
  } catch { console.log("Blend: using fallback rates"); }
  try {
    const pools = await soroswapClient.getPools();
    if (pools[0]?.apy) liveApys.soroswap = pools[0].apy;
  } catch {}

  console.log("\nLive APYs:");
  for (const [proto, apy] of Object.entries(liveApys).filter(([, a]) => a > 0)) {
    console.log(`  ${proto.padEnd(12)} ${apy.toFixed(1)}%`);
  }

  // ── Seed: sub-optimal starting positions ──────────────────────────────────
  sep("STEP 2 — Seed wallet with sub-optimal positions");

  const initialPositions = [
    { protocol: "Ondo USDY",   protocolKey: "ondo",     amountUsdc: 500, allocationPct: 50, entryApy: 4.8, deployedAt: "2026-02-01T00:00:00Z" },
    { protocol: "Blend USDC",  protocolKey: "blend",    amountUsdc: 300, allocationPct: 30, entryApy: 7.2, deployedAt: "2026-02-01T00:00:00Z" },
    { protocol: "Centrifuge",  protocolKey: "centrifuge",amountUsdc: 200, allocationPct: 20, entryApy: 4.5, deployedAt: "2026-02-01T00:00:00Z" },
  ];

  await portfolioService.recordPositions({
    wallet: TEST_WALLET,
    vaultAddress: TEST_VAULT,
    positions: initialPositions,
    totalAmount: 1000,
    txHashes: ["demo_initial_tx"],
    reason: "User executed strategy",
  });

  const beforeApy = initialPositions.reduce(
    (s, p) => s + (p.entryApy * p.allocationPct / 100), 0,
  );
  printPositions(initialPositions, `Initial positions (Weighted APY: ${beforeApy.toFixed(2)}%)`);
  console.log(`\nWeighted APY = ${beforeApy.toFixed(2)}%`);
  console.log(`Threshold for rebalance = ${THRESHOLD}% improvement`);
  console.log(`Best live rate = Soroswap 12.5% — large improvement available`);

  // ── Rebalancer logic (same as autoRebalanceAll) ───────────────────────────
  sep("STEP 3 — Autonomous rebalancer checks wallet");

  const portfolio = (await portfolioService.getPortfolio(TEST_WALLET))!;
  const currentApy = portfolio.positions.reduce(
    (s, p) => s + ((liveApys[p.protocolKey] ?? p.entryApy) * p.allocationPct / 100), 0,
  );

  // Rank by live APY, shift 20% from worst to best
  const ranked = [...portfolio.positions]
    .map(p => ({ ...p, liveApy: liveApys[p.protocolKey] ?? p.entryApy }))
    .sort((a, b) => b.liveApy - a.liveApy);

  const shift = Math.min(20, ranked[ranked.length - 1].allocationPct);
  const newPositions = ranked.map((p, i) => {
    const newPct = i === 0 ? p.allocationPct + shift
      : i === ranked.length - 1 ? p.allocationPct - shift
      : p.allocationPct;
    return { ...p, amountUsdc: (newPct / 100) * 1000, allocationPct: newPct, entryApy: liveApys[p.protocolKey] ?? p.entryApy, deployedAt: new Date().toISOString() };
  });
  const targetApy = newPositions.reduce((s, p) => s + (p.entryApy * p.allocationPct / 100), 0);
  const improvement = targetApy - currentApy;

  console.log(`\n  Current weighted APY:   ${currentApy.toFixed(2)}%`);
  console.log(`  Target weighted APY:    ${targetApy.toFixed(2)}%`);
  console.log(`  APY improvement:        +${improvement.toFixed(2)}%`);
  console.log(`  Threshold:              ${THRESHOLD}%`);
  console.log(`  Decision:               ${improvement >= THRESHOLD ? "✅ REBALANCE" : "❌ HOLD"}`);

  if (improvement >= THRESHOLD) {
    await portfolioService.recordPositions({
      wallet: TEST_WALLET,
      vaultAddress: TEST_VAULT,
      positions: newPositions,
      totalAmount: 1000,
      txHashes: [],
      reason: `Algorithmic rebalance (+${improvement.toFixed(2)}% APY)`,
    });
    printPositions(newPositions, `\nNew positions after rebalance:`);
  }

  // ── x402 mode check ──────────────────────────────────────────────────────
  sep("STEP 4 — x402 autonomous payment check");

  if (config.AGENT_SIGNER_SECRET_KEY) {
    const agentKey = Keypair.fromSecret(config.AGENT_SIGNER_SECRET_KEY);
    console.log(`\nAgent signer: ${agentKey.publicKey().slice(0, 12)}…`);
    console.log(`Vault: ${TEST_VAULT}`);
    console.log(`\nTesting x402 payment to yield query endpoint...`);

    try {
      // Quick 402 check — no payment header
      const resp402 = await fetch(`${BACKEND_URL}/api/yield/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "best yield strategy for 1000 USDC", risk_tolerance: "moderate" }),
      });
      if (resp402.status === 402) {
        const challenge = await resp402.json();
        console.log(`✅ 402 gate active: ${challenge.accepts[0].scheme} ${challenge.accepts[0].amount} stroops`);
        console.log(`   Facilitator: ${challenge.accepts[0].payTo?.slice(0, 12)}…`);
        console.log(`\n   In autonomous mode, the agent would now:`);
        console.log(`   1. Build X-PAYMENT header (vault.agent_pay signature)`);
        console.log(`   2. Retry POST with X-PAYMENT header`);
        console.log(`   3. x402 middleware settles 0.01 USDC from vault on-chain`);
        console.log(`   4. AI strategy returned → rebalance if improvement ≥ ${THRESHOLD}%`);
      } else {
        console.log(`Query returned: ${resp402.status} (not 402 — payment may be skipped for this intent)`);
      }
    } catch (e) {
      console.log(`Backend not reachable at ${BACKEND_URL} — start it first`);
    }
  } else {
    console.log("\n  AGENT_SIGNER_SECRET_KEY not set — running in algorithmic mode");
    console.log("  To enable x402 autonomous payments, set AGENT_SIGNER_SECRET_KEY in .env");
    console.log("  Agent would then autonomously pay 0.01 USDC per rebalance check");
  }

  // ── Final portfolio state ─────────────────────────────────────────────────
  sep("STEP 5 — Final portfolio state");

  const final = (await portfolioService.getPortfolio(TEST_WALLET))!;
  const finalApy = final.positions.reduce((s, p) => s + (p.entryApy * p.allocationPct / 100), 0);

  console.log(`\nRebalance history: ${final.rebalanceHistory.length} event(s)`);
  for (const evt of final.rebalanceHistory) {
    const sign = evt.netApyChange >= 0 ? "+" : "";
    console.log(`  [${evt.type}] ${sign}${evt.netApyChange.toFixed(2)}% — "${evt.reason}"`);
  }
  console.log(`\nFinal weighted APY: ${finalApy.toFixed(2)}%`);
  console.log(`APY gain from initial: +${(finalApy - beforeApy).toFixed(2)}%`);
  console.log(`Projected yearly return on $1000: $${(1000 * finalApy / 100).toFixed(2)}`);

  console.log(`\n${"─".repeat(60)}`);
  console.log("  ✅ Rebalancer test complete");
  console.log("─".repeat(60) + "\n");
}

main().catch(console.error);
