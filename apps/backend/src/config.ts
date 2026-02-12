import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: "../../.env.contracts" });

const envSchema = z.object({
  PORT: z.string().default("3001"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  STELLAR_RPC_URL: z.string().default("https://soroban-testnet.stellar.org"),
  STELLAR_HORIZON_URL: z.string().default("https://horizon-testnet.stellar.org"),
  STELLAR_NETWORK_PASSPHRASE: z.string().default("Test SDF Network ; September 2015"),
  VAULT_FACTORY_ADDRESS: z.string().default(""),
  AGENT_REGISTRY_ADDRESS: z.string().default(""),
  USDC_SAC_ADDRESS: z.string().default(""),
  ADMIN_SECRET_KEY: z.string().default(""),
  FACILITATOR_SECRET_KEY: z.string().default(""),
  AGENT_SIGNER_SECRET_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SOROSWAP_API_KEY: z.string().optional(),
  BLEND_POOL_USDC: z.string().optional(),
  BLEND_BACKSTOP: z.string().optional(),
  REBALANCE_INTERVAL_MINUTES: z.string().default("5"),
  REBALANCE_DRIFT_THRESHOLD_PCT: z.string().default("5"),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
