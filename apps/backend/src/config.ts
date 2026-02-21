import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

import { existsSync } from "fs";

// Resolve monorepo root — handle both direct execution and turborepo
function findRoot(): string {
  // If CWD is apps/backend, root is ../..
  const fromCwd = path.resolve(process.cwd(), "../..");
  if (existsSync(path.join(fromCwd, ".env.contracts"))) return fromCwd;
  // If CWD is the monorepo root
  if (existsSync(path.join(process.cwd(), ".env.contracts"))) return process.cwd();
  // Fallback: walk up from CWD
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, ".env.contracts"))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(process.cwd(), "../..");
}

const rootDir = findRoot();

// Load root .env first, then .env.contracts (override=true to merge)
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config({ path: path.join(rootDir, ".env.contracts"), override: true });

const envSchema = z.object({
  PORT: z.string().default("3001"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  STELLAR_RPC_URL: z.string().default("https://soroban-testnet.stellar.org"),
  STELLAR_HORIZON_URL: z.string().default("https://horizon-testnet.stellar.org"),
  STELLAR_NETWORK_PASSPHRASE: z.string().default("Test SDF Network ; September 2015"),
  VAULT_FACTORY_ADDRESS: z.string().default(""),
  AGENT_REGISTRY_ADDRESS: z.string().default(""),
  REPUTATION_REGISTRY_ADDRESS: z.string().default(""),
  VALIDATION_REGISTRY_ADDRESS: z.string().default(""),
  USDC_SAC_ADDRESS: z.string().default(""),
  ADMIN_SECRET_KEY: z.string().default(""),
  FACILITATOR_SECRET_KEY: z.string().default(""),
  AGENT_SIGNER_SECRET_KEY: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  SOROSWAP_API_KEY: z.string().optional(),
  BLEND_POOL_USDC: z.string().optional(),
  BLEND_BACKSTOP: z.string().optional(),
  REBALANCE_INTERVAL_MINUTES: z.string().default("5"),
  REBALANCE_DRIFT_THRESHOLD_PCT: z.string().default("0.5"),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/agentnet"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
