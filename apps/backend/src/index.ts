import express from "express";
import cors from "cors";
import helmet from "helmet";
import cron from "node-cron";
import { config } from "./config.js";
import { routes } from "./routes/index.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { loggerMiddleware } from "./middleware/logger.middleware.js";
import { startRebalancer } from "./defi/rebalancer.js";
import { startPortfolioMonitor } from "./defi/portfolio-monitor.js";
import { startEventIndexer } from "./stellar/event-indexer.js";
import { creditsService } from "./services/credits.service.js";
import { connectDB } from "./db/mongoose.js";
import { logger } from "./logger.js";

const app = express();

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      "http://localhost:3000",
      "https://localhost:3000",
      "https://agentnet.vercel.app",
      "https://2218-2409-40d7-fb-f7b2-2d1f-983a-a2d3-a897.ngrok-free.app",
    ];
    // Allow any ngrok tunnel and requests with no origin (curl, Postman)
    if (!origin || allowed.includes(origin) || /\.ngrok(-free)?\.app$/.test(origin) || /\.ngrok\.io$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  exposedHeaders: ["X-Admin-Session", "X-Payment-Response"],
}));
// Capture raw body for Stripe webhook signature verification
app.use(express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));
app.use(loggerMiddleware);

app.get("/health", (_, res) => res.json({
  status: "ok",
  version: "0.1.0",
  network: "mainnet",
  contracts: {
    factory: config.VAULT_FACTORY_ADDRESS,
    registry: config.AGENT_REGISTRY_ADDRESS,
    reputation: config.REPUTATION_REGISTRY_ADDRESS,
    validation: config.VALIDATION_REGISTRY_ADDRESS,
  },
}));

app.use("/api", routes);
app.use(errorMiddleware);

// Connect to MongoDB, then start server
connectDB().then(() => {
  startRebalancer();
  startPortfolioMonitor();
  startEventIndexer();

  // Nightly cron: downgrade expired paid plans to free (runs at midnight UTC)
  cron.schedule("0 0 * * *", () => {
    logger.info("Running nightly plan expiry check");
    creditsService.downgradeExpiredPlans();
  });

  app.listen(parseInt(config.PORT), () => {
    logger.info(`AgentNet backend on port ${config.PORT}`);
  });
});
