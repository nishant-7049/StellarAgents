import { Router } from "express";
import { x402Middleware } from "../middleware/x402.middleware.js";
import { YieldOptimizer } from "../ai/yield-optimizer.js";

export const yieldRoutes = Router();
const optimizer = new YieldOptimizer();

yieldRoutes.use(
  "/query",
  x402Middleware({
    price: "100000",
    description: "AI-powered DeFi yield optimization query",
  })
);

yieldRoutes.get("/query", async (req, res) => {
  const q = req.query.q as string;
  const risk = (req.query.risk as string) || "moderate";
  const amount = req.query.amount ? parseFloat(req.query.amount as string) : undefined;
  if (!q) return res.status(400).json({ error: "query parameter 'q' required" });
  const result = await optimizer.optimize(q, risk, amount);
  res.json({ ...result, x402: (req as any).x402 });
});

yieldRoutes.post("/query", async (req, res) => {
  const { query, risk_tolerance, amount } = req.body;
  if (!query) return res.status(400).json({ error: "'query' field required" });
  const result = await optimizer.optimize(query, risk_tolerance || "moderate", amount);
  res.json({ ...result, x402: (req as any).x402 });
});
