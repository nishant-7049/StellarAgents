import { Router } from "express";
import { Keypair } from "@stellar/stellar-sdk";
import { getRebalancerStatus, triggerRebalance } from "../defi/rebalancer.js";
import { portfolioService } from "../services/portfolio.service.js";
import { BlendClient as SdkBlendClient } from "@agenticocean/defi-agent";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const rebalanceRoutes = Router();

/** Verify X-Admin-Key header matches ADMIN_SECRET_KEY */
function requireAdmin(req: any, res: any, next: any) {
  const key = req.headers["x-admin-key"] as string | undefined;
  if (!key || !config.ADMIN_SECRET_KEY || key !== config.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

rebalanceRoutes.get("/status", async (_req, res) => {
  res.json(getRebalancerStatus());
});

rebalanceRoutes.post("/trigger", async (_req, res) => {
  res.json({ message: "Rebalance check triggered", status: "ok" });
  // Run async after responding so the HTTP request doesn't hang
  triggerRebalance().catch(() => {});
});

/**
 * POST /api/rebalance/withdraw-all
 * Admin-only. Withdraws all deployed funds from protocols back to vault.
 *
 * Auth: X-Admin-Key header must match ADMIN_SECRET_KEY.
 *
 * Steps:
 *   1. Read current positions from MongoDB
 *   2. Attempt on-chain withdrawal from Blend via SDK (best effort)
 *   3. Clear MongoDB positions to idle regardless of on-chain result
 */
rebalanceRoutes.post("/withdraw-all", requireAdmin, async (req, res) => {
  if (!config.AGENT_SIGNER_SECRET_KEY || !config.ADMIN_VAULT_ADDRESS) {
    return res.status(400).json({ error: "AGENT_SIGNER_SECRET_KEY and ADMIN_VAULT_ADDRESS must be set" });
  }

  const agentPubKey = Keypair.fromSecret(config.AGENT_SIGNER_SECRET_KEY).publicKey();
  const vaultAddress = config.ADMIN_VAULT_ADDRESS;

  try {
    const portfolio = await portfolioService.getPortfolio(agentPubKey);

    if (!portfolio || portfolio.positions.length === 0) {
      return res.json({ success: true, message: "No positions to withdraw — vault already idle", txHashes: [] });
    }

    const blendPositions = portfolio.positions.filter(p => p.protocolKey === "blend");
    const soroswapPositions = portfolio.positions.filter(p => p.protocolKey === "soroswap");
    const totalDeployed = portfolio.positions.reduce((s, p) => s + p.amountUsdc, 0);
    const txHashes: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // ── Attempt on-chain Blend withdrawal ──────────────────────────────────
    if (blendPositions.length > 0 && config.BLEND_POOL_USDC) {
      const sdkBlend = new SdkBlendClient({
        stellarRpcUrl: config.STELLAR_RPC_URL,
        networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
        usdcAddress: config.USDC_SAC_ADDRESS,
        blendPoolId: config.BLEND_POOL_USDC,
        logger,
      });

      for (const pos of blendPositions) {
        const stroops = BigInt(Math.round(pos.amountUsdc * 1e7));
        if (stroops <= 0n) continue;

        try {
          const result = await sdkBlend.executeViaVault({
            poolId: config.BLEND_POOL_USDC,
            agentSignerSecret: config.AGENT_SIGNER_SECRET_KEY,
            vaultContract: vaultAddress,
            asset: config.USDC_SAC_ADDRESS,
            amount: stroops,
            facilitatorUrl: `http://localhost:${config.PORT || "3001"}`,
            memo: "withdraw_all",
          });
          txHashes.push(result.txHash);
          logger.info(`Blend withdrawal executed`, { txHash: result.txHash, amountUsdc: pos.amountUsdc });
        } catch (err: any) {
          const msg = err?.message || String(err);
          errors.push(`Blend withdraw failed: ${msg}`);
          logger.warn("Blend withdrawal failed — positions cleared in DB anyway", { err: msg });
        }
      }
    }

    // ── Soroswap LP positions — on-chain removal not yet supported ──────────
    // Soroswap LP removal requires calling the pair contract's remove_liquidity()
    // directly, which is not yet implemented in the SDK. LP tokens remain on-chain
    // until manually removed via the Soroswap UI or a future SDK update.
    if (soroswapPositions.length > 0) {
      const soroswapTotal = soroswapPositions.reduce((s, p) => s + p.amountUsdc, 0);
      const msg = `Soroswap LP positions (${soroswapPositions.length} position(s), ~${soroswapTotal.toFixed(2)} USDC) ` +
        `require manual withdrawal — LP tokens remain on-chain. Use the Soroswap UI to remove liquidity.`;
      warnings.push(msg);
      logger.warn("Soroswap LP withdrawal skipped — not supported via SDK", {
        positions: soroswapPositions.length,
        totalUsdc: soroswapTotal.toFixed(2),
      });
    }

    // ── Always clear MongoDB to idle ───────────────────────────────────────
    await portfolioService.recordPositions({
      wallet: agentPubKey,
      vaultAddress,
      positions: [{
        protocol: "Idle USDC",
        protocolKey: "idle",
        amountUsdc: totalDeployed,
        allocationPct: 100,
        entryApy: 0,
        deployedAt: new Date().toISOString(),
      }],
      totalAmount: totalDeployed,
      txHashes,
      reason: "manual_withdraw_all",
    });

    logger.info("withdraw-all complete", { agentPubKey: agentPubKey.slice(0, 8), txHashes, errors, warnings });

    res.json({
      success: true,
      message: txHashes.length > 0
        ? `Withdrawn ${blendPositions.length} Blend position(s) on-chain. Portfolio marked idle.`
        : `Portfolio marked idle in DB. ${errors.length > 0 ? "On-chain withdrawal needs manual action — see errors." : ""}`,
      totalDeployedUsdc: totalDeployed.toFixed(2),
      txHashes,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (err: any) {
    logger.error("withdraw-all failed", { err: err.message });
    res.status(500).json({ error: err.message });
  }
});
