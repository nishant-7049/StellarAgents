import { Router, Request, Response, NextFunction } from "express";
import { x402Middleware } from "../middleware/x402.middleware.js";
import { YieldOptimizer } from "../ai/yield-optimizer.js";
import { classifyQuery, extractRiskLevel } from "../ai/query-classifier.js";
import {
  generateGreeting,
  generateProtocolInfo,
  generateMarketData,
  generateComparison,
  generateEducation,
} from "../ai/response-generator.js";

export const yieldRoutes = Router();
const optimizer = new YieldOptimizer();

// Free query intents (no payment required)
const FREE_INTENTS = ["greeting", "protocol_info", "market_data", "comparison", "defi_education", "general_question"];

// Conditional x402 middleware - only charge for strategy requests
const conditionalX402 = (req: Request, res: Response, next: NextFunction) => {
  const query = (req.query.q || req.body.query) as string;
  if (!query) return next();

  const classified = classifyQuery(query);

  // Skip payment for free intents
  if (FREE_INTENTS.includes(classified.intent)) {
    return next();
  }

  // Require payment for strategy requests
  return x402Middleware({
    price: "100000", // 0.01 USDC in stroops
    description: "AI-powered DeFi yield optimization query",
  })(req, res, next);
};

yieldRoutes.get("/query", conditionalX402, async (req, res) => {
  const q = req.query.q as string;
  const risk = (req.query.risk as string) || "moderate";
  const amount = req.query.amount ? parseFloat(req.query.amount as string) : undefined;
  if (!q) return res.status(400).json({ error: "query parameter 'q' required" });

  const result = await handleQuery(q, risk, amount);
  res.json({ ...result, x402: (req as any).x402 });
});

yieldRoutes.post("/query", conditionalX402, async (req, res) => {
  const { query, risk_tolerance, amount } = req.body;
  if (!query) return res.status(400).json({ error: "'query' field required" });

  const result = await handleQuery(query, risk_tolerance || "moderate", amount);
  res.json({ ...result, x402: (req as any).x402 });
});

async function handleQuery(query: string, riskTolerance: string, amount?: number) {
  const classified = classifyQuery(query);
  const risk = extractRiskLevel(query) || riskTolerance;

  switch (classified.intent) {
    case "greeting":
      const greeting = await generateGreeting();
      return {
        type: "text",
        summary: greeting.content,
        query,
        risk_tolerance: risk,
      };

    case "protocol_info":
      const protocolInfo = await generateProtocolInfo(classified);
      return {
        type: "text",
        summary: protocolInfo.content,
        query,
        risk_tolerance: risk,
      };

    case "market_data":
      const marketData = await generateMarketData();
      return {
        type: "text",
        summary: marketData.content,
        query,
        risk_tolerance: risk,
        data: marketData.data,
      };

    case "comparison":
      const comparison = await generateComparison(classified);
      return {
        type: "text",
        summary: comparison.content,
        query,
        risk_tolerance: risk,
      };

    case "defi_education":
      const education = await generateEducation(query);
      return {
        type: "text",
        summary: education.content,
        query,
        risk_tolerance: risk,
      };

    case "strategy_request":
    default:
      // Use the full yield optimizer for strategy requests
      const strategyResult = await optimizer.optimize(
        query,
        risk,
        classified.entities.amount || amount
      );
      return strategyResult;
  }
}
