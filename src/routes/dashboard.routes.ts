import { Router } from "express";
import { vaultService } from "../services/vault.service.js";
import { agentService } from "../services/agent.service.js";
import { creditsService } from "../services/credits.service.js";
import { logger } from "../logger.js";
import { config } from "../config.js";
import { formatUsdc } from "@agenticocean/x402-stellar";

export const dashboardRoutes = Router();

/**
 * GET /api/dashboard/:walletAddress
 *
 * Aggregated dashboard data:
 * - Vault balance + total deposited + agent spending
 * - Authorized agents with remaining daily limits
 * - Credit balance + daily usage
 * - Last 10 x402 payments (decoded)
 */
dashboardRoutes.get("/:walletAddress", async (req, res) => {
  const { walletAddress } = req.params;

  if (!walletAddress) {
    return res.status(400).json({ error: "walletAddress required" });
  }

  try {
    // Fetch vault data
    let vaultAddress: string | null = null;
    let vaultBalance = "0";
    let totalSpent = "0";
    const authorizedAgents: any[] = [];

    if (config.VAULT_FACTORY_ADDRESS) {
      try {
        vaultAddress = await vaultService.getVaultForOwner(walletAddress);
      } catch {
        // No vault yet
      }

      if (vaultAddress) {
        try {
          const balance = await vaultService.getBalance(vaultAddress);
          vaultBalance = balance.toString();
        } catch {
          // Balance unavailable
        }

        try {
          const spent = await vaultService.getTotalSpent(vaultAddress);
          totalSpent = spent.toString();
        } catch {
          // Spent unavailable
        }
      }
    }

    // Fetch registered agent
    let agentId: number | null = null;
    let agentInfo: any = null;
    if (config.AGENT_REGISTRY_ADDRESS) {
      try {
        agentId = await agentService.getPrimaryAgentToken(walletAddress);
        if (agentId !== null) {
          agentInfo = await agentService.getAgent(agentId);
        }
      } catch {
        // No agent
      }
    }

    // If agent is registered, get vault policy for that agent
    if (vaultAddress && agentInfo?.agent_signer) {
      try {
        const policy = await vaultService.getAgentPolicy(vaultAddress, agentInfo.agent_signer);
        if (policy) {
          authorizedAgents.push({
            address: agentInfo.agent_signer,
            name: agentInfo.name || "My Agent",
            dailyLimit: policy.daily_limit.toString(),
            spentToday: policy.spent_today.toString(),
            isActive: policy.is_active,
            remainingLimit: Math.max(0, Number(policy.daily_limit) - Number(policy.spent_today)).toString(),
          });
        }
      } catch {
        // Policy unavailable
      }
    }

    // Fetch credits
    const credits = await creditsService.getCredits(walletAddress);

    // Fetch recent events (last 10 x402 payments)
    let recentPayments: any[] = [];
    if (config.VAULT_FACTORY_ADDRESS) {
      try {
        const horizonUrl = config.STELLAR_HORIZON_URL || "https://horizon.stellar.org";
        const resp = await fetch(
          `${horizonUrl}/accounts/${walletAddress}/operations?limit=10&order=desc`
        );
        if (resp.ok) {
          const data = await resp.json() as any;
          recentPayments = (data._embedded?.records || []).slice(0, 10).map((op: any) => ({
            id: op.id,
            type: op.type === "invoke_host_function" ? "Contract Call" : op.type,
            description: decodeOperationType(op),
            amount: op.amount ? formatUsdc(Math.round(parseFloat(op.amount) * 10_000_000)) : null,
            timestamp: op.created_at,
            txHash: op.transaction_hash,
          }));
        }
      } catch {
        // Events unavailable
      }
    }

    res.json({
      walletAddress,
      vault: {
        address: vaultAddress,
        balance: vaultBalance,
        balanceFormatted: formatUsdc(vaultBalance),
        totalSpent: totalSpent,
        totalSpentFormatted: formatUsdc(totalSpent),
      },
      agent: agentInfo ? {
        id: agentId,
        name: agentInfo.name,
        isActive: agentInfo.is_active,
      } : null,
      authorizedAgents,
      credits: {
        balance: credits.balance,
        plan: credits.plan,
        usedThisMonth: credits.usedThisMonth,
        monthlyQuota: credits.monthlyQuota,
        resetDate: credits.resetDate,
      },
      recentActivity: recentPayments,
    });
  } catch (err: any) {
    logger.error("Dashboard fetch failed", { walletAddress, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

function decodeOperationType(op: any): string {
  switch (op.type) {
    case "invoke_host_function":
      return "Smart contract interaction";
    case "payment":
      return `Payment: ${op.amount} ${op.asset_type === "native" ? "XLM" : op.asset_code || "USDC"}`;
    case "create_account":
      return "Account created";
    case "change_trust":
      return "Trust line change";
    default:
      return op.type?.replace(/_/g, " ") || "Unknown operation";
  }
}
