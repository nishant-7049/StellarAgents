import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { routes } from "./routes/index.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { loggerMiddleware } from "./middleware/logger.middleware.js";
import { startRebalancer } from "./defi/rebalancer.js";
import { logger } from "./logger.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: ["http://localhost:3000", "https://agentnet.vercel.app"] }));
app.use(express.json());
app.use(loggerMiddleware);

app.get("/health", (_, res) => res.json({
  status: "ok",
  version: "0.1.0",
  network: "testnet",
  contracts: {
    factory: config.VAULT_FACTORY_ADDRESS,
    registry: config.AGENT_REGISTRY_ADDRESS,
  },
}));

app.use("/api", routes);
app.use(errorMiddleware);

startRebalancer();

app.listen(parseInt(config.PORT), () => {
  logger.info(`AgentNet backend on port ${config.PORT}`);
});
