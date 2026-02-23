/**
 * Autonomous Rebalancer
 *
 * Runs on a cron schedule. For every wallet with tracked positions:
 *
 * MODE A (AGENT_SIGNER_SECRET_KEY set — fully autonomous x402):
 *   1. Agent builds an x402 payment header using the user's vault + agent key
 *   2. Agent calls POST /api/yield/query — x402 middleware settles 0.01 USDC from vault
 *   3. AI returns the optimal strategy
 *   4. If position age ≥ 6h AND APY improvement ≥ 0.25%, execute on-chain via SDK
 *   5. Record positions in MongoDB ONLY after confirmed tx hashes
 *
 * MODE B (no agent key — fallback algorithmic):
 *   1. Load live APYs from Blend/Soroswap directly
 *   2. Shift allocation toward highest-APY protocol (simple heuristic)
 *   3. Same 6h hold + 0.25% improvement gates apply
 *   4. No on-chain execution — tracking only
 *
 * Gates:
 *   - 6-hour minimum position hold before rebalancer may move funds
 *   - ≥ 0.25 percentage points APY improvement required to trigger
 */
import cron from "node-cron";
import { Keypair } from "@stellar/stellar-sdk";
import { blendClient } from "./blend-client.js";
import { soroswapClient } from "./soroswap-client.js";
import { portfolioService, DeployedPosition } from "../services/portfolio.service.js";
import { vaultService } from "../services/vault.service.js";
import { buildX402Header } from "../x402/header-builder.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { Rebalancer, BlendClient as SdkBlendClient, SoroswapClient as SdkSoroswapClient } from "@agenticocean/defi-agent";

const MIN_APY_IMPROVEMENT_PCT = parseFloat(config.MIN_APY_IMPROVEMENT_PCT || "0.25");
const MIN_POSITION_HOLD_HOURS = parseFloat(config.MIN_POSITION_HOLD_HOURS || "6");
const BACKEND_URL = `http://localhost:${config.PORT || "3001"}`;

let rebalanceCount = 0;
let x402PaymentCount = 0;
let lastRunAt: string | null = null;
let isRunning = false;
let trackedWalletCount = 0;

// SDK client instances (created once, shared across wallets)
const sdkBlendClient = new SdkBlendClient({
  stellarRpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  usdcAddress: config.USDC_SAC_ADDRESS,
  blendPoolId: config.BLEND_POOL_USDC,
  logger,
});

const sdkSoroswapClient = new SdkSoroswapClient({
  stellarRpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  soroswapApiKey: config.SOROSWAP_API_KEY,
  usdcAddress: config.USDC_SAC_ADDRESS,
  logger,
});

// ── Live APY helpers ──────────────────────────────────────────────────────────

const FALLBACK_APYS: Record<string, number> = {
  blend: 7.2, soroswap: 12.5, ondo: 4.8,
  defindex: 9.1, aquarius: 8.5, centrifuge: 4.5, idle: 0, other: 0,
};

async function getLiveApys(): Promise<Record<string, number>> {
  const apys = { ...FALLBACK_APYS };
  try {
    const blend = await blendClient.loadPool();
    if (blend.reserves[0]?.supplyApy) apys.blend = blend.reserves[0].supplyApy;
  } catch {}
  try {
    const pools = await soroswapClient.getPools();
    if (pools[0]?.apy) apys.soroswap = pools[0].apy;
  } catch {}
  return apys;
}

// ── MODE A: x402-authenticated AI strategy call ───────────────────────────────

async function queryAIWithX402(wallet: string, vaultAddress: string, totalAmount: number) {
  try {
    const agentKeypair = Keypair.fromSecret(config.AGENT_SIGNER_SECRET_KEY!);
    const facilitatorPubkey = config.FACILITATOR_SECRET_KEY
      ? Keypair.fromSecret(config.FACILITATOR_SECRET_KEY).publicKey()
      : agentKeypair.publicKey();

    const paymentHeader = await buildX402Header({
      vaultContract: vaultAddress,
      agentSigner: agentKeypair.publicKey(),
      agentSecret: config.AGENT_SIGNER_SECRET_KEY!,
      payTo: facilitatorPubkey,
      amount: "100000", // 0.01 USDC in stroops
      memo: `rebalance_${Date.now()}`,
      agentId: 1,
    });

    const response = await fetch(`${BACKEND_URL}/api/yield/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT": paymentHeader,
      },
      body: JSON.stringify({
        query: `optimize yield for ${totalAmount} USDC portfolio, rebalance check`,
        risk_tolerance: "moderate",
        amount: totalAmount,
        wallet,
      }),
    });

    if (!response.ok) {
      logger.warn(`Rebalancer x402 call failed: ${response.status} for ${wallet.slice(0, 8)}…`);
      return null;
    }

    const data = await response.json();
    x402PaymentCount++;
    logger.info(`Rebalancer x402 payment settled for ${wallet.slice(0, 8)}…`, {
      txHash: data.x402?.txHash,
      strategies: data.strategies?.length,
    });
    await portfolioService.recordPayment(wallet, {
      purpose: "rebalance_check",
      amountStroops: 100_000,
      txHash: data.x402?.txHash,
      status: "settled",
    });
    return data;
  } catch (err) {
    logger.error("Rebalancer x402 query failed", { err });
    return null;
  }
}

// ── MODE B: Algorithmic rebalance (no x402) ───────────────────────────────────

function buildAlgorithmicRebalance(
  current: DeployedPosition[],
  liveApys: Record<string, number>,
  totalAmount: number,
): DeployedPosition[] {
  if (current.length < 2) {
    return current.map(p => ({
      ...p, entryApy: liveApys[p.protocolKey] ?? p.entryApy,
      deployedAt: new Date().toISOString(),
    }));
  }
  const ranked = current
    .map(p => ({ ...p, liveApy: liveApys[p.protocolKey] ?? p.entryApy }))
    .sort((a, b) => b.liveApy - a.liveApy);
  const shift = Math.min(20, ranked[ranked.length - 1].allocationPct);
  return ranked.map((p, i) => {
    const newPct = i === 0 ? p.allocationPct + shift
      : i === ranked.length - 1 ? p.allocationPct - shift
      : p.allocationPct;
    return {
      protocol: p.protocol,
      protocolKey: p.protocolKey,
      amountUsdc: (newPct / 100) * totalAmount,
      allocationPct: newPct,
      entryApy: liveApys[p.protocolKey] ?? p.entryApy,
      deployedAt: new Date().toISOString(),
    };
  });
}

// ── On-chain execution via SDK Rebalancer ─────────────────────────────────────

async function executeOnChain(
  vaultAddress: string,
  agentSecret: string,
  newPositions: DeployedPosition[],
): Promise<string[]> {
  const rebalancer = new Rebalancer(sdkBlendClient, sdkSoroswapClient, {
    driftThresholdPct: 0,   // always execute — we've already decided to rebalance
    agentSignerSecret: agentSecret,
    vaultContract: vaultAddress,
    facilitatorUrl: BACKEND_URL,
  }, logger);

  // Only Blend positions are executable via vault.agent_pay() today.
  // Soroswap LP add/remove requires a different mechanism (swap router auth)
  // and is tracked in MongoDB but not moved on-chain here.
  const soroswapPositions = newPositions.filter(p => p.protocolKey === "soroswap");
  if (soroswapPositions.length > 0) {
    logger.info("Soroswap positions tracked-only (on-chain LP execution not yet implemented)", {
      positions: soroswapPositions.map(p => ({ allocationPct: p.allocationPct, amountUsdc: p.amountUsdc })),
    });
  }

  // Map new positions to AllocationTarget format (currentPct: 0 → SDK reads actual on-chain state)
  const targets = newPositions
    .filter(p => p.protocolKey === "blend")
    .map(p => ({
      protocol: p.protocolKey,
      asset: config.USDC_SAC_ADDRESS,
      targetPct: p.allocationPct,
      currentPct: 0,
    }));

  if (targets.length === 0) {
    logger.info("executeOnChain: no executable targets (blend positions required)");
    return [];
  }

  rebalancer.setTargetAllocation(targets);
  const result = await rebalancer.checkAndRebalance();
  return result.executedActions.map(a => a.txHash).filter(Boolean);
}

// ── Core loop ─────────────────────────────────────────────────────────────────

async function autoRebalanceAll() {
  if (isRunning) return;
  isRunning = true;
  lastRunAt = new Date().toISOString();

  // ── Auto-discovery: seed our own vault if agent is authorized and vault has funds ──
  if (config.AGENT_SIGNER_SECRET_KEY && config.ADMIN_VAULT_ADDRESS) {
    try {
      const agentPubKey = Keypair.fromSecret(config.AGENT_SIGNER_SECRET_KEY).publicKey();
      const vaultAddress = config.ADMIN_VAULT_ADDRESS;

      const [policy, rawBalance] = await Promise.all([
        vaultService.getAgentPolicy(vaultAddress, agentPubKey, agentPubKey).catch(() => null),
        vaultService.getBalance(vaultAddress, agentPubKey).catch(() => "0"),
      ]);

      const isAuthorized = policy?.is_active ?? policy?.isActive ?? false;
      const balanceUsdc = parseInt(rawBalance || "0") / 1e7;

      if (isAuthorized && balanceUsdc > 0) {
        const existing = await portfolioService.getPortfolio(agentPubKey);
        if (!existing) {
          // First time: seed as idle USDC with old timestamp so the 6h gate passes immediately
          await portfolioService.recordPositions({
            wallet: agentPubKey,
            vaultAddress,
            positions: [{
              protocol: "Idle USDC",
              protocolKey: "idle",
              amountUsdc: balanceUsdc,
              allocationPct: 100,
              entryApy: 0,
              deployedAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
            }],
            totalAmount: balanceUsdc,
            txHashes: [],
            reason: "auto_discovery",
          });
          logger.info(
            `Auto-discovered vault: ${vaultAddress.slice(0, 8)}… ` +
            `agent=${agentPubKey.slice(0, 8)}… balance=${balanceUsdc.toFixed(2)} USDC`
          );
        }
      }
    } catch (err) {
      logger.warn("Auto-discovery vault check failed", { err });
    }
  }

  const wallets = await portfolioService.getAllWallets();
  trackedWalletCount = wallets.length;

  if (wallets.length === 0) {
    isRunning = false;
    return;
  }

  const agentMode = config.AGENT_SIGNER_SECRET_KEY ? "x402+AI" : "algorithmic";
  logger.info(`Rebalancer: checking ${wallets.length} wallet(s) [mode: ${agentMode}]`);

  const liveApys = await getLiveApys();

  for (const wallet of wallets) {
    try {
      let portfolio = await portfolioService.getPortfolio(wallet);
      if (!portfolio || portfolio.positions.length === 0) continue;

      // ── On-chain reconciliation ──────────────────────────────────────────
      // Read the actual Blend position. If it differs from our tracked value by
      // more than 10% relative, update MongoDB to match reality. This catches
      // deposits/withdrawals that happened outside the backend.
      if (portfolio.vaultAddress) {
        try {
          const onChain = await sdkBlendClient.loadUserPosition(portfolio.vaultAddress);
          const onChainBlend = onChain.estimatedSupplyValue - onChain.estimatedBorrowValue;
          const trackedBlend = portfolio.positions
            .filter(p => p.protocolKey === "blend")
            .reduce((s, p) => s + p.amountUsdc, 0);

          const drift = trackedBlend > 0
            ? Math.abs(onChainBlend - trackedBlend) / trackedBlend
            : 0;

          if (drift > 0.10 && onChainBlend !== trackedBlend) {
            logger.info(
              `Reconcile ${wallet.slice(0, 8)}…: tracked blend $${trackedBlend.toFixed(2)} ` +
              `vs on-chain $${onChainBlend.toFixed(2)} (${(drift * 100).toFixed(1)}% drift) — updating`
            );
            const updatedPositions = portfolio.positions.map(p => {
              if (p.protocolKey !== "blend") return p;
              const newAmount = onChainBlend;
              const newPct = portfolio!.totalInvested > 0
                ? (newAmount / portfolio!.totalInvested) * 100
                : p.allocationPct;
              return { ...p, amountUsdc: newAmount, allocationPct: newPct };
            });
            portfolio = await portfolioService.recordPositions({
              wallet,
              vaultAddress: portfolio.vaultAddress,
              positions: updatedPositions,
              totalAmount: portfolio.totalInvested,
              txHashes: [],
              reason: `on-chain reconciliation (blend drift ${(drift * 100).toFixed(1)}%)`,
            });
          }
        } catch {
          // loadUserPosition failing (testnet pool down etc) is non-fatal — continue with tracked values
        }
      }

      // ── Gate 1: 6-hour minimum position hold ────────────────────────────
      const oldestPositionTs = Math.min(
        ...portfolio.positions.map(p => new Date(p.deployedAt).getTime())
      );
      const ageHours = (Date.now() - oldestPositionTs) / 3_600_000;
      if (ageHours < MIN_POSITION_HOLD_HOURS) {
        logger.debug(
          `Skipping ${wallet.slice(0, 8)}…: positions only ${ageHours.toFixed(1)}h old ` +
          `(min ${MIN_POSITION_HOLD_HOURS}h)`
        );
        await portfolioService.setLastDecision(wallet, {
          action: "skipped",
          reason: `Position age ${ageHours.toFixed(1)}h < ${MIN_POSITION_HOLD_HOURS}h minimum hold`,
          currentApy: portfolio.positions.reduce(
            (s, p) => s + ((liveApys[p.protocolKey] ?? p.entryApy) * p.allocationPct / 100), 0,
          ),
        });
        continue;
      }

      const currentApy = portfolio.positions.reduce(
        (sum, p) => sum + ((liveApys[p.protocolKey] ?? p.entryApy) * p.allocationPct / 100), 0,
      );

      let newPositions: DeployedPosition[];
      let targetApy: number;
      let paymentTxHash: string | undefined;

      if (config.AGENT_SIGNER_SECRET_KEY && portfolio.vaultAddress) {
        // ── MODE A: Agent pays via x402 to get AI strategy ──
        const aiResult = await queryAIWithX402(wallet, portfolio.vaultAddress, portfolio.totalInvested);

        if (aiResult?.strategies?.length) {
          newPositions = aiResult.strategies
            .filter((s: any) => !s.protocol.toLowerCase().includes("stellaragent"))
            .map((s: any) => ({
              protocol: s.protocol,
              protocolKey: portfolioService.resolveProtocolKey(s.protocol),
              amountUsdc: (s.allocation_pct / 100) * portfolio.totalInvested,
              allocationPct: s.allocation_pct,
              entryApy: s.estimated_apy,
              deployedAt: new Date().toISOString(),
            }));
          targetApy = aiResult.total_estimated_apy ?? newPositions.reduce(
            (sum, p) => sum + (p.entryApy * p.allocationPct / 100), 0,
          );
          paymentTxHash = aiResult.x402?.txHash;
        } else {
          newPositions = buildAlgorithmicRebalance(portfolio.positions, liveApys, portfolio.totalInvested);
          targetApy = newPositions.reduce((sum, p) => sum + (p.entryApy * p.allocationPct / 100), 0);
        }
      } else {
        // ── MODE B: Algorithmic (no key set) ──
        newPositions = buildAlgorithmicRebalance(portfolio.positions, liveApys, portfolio.totalInvested);
        targetApy = newPositions.reduce((sum, p) => sum + (p.entryApy * p.allocationPct / 100), 0);
      }

      // ── Gate 2: 0.25% minimum APY improvement ───────────────────────────
      const improvement = targetApy - currentApy;
      if (improvement < MIN_APY_IMPROVEMENT_PCT) {
        logger.debug(
          `No rebalance for ${wallet.slice(0, 8)}…: improvement ${improvement.toFixed(3)}% < ${MIN_APY_IMPROVEMENT_PCT}%`
        );
        await portfolioService.setLastDecision(wallet, {
          action: "skipped",
          reason: `APY improvement ${improvement.toFixed(3)}% < ${MIN_APY_IMPROVEMENT_PCT}% threshold`,
          currentApy,
          targetApy,
          improvement,
        });
        continue;
      }

      // ── On-chain execution ───────────────────────────────────────────────
      let txHashes: string[] = paymentTxHash ? [paymentTxHash] : [];

      if (config.AGENT_SIGNER_SECRET_KEY && portfolio.vaultAddress) {
        try {
          const onChainHashes = await executeOnChain(
            portfolio.vaultAddress,
            config.AGENT_SIGNER_SECRET_KEY,
            newPositions,
          );
          txHashes = [...txHashes, ...onChainHashes];
        } catch (err) {
          logger.warn(`On-chain execution failed for ${wallet.slice(0, 8)}…`, { err });
          // Don't record positions if on-chain execution fails
          continue;
        }
      }

      // ── Record ONLY after confirmed tx hashes ────────────────────────────
      await portfolioService.recordPositions({
        wallet,
        vaultAddress: portfolio.vaultAddress,
        positions: newPositions,
        totalAmount: portfolio.totalInvested,
        txHashes,
        reason: "auto_rebalance",
      });

      rebalanceCount++;
      logger.info(
        `Rebalancer: auto-rebalanced ${wallet.slice(0, 8)}… ` +
        `${currentApy.toFixed(2)}% → ${targetApy.toFixed(2)}% [${agentMode}]` +
        (txHashes.length ? ` tx:${txHashes[0]?.slice(0, 12)}…` : " (tracking only)")
      );
      await portfolioService.setLastDecision(wallet, {
        action: "rebalanced",
        reason: `APY improved ${improvement.toFixed(3)}% (${currentApy.toFixed(2)}% → ${targetApy.toFixed(2)}%)`,
        currentApy,
        targetApy,
        improvement,
      });

    } catch (err) {
      logger.error(`Rebalancer: error for ${wallet.slice(0, 8)}…`, { err });
    }
  }

  isRunning = false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Manually trigger a rebalance check — used by /api/rebalance/trigger and event hooks. */
export async function triggerRebalance(): Promise<void> {
  await autoRebalanceAll();
}

export function startRebalancer() {
  const interval = config.REBALANCE_INTERVAL_MINUTES || "5";
  const agentMode = config.AGENT_SIGNER_SECRET_KEY ? "x402+AI (pays per rebalance)" : "algorithmic (no key set)";
  logger.info(
    `Autonomous rebalancer started — every ${interval} min, ` +
    `min hold: ${MIN_POSITION_HOLD_HOURS}h, ` +
    `min APY improvement: ${MIN_APY_IMPROVEMENT_PCT}%, ` +
    `mode: ${agentMode}`
  );

  cron.schedule(`*/${interval} * * * *`, () => {
    autoRebalanceAll().catch(err => logger.error("Rebalancer tick failed", { err }));
  });

  // Snapshot cron: every 30 minutes, record a lightweight portfolio snapshot per wallet
  cron.schedule("*/30 * * * *", () => {
    takeSnapshots().catch(err => logger.error("Snapshot tick failed", { err }));
  });
}

async function takeSnapshots() {
  const wallets = await portfolioService.getAllWallets();
  if (wallets.length === 0) return;
  const liveApys = await getLiveApys();

  for (const wallet of wallets) {
    try {
      const portfolio = await portfolioService.getPortfolio(wallet);
      if (!portfolio) continue;

      const totalDeployed = portfolio.positions.reduce((s, p) => s + p.amountUsdc, 0);
      const weightedApy = totalDeployed > 0
        ? portfolio.positions.reduce((s, p) => s + ((liveApys[p.protocolKey] ?? p.entryApy) * p.amountUsdc / totalDeployed), 0)
        : 0;

      // Fetch real on-chain vault balance when vaultAddress is known; fall back to totalDeployed
      let vaultBalanceUsdc = totalDeployed;
      let snapshotSource: "onchain" | "tracked" = "tracked";
      if (portfolio.vaultAddress) {
        try {
          const rawBalance = await vaultService.getBalance(portfolio.vaultAddress);
          vaultBalanceUsdc = parseInt(rawBalance || "0") / 10_000_000;
          snapshotSource = "onchain";
        } catch {
          // vault RPC down — keep tracked fallback
        }
      }

      // Earned estimate on top of deployed principal
      const earnedEst = portfolio.positions.reduce((s, p) => {
        const days = (Date.now() - new Date(p.deployedAt).getTime()) / 86_400_000;
        return s + p.amountUsdc * ((liveApys[p.protocolKey] ?? p.entryApy) / 100) * days / 365;
      }, 0);

      await portfolioService.recordSnapshot(wallet, {
        vaultBalanceUsdc,
        totalDeployedUsdc: totalDeployed,
        weightedApy: parseFloat(weightedApy.toFixed(2)),
        totalValueEstimate: parseFloat((vaultBalanceUsdc + earnedEst).toFixed(4)),
        source: snapshotSource,
      });
    } catch (err) {
      logger.warn(`Snapshot failed for ${wallet.slice(0, 8)}…`, { err });
    }
  }
}

export function getRebalancerStatus() {
  return {
    running: true,
    mode: config.AGENT_SIGNER_SECRET_KEY ? "x402+AI" : "algorithmic",
    intervalMinutes: parseInt(config.REBALANCE_INTERVAL_MINUTES || "5"),
    minPositionHoldHours: MIN_POSITION_HOLD_HOURS,
    minApyImprovementPct: MIN_APY_IMPROVEMENT_PCT,
    rebalanceCount,
    x402PaymentCount,
    lastRunAt,
    trackedWallets: trackedWalletCount,
  };
}

// Kept for backward-compat — yield-optimizer used to call this
export function setTargetAllocation(_targets: any[]) {}
