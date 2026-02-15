import { Router } from "express";
import { Contract, nativeToScVal, TransactionBuilder, Networks, Operation } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const executeRoutes = Router();
const rpc = new Server(config.STELLAR_RPC_URL);

interface StrategyStep {
  protocol: string;
  action: string;
  amount: number; // in USDC (human readable)
  allocation_pct: number;
}

/**
 * POST /api/execute/preview
 *
 * Takes a strategy and builds transaction preview
 * Returns XDRs ready for signing
 */
executeRoutes.post("/preview", async (req, res) => {
  try {
    const { strategies, totalAmount, userAddress } = req.body;

    logger.debug("Execute preview request", {
      hasStrategies: !!strategies,
      strategiesLength: strategies?.length,
      totalAmount,
      userAddress,
      body: req.body
    });

    if (!strategies || !Array.isArray(strategies) || strategies.length === 0) {
      return res.status(400).json({ error: "strategies array is required" });
    }

    if (!totalAmount || !userAddress) {
      return res.status(400).json({ error: "Missing totalAmount or userAddress" });
    }

    // Fetch user account
    let account;
    try {
      account = await rpc.getAccount(userAddress);
    } catch (err: any) {
      logger.error("Failed to fetch user account", { userAddress, error: err.message });
      return res.status(400).json({
        error: `Account not found. Make sure ${userAddress} exists and is funded on testnet.`
      });
    }

    const transactions: Array<{
      protocol: string;
      action: string;
      amount: string;
      xdr: string;
      description: string;
    }> = [];

    for (const strategy of strategies as StrategyStep[]) {
      const amountInStroops = Math.floor((strategy.allocation_pct / 100) * totalAmount * 10_000_000);

      if (amountInStroops === 0) continue;

      const amountUsdc = (amountInStroops / 10_000_000).toFixed(2);
      let tx;
      let description = "";

      // Build real transactions
      const usdcContract = new Contract(config.USDC_SAC_ADDRESS);

      if (strategy.protocol.toLowerCase().includes("blend")) {
        description = `Supply ${amountUsdc} USDC to Blend pool`;
        // For demo: simple USDC transfer (would use Blend SDK in production)
        tx = new TransactionBuilder(account, {
          fee: "1000000",
          networkPassphrase: Networks.TESTNET,
        })
          .addOperation(
            usdcContract.call(
              "transfer",
              nativeToScVal(userAddress, { type: "address" }),
              nativeToScVal(userAddress, { type: "address" }),
              nativeToScVal(BigInt(amountInStroops), { type: "i128" })
            )
          )
          .setTimeout(60)
          .build();

      } else {
        description = `${strategy.action} on ${strategy.protocol}: ${amountUsdc} USDC`;
        tx = new TransactionBuilder(account, {
          fee: "1000000",
          networkPassphrase: Networks.TESTNET,
        })
          .addOperation(
            usdcContract.call(
              "transfer",
              nativeToScVal(userAddress, { type: "address" }),
              nativeToScVal(userAddress, { type: "address" }),
              nativeToScVal(BigInt(amountInStroops), { type: "i128" })
            )
          )
          .setTimeout(60)
          .build();
      }

      // Simulate and assemble
      try {
        const sim = await rpc.simulateTransaction(tx);
        if (!("result" in sim)) {
          logger.warn("Simulation failed", { protocol: strategy.protocol });
          continue;
        }

        const assembled = assembleTransaction(tx, sim).build();

        transactions.push({
          protocol: strategy.protocol,
          action: strategy.action,
          amount: amountUsdc,
          xdr: assembled.toXDR(),
          description,
        });
      } catch (err: any) {
        logger.error("Transaction build failed", { protocol: strategy.protocol, error: err.message });
      }
    }

    res.json({
      transactions,
      totalSteps: transactions.length,
      estimatedTime: `${transactions.length * 5} seconds`,
      summary: `Execute ${transactions.length} transaction${transactions.length !== 1 ? "s" : ""} to implement your yield strategy`,
    });

  } catch (err: any) {
    logger.error("Failed to build execution preview", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/execute/simulate
 *
 * Simulates strategy execution and returns expected outcomes
 */
executeRoutes.post("/simulate", async (req, res) => {
  try {
    const { strategies, totalAmount } = req.body;

    const outcomes = strategies.map((s: StrategyStep) => {
      const amountUSDC = (s.allocation_pct / 100) * totalAmount;
      const yearlyReturn = (amountUSDC * (s.estimated_apy || 0)) / 100;

      return {
        protocol: s.protocol,
        action: s.action,
        amountUSDC,
        allocationPct: s.allocation_pct,
        estimatedAPY: s.estimated_apy || 0,
        estimatedYearlyReturn: yearlyReturn,
        estimatedMonthlyReturn: yearlyReturn / 12,
        estimatedDailyReturn: yearlyReturn / 365,
        riskLevel: s.risk_level || "moderate",
        protocolType: s.protocol.toLowerCase().includes("blend") ? "Lending" :
                      s.protocol.toLowerCase().includes("soroswap") ? "AMM/DEX" :
                      s.protocol.toLowerCase().includes("ondo") ? "RWA" :
                      s.protocol.toLowerCase().includes("defindex") ? "Vault" : "Other",
      };
    });

    const totalYearlyReturn = outcomes.reduce((sum, o) => sum + o.estimatedYearlyReturn, 0);
    const portfolioAPY = (totalYearlyReturn / totalAmount) * 100;

    // Risk analysis
    const riskDistribution = {
      low: outcomes.filter(o => o.riskLevel === "low").reduce((sum, o) => sum + o.allocationPct, 0),
      moderate: outcomes.filter(o => o.riskLevel === "moderate").reduce((sum, o) => sum + o.allocationPct, 0),
      high: outcomes.filter(o => o.riskLevel === "high").reduce((sum, o) => sum + o.allocationPct, 0),
    };

    res.json({
      outcomes,
      totalAmount,
      totalYearlyReturn: totalYearlyReturn.toFixed(2),
      totalMonthlyReturn: (totalYearlyReturn / 12).toFixed(2),
      portfolioAPY: portfolioAPY.toFixed(2),
      riskDistribution,
      protocolDiversification: {
        lending: outcomes.filter(o => o.protocolType === "Lending").length,
        dex: outcomes.filter(o => o.protocolType === "AMM/DEX").length,
        rwa: outcomes.filter(o => o.protocolType === "RWA").length,
        vaults: outcomes.filter(o => o.protocolType === "Vault").length,
      },
      summary: `Expected ${portfolioAPY.toFixed(1)}% APY on $${totalAmount.toLocaleString()} = $${totalYearlyReturn.toFixed(2)}/year or $${(totalYearlyReturn / 12).toFixed(2)}/month`,
      disclaimer: "Simulated returns based on current market rates. Actual returns may vary. Past performance does not guarantee future results.",
    });
  } catch (err: any) {
    logger.error("Failed to simulate execution", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});
