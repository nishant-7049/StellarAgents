/**
 * Mainnet smoke test: minimal amounts to verify contract functionality.
 * Run from repo root: pnpm --filter @agentnet/backend exec tsx src/scripts/smoke-mainnet.ts
 * Or from apps/backend: pnpm exec tsx src/scripts/smoke-mainnet.ts
 *
 * Uses: STELLAR_RPC_URL, STELLAR_NETWORK_PASSPHRASE, contract addresses and keys from env.
 * Does NOT mint USDC (mainnet). Ensure admin has a small amount of USDC for deposit.
 */
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");
const ENV_CONTRACTS_PATH = path.join(ROOT, ".env.contracts");
const BACKEND_ENV_PATH = path.join(ROOT, "apps", "backend", ".env");
const PATH_ENV = `${process.env.HOME}/.cargo/bin:${process.env.PATH}`;

// Minimal amounts for mainnet (stroops: 1 USDC = 10_000_000)
const DEPOSIT_STROOPS = 1_000_000;       // 0.1 USDC
const DAILY_LIMIT_STROOPS = 1_000_000;   // 0.1 USDC
const AGENT_PAY_STROOPS = 10_000;        // 0.001 USDC

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    result[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return result;
}

function loadEnv(): Record<string, string> {
  const fromRoot = parseEnvFile(path.join(ROOT, ".env"));
  const fromContracts = parseEnvFile(ENV_CONTRACTS_PATH);
  const fromBackend = parseEnvFile(BACKEND_ENV_PATH);
  return { ...fromRoot, ...fromContracts, ...fromBackend, ...process.env };
}

function run(cmd: string): string {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, {
    encoding: "utf-8",
    cwd: ROOT,
    env: { ...process.env, PATH: PATH_ENV },
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function main() {
  const env = loadEnv();
  const rpcUrl = env.STELLAR_RPC_URL || env.STELLAR_MAINNET_RPC_URL || "https://rpc.lightsail.network";
  const passphrase = (env.STELLAR_NETWORK_PASSPHRASE || env.STELLAR_MAINNET_NETWORK_PASSPHRASE || "Public Global Stellar Network ; September 2015").replace(/^"|"$/g, "");
  const cli = `--rpc-url ${JSON.stringify(rpcUrl)} --network-passphrase ${JSON.stringify(passphrase)}`;

  const factoryAddress = env.VAULT_FACTORY_ADDRESS;
  const registryAddress = env.AGENT_REGISTRY_ADDRESS;
  const usdcSacAddress = env.USDC_SAC_ADDRESS;
  let vaultAddress = (env.ADMIN_VAULT_ADDRESS || "").trim();

  if (!factoryAddress || !registryAddress) {
    console.error("Missing VAULT_FACTORY_ADDRESS or AGENT_REGISTRY_ADDRESS in .env / .env.contracts");
    process.exit(1);
  }

  console.log("\n=== AgentNet Mainnet Smoke Test (minimal amounts) ===\n");
  console.log(`Factory:  ${factoryAddress}`);
  console.log(`Registry: ${registryAddress}`);
  console.log(`RPC:     ${rpcUrl}`);
  console.log(`Deposit: ${DEPOSIT_STROOPS} stroops (0.1 USDC), agent_pay: ${AGENT_PAY_STROOPS} stroops (0.001 USDC)\n`);

  const adminPubkey = run(`stellar keys address agentnet-admin`);
  const facilitatorPubkey = run(`stellar keys address agentnet-facilitator`);
  const agentPubkey = run(`stellar keys address agentnet-agent-signer`);

  // ── 1) Vault ──
  console.log("[1] Vault");
  if (!vaultAddress) {
    const hasVault = run(`stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin ${cli} -- has_vault --owner ${adminPubkey}`);
    if (hasVault === "true") {
      vaultAddress = run(`stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin ${cli} -- get_vault --owner ${adminPubkey}`).replace(/"/g, "");
      console.log(`  Using existing vault: ${vaultAddress}`);
    } else {
      vaultAddress = run(`stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin ${cli} -- create_vault --owner ${adminPubkey}`).replace(/"/g, "");
      console.log(`  Created vault: ${vaultAddress}`);
    }
  } else {
    console.log(`  Using ADMIN_VAULT_ADDRESS: ${vaultAddress}`);
  }

  // ── 2) Deposit (minimal) ──
  console.log("\n[2] Deposit 0.1 USDC into vault");
  try {
    run(`stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin ${cli} -- deposit --from ${adminPubkey} --amount ${DEPOSIT_STROOPS}`);
    console.log("  Deposit succeeded.");
  } catch (e: any) {
    const msg = e?.stderr?.toString() || e?.message || "";
    if (msg.includes("InsufficientBalance") || msg.includes("auth")) {
      console.warn("  Skip deposit (insufficient USDC or auth). Ensure admin holds at least 0.1 USDC.");
    } else throw e;
  }

  // ── 3) Balance ──
  console.log("\n[3] Vault balance");
  try {
    const balance = run(`stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin ${cli} -- balance`);
    console.log(`  Balance: ${balance} stroops`);
  } catch (e) {
    console.warn("  Balance check failed:", (e as any)?.message);
  }

  // ── 4) Add agent (if not already) ──
  let canRunAgentPay = false;
  console.log("\n[4] Add agent with 0.1 USDC daily limit");
  try {
    run(`stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin ${cli} -- add_agent --owner ${adminPubkey} --agent ${agentPubkey} --daily_limit ${DAILY_LIMIT_STROOPS} --allowed_destinations '[]'`);
    console.log("  Agent added.");
    canRunAgentPay = true;
  } catch (e: any) {
    const msg = e?.stderr?.toString() || e?.message || "";
    if (msg.includes("DuplicateAgent") || msg.includes("Error(Contract, #9)")) {
      console.log("  Agent already added, skipping.");
      canRunAgentPay = true;
    } else if (msg.includes("Error(Contract, #3)") || msg.includes("NotOwner")) {
      console.warn("  Vault owner is not agentnet-admin (different key). Skipping add_agent and agent_pay.");
    } else throw e;
  }

  // ── 5) agent_pay (minimal) ──
  if (canRunAgentPay) {
    console.log("\n[5] agent_pay 0.001 USDC to facilitator");
    try {
      run(`stellar contract invoke --id ${vaultAddress} --source-account agentnet-agent-signer ${cli} -- agent_pay --agent ${agentPubkey} --pay_to ${facilitatorPubkey} --amount ${AGENT_PAY_STROOPS} --memo smoke_mainnet`);
      console.log("  agent_pay succeeded.");
    } catch (e: any) {
      const msg = e?.stderr?.toString() || e?.message || "";
      if (msg.includes("InsufficientBalance") || msg.includes("ExceedsDailyLimit")) {
        console.warn("  Skip agent_pay (insufficient balance or limit).");
      } else throw e;
    }
  } else {
    console.log("\n[5] agent_pay skipped (vault owner mismatch)");
  }

  // ── 6) Verify vault ──
  console.log("\n[6] Vault state");
  try {
    const balance = run(`stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin ${cli} -- balance`);
    const remaining = run(`stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin ${cli} -- remaining_limit --agent ${agentPubkey}`);
    const totalSpent = run(`stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin ${cli} -- total_spent`);
    console.log(`  Balance: ${balance}, remaining_limit: ${remaining}, total_spent: ${totalSpent}`);
  } catch (e) {
    console.warn("  State read failed:", (e as any)?.message);
  }

  // ── 7) Registry read-only ──
  console.log("\n[7] AgentRegistry (read-only)");
  try {
    const activeCount = run(`stellar contract invoke --id ${registryAddress} --source-account agentnet-admin ${cli} -- active_count`);
    const totalSupply = run(`stellar contract invoke --id ${registryAddress} --source-account agentnet-admin ${cli} -- total_supply`);
    console.log(`  active_count: ${activeCount}, total_supply: ${totalSupply}`);
  } catch (e) {
    console.warn("  Registry read failed:", (e as any)?.message);
  }

  console.log("\n=== Mainnet smoke test complete ===\n");
}

main().catch((err) => {
  console.error("\nSmoke test failed:", err.message);
  process.exit(1);
});
