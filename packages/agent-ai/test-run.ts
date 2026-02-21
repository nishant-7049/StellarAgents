/**
 * Quick smoke test for @agentsea/agent-ai
 * Run: npx tsx test-run.ts
 */
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
// Load backend .env (contains ANTHROPIC_API_KEY, etc.) then root .env as fallback
dotenvConfig({ path: resolve(__dirname, "../../apps/backend/.env") });
dotenvConfig({ path: resolve(__dirname, "../../.env") });

import { YieldOptimizer, BlendClient, SoroswapClient, Rebalancer } from "./src/index.js";
import type { AgentAIConfig } from "./src/index.js";

const config: AgentAIConfig = {
  stellarRpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  // Testnet USDC SAC (from blend-utils testnet.contracts.json)
  usdcAddress: "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
  // Blend TestnetV2 pool (from blend-utils testnet.contracts.json)
  blendPoolId: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
};

const optimizer = new YieldOptimizer(config);

async function run() {
  console.log("\n── Test 1: Low risk strategy ──");
  const low = await optimizer.optimize("Best safe yield for my USDC", "low", 1000);
  console.log(`Total APY: ${low.total_estimated_apy}%`);
  console.log("Allocations:");
  low.strategies.forEach(s => console.log(`  ${s.protocol}: ${s.allocation_pct}% @ ${s.estimated_apy}% APY [${s.risk_level}]`));

  console.log("\n── Test 2: High risk strategy ──");
  const high = await optimizer.optimize("Maximize yield, I can handle risk", "high", 5000);
  console.log(`Total APY: ${high.total_estimated_apy}%`);
  console.log("Summary:", high.summary);

  console.log("\n── Test 3: Blend pool data ──");
  const blend = optimizer.getBlendClient();
  const pool = await blend.loadPool();
  console.log(`Pool: ${pool.poolName}`);
  pool.reserves.forEach(r => console.log(`  ${r.symbol}: ${r.supplyApy}% supply APY, ${(r.utilization * 100).toFixed(0)}% utilized`));

  console.log("\n── Test 4: Soroswap quote ──");
  const soroswap = optimizer.getSoroswapClient();
  const quote = await soroswap.getQuote({
    assetIn: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    assetOut: "native",
    amount: 10_0000000n, // 10 USDC
  });
  console.log(`Quote: ${Number(quote?.amountIn) / 1e7} USDC → ${Number(quote?.amountOut) / 1e7} XLM`);

  console.log("\n── Test 5: Portfolio snapshot (loadUserPosition + loadLPPosition) ──");
  const DEMO_VAULT = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPGAwholesaler7L3VGSUAFS6JQ"; // fresh wallet = 0 positions
  const blendPos = await blend.loadUserPosition(DEMO_VAULT);
  console.log(`Blend position: supply=${blendPos.estimatedSupplyValue} borrow=${blendPos.estimatedBorrowValue} netApr=${blendPos.netApr}`);

  const soroPos = await soroswap.loadLPPosition(DEMO_VAULT);
  console.log(`Soroswap LP position: valueUSDC=${soroPos.valueUSDC}`);

  const blendClient2 = new BlendClient(config);
  const soroswapClient2 = new SoroswapClient(config);
  const rebalancer = new Rebalancer(blendClient2, soroswapClient2, { driftThresholdPct: 5 });
  const snapshot = await rebalancer.readCurrentPortfolio(DEMO_VAULT);
  console.log(`Portfolio snapshot: totalUSDC=${snapshot.totalUSDC}`);
  snapshot.positions.forEach(p => console.log(`  ${p.protocol}: ${p.usdcValue} USDC (${p.pct.toFixed(1)}%)`));

  console.log("\n✅ All tests passed");
}

run().catch(console.error);
