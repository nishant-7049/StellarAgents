/**
 * Full mainnet contract flow test using your vault and agent signer.
 *
 * Set in .env or pass via env:
 *   MAINNET_VAULT_ADDRESS=CADMSYS3ZRDRI6B7MNJIZPQAJZ4JUQDOUEF5UR2BU3KV32K26FYTL4PK
 *   MAINNET_AGENT_SIGNER_ADDRESS=GDLCSUDUCBLY5Z727TAZ4ZLUTKYM2CC74FM77M3GJ7IA2BYEQRD6CRZ6
 *
 * Ensure stellar key "agentnet-agent-signer" is the key for GDLCSUDU... (for agent_pay signing).
 * Ensure "agentnet-admin" is the vault owner (for deposit, add_agent).
 *
 * Run: pnpm exec tsx src/scripts/test-mainnet-full-flow.ts
 */
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");
const ENV_CONTRACTS_PATH = path.join(ROOT, ".env.contracts");
const BACKEND_ENV_PATH = path.join(ROOT, "apps", "backend", ".env");
const PATH_ENV = `${process.env.HOME}/.cargo/bin:${process.env.PATH}`;

// Minimal mainnet amounts (stroops)
const DEPOSIT_STROOPS = 1_000_000;       // 0.1 USDC
const DAILY_LIMIT_STROOPS = 1_000_000;  // 0.1 USDC
const AGENT_PAY_STROOPS = 10_000;       // 0.001 USDC

const DEFAULT_VAULT = "CADMSYS3ZRDRI6B7MNJIZPQAJZ4JUQDOUEF5UR2BU3KV32K26FYTL4PK";
const DEFAULT_AGENT_SIGNER = "GDLCSUDUCBLY5Z727TAZ4ZLUTKYM2CC74FM77M3GJ7IA2BYEQRD6CRZ6";

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

function runSafe(cmd: string, label: string): boolean {
  try {
    run(cmd);
    return true;
  } catch (e: any) {
    const msg = e?.stderr?.toString() || e?.message || "";
    console.warn(`  ${label}: ${msg.slice(0, 120)}`);
    return false;
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const rpcUrl = env.STELLAR_RPC_URL || env.STELLAR_MAINNET_RPC_URL || "https://rpc.lightsail.network";
  const passphrase = (env.STELLAR_NETWORK_PASSPHRASE || env.STELLAR_MAINNET_NETWORK_PASSPHRASE || "Public Global Stellar Network ; September 2015").replace(/^"|"$/g, "");
  const cli = `--rpc-url ${JSON.stringify(rpcUrl)} --network-passphrase ${JSON.stringify(passphrase)}`;

  const factoryAddress = env.VAULT_FACTORY_ADDRESS;
  const registryAddress = env.AGENT_REGISTRY_ADDRESS;
  const reputationAddress = env.REPUTATION_REGISTRY_ADDRESS;
  const validationAddress = env.VALIDATION_REGISTRY_ADDRESS;
  // Use mainnet vault (yours); do not use ADMIN_VAULT_ADDRESS so this flow uses the intended vault.
  const vaultAddress = (env.MAINNET_VAULT_ADDRESS || DEFAULT_VAULT).trim();
  const agentSignerAddress = (env.MAINNET_AGENT_SIGNER_ADDRESS || DEFAULT_AGENT_SIGNER).trim();

  if (!factoryAddress || !registryAddress || !reputationAddress || !validationAddress) {
    console.error("Missing contract addresses (VAULT_FACTORY, AGENT_REGISTRY, REPUTATION_REGISTRY, VALIDATION_REGISTRY)");
    process.exit(1);
  }

  console.log("\n=== AgentNet Mainnet — Full Contract Flow ===\n");
  console.log(`Vault:    ${vaultAddress}`);
  console.log(`Agent:    ${agentSignerAddress}`);
  console.log(`Factory:  ${factoryAddress}`);
  console.log(`Registry: ${registryAddress}`);
  console.log(`Reputation: ${reputationAddress}`);
  console.log(`Validation: ${validationAddress}`);
  console.log(`Amounts: deposit 0.1 USDC, agent_pay 0.001 USDC\n`);

  const adminPubkey = run(`stellar keys address agentnet-admin`);
  const facilitatorPubkey = run(`stellar keys address agentnet-facilitator`);
  const agentKeyName = "agentnet-agent-signer"; // must be the key for agentSignerAddress

  // ─── 1) VaultFactory ───
  console.log("[1] VaultFactory — has_vault / get_vault");
  runSafe(
    `stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin ${cli} -- has_vault --owner ${adminPubkey}`,
    "has_vault"
  );
  runSafe(
    `stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin ${cli} -- vault_count`,
    "vault_count"
  );

  // ─── 2) UserVault ───
  console.log("\n[2] UserVault — balance");
  run(`stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin ${cli} -- balance`);

  console.log("\n[3] UserVault — deposit 0.1 USDC");
  runSafe(
    `stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin ${cli} -- deposit --from ${adminPubkey} --amount ${DEPOSIT_STROOPS}`,
    "deposit"
  );

  console.log("\n[4] UserVault — add_agent (your agent signer)");
  const addAgentOk = runSafe(
    `stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin ${cli} -- add_agent --owner ${adminPubkey} --agent ${agentSignerAddress} --daily_limit ${DAILY_LIMIT_STROOPS} --allowed_destinations '[]'`,
    "add_agent"
  );

  // Try agent_pay even if add_agent failed (e.g. DuplicateAgent = already added)
  console.log("\n[5] UserVault — agent_pay 0.001 USDC to facilitator");
  runSafe(
    `stellar contract invoke --id ${vaultAddress} --source-account ${agentKeyName} ${cli} -- agent_pay --agent ${agentSignerAddress} --pay_to ${facilitatorPubkey} --amount ${AGENT_PAY_STROOPS} --memo mainnet_flow`,
    "agent_pay"
  );

  console.log("\n[6] UserVault — remaining_limit, total_spent");
  runSafe(`stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin ${cli} -- remaining_limit --agent ${agentSignerAddress}`, "remaining_limit");
  runSafe(`stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin ${cli} -- total_spent`, "total_spent");

  // ─── 3) AgentRegistry ───
  const handle = `mainnet-flow-${Date.now()}`;
  // CLI expects a string; passing JSON object is parsed as map and fails. Use a single URL string.
  const agentUriStr = "https://example.com/agent";

  console.log("\n[7] AgentRegistry — mint_identity");
  let tokenIdOut = "";
  try {
    tokenIdOut = run(
      `stellar contract invoke --id ${registryAddress} --source-account agentnet-admin ${cli} -- mint_identity --owner ${adminPubkey} --name 'Mainnet Flow Agent' --handle '${handle}' --agent_uri '${agentUriStr}' --vault_address ${vaultAddress} --agent_signer ${agentSignerAddress}`
    );
    console.log(`  token_id: ${tokenIdOut}`);
  } catch (e: any) {
    const msg = e?.stderr?.toString() || e?.message || "";
    if (msg.includes("HandleAlreadyTaken")) console.warn("  Handle already taken, use another handle.");
    else throw e;
  }

  console.log("\n[8] AgentRegistry — get_agent_by_handle, active_count, total_supply");
  runSafe(`stellar contract invoke --id ${registryAddress} --source-account agentnet-admin ${cli} -- get_agent_by_handle --handle '${handle}'`, "get_agent_by_handle");
  run(`stellar contract invoke --id ${registryAddress} --source-account agentnet-admin ${cli} -- active_count`);
  run(`stellar contract invoke --id ${registryAddress} --source-account agentnet-admin ${cli} -- total_supply`);

  const tokenId = tokenIdOut ? tokenIdOut.replace(/\D/g, "") || "1" : "1";

  console.log("\n[9] AgentRegistry — get_agent, list_agents (read-only)");
  runSafe(`stellar contract invoke --id ${registryAddress} --source-account agentnet-admin ${cli} -- get_agent --token_id ${tokenId}`, "get_agent");
  runSafe(`stellar contract invoke --id ${registryAddress} --source-account agentnet-admin ${cli} -- list_agents --start_token_id 1 --limit 5`, "list_agents");

  // ─── 4) ReputationRegistry ───
  // agent_id: use 1 (first agent token id or legacy id)
  console.log("\n[10] ReputationRegistry — post_feedback (agent_id=1, score=4)");
  runSafe(
    `stellar contract invoke --id ${reputationAddress} --source-account agentnet-admin ${cli} -- post_feedback --agent_id 1 --reviewer ${adminPubkey} --score 4 --category 'mainnet_test' --data_uri 'https://example.com' --payment_proof_hash 'hash'`,
    "post_feedback"
  );

  console.log("\n[11] ReputationRegistry — get_feedback_summary(1)");
  run(`stellar contract invoke --id ${reputationAddress} --source-account agentnet-admin ${cli} -- get_feedback_summary --agent_id 1`);

  // ─── 5) ValidationRegistry ───
  console.log("\n[12] ValidationRegistry — request_validation (agent_id=1)");
  let requestIdOut = "";
  try {
    requestIdOut = run(
      `stellar contract invoke --id ${validationAddress} --source-account agentnet-admin ${cli} -- request_validation --agent_id 1 --validator ${adminPubkey} --request_uri 'https://example.com/validate' --data_hash 'abc123'`
    );
    console.log(`  request_id: ${requestIdOut}`);
  } catch (e) {
    console.warn("  request_validation failed (validator auth or duplicate)");
  }

  const requestId = requestIdOut.replace(/\D/g, "") || "";
  if (requestId) {
    console.log("\n[13] ValidationRegistry — submit_validation");
    runSafe(
      `stellar contract invoke --id ${validationAddress} --source-account agentnet-admin ${cli} -- submit_validation --request_id ${requestId} --validator ${adminPubkey} --success true --evidence_uri 'https://example.com/evidence'`,
      "submit_validation"
    );
    console.log("\n[14] ValidationRegistry — get_validation");
    runSafe(`stellar contract invoke --id ${validationAddress} --source-account agentnet-admin ${cli} -- get_validation --request_id ${requestId}`, "get_validation");
  } else {
    console.log("\n[13–14] ValidationRegistry — skip submit_validation / get_validation (no request_id; request_validation failed)");
  }

  console.log("\n=== Full mainnet flow complete ===\n");
}

void main().catch((err: Error) => {
  console.error("\nTest failed:", err?.message ?? err);
  process.exit(1);
});
