import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");
const ENV_CONTRACTS_PATH = path.join(ROOT, ".env.contracts");
const NETWORK = "testnet";
const PATH_ENV = `${process.env.HOME}/.cargo/bin:${process.env.PATH}`;

function run(cmd: string): string {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, {
    encoding: "utf-8",
    env: { ...process.env, PATH: PATH_ENV },
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function loadEnvContracts(): Record<string, string> {
  if (!existsSync(ENV_CONTRACTS_PATH)) {
    console.error(".env.contracts not found. Run deploy-contracts first.");
    process.exit(1);
  }
  const envContent = readFileSync(ENV_CONTRACTS_PATH, "utf-8");
  const result: Record<string, string> = {};
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    result[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return result;
}

async function main() {
  console.log("=== Seeding Demo Agents ===\n");

  const env = loadEnvContracts();
  const registryAddress = env.AGENT_REGISTRY_ADDRESS;
  if (!registryAddress) {
    console.error("AGENT_REGISTRY_ADDRESS not set. Deploy contracts first.");
    process.exit(1);
  }
  console.log(`Registry: ${registryAddress}`);

  const adminPubkey = run("stellar keys address agentnet-admin");
  const agentSignerPubkey = run("stellar keys address agentnet-agent-signer");

  // Get vault address from factory
  const factoryAddress = env.VAULT_FACTORY_ADDRESS;
  let vaultAddress: string;
  try {
    vaultAddress = run(
      `stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin --network ${NETWORK} -- get_vault --owner ${adminPubkey}`
    );
    vaultAddress = vaultAddress.replace(/"/g, "");
    console.log(`Vault: ${vaultAddress}`);
  } catch {
    console.error("Could not find vault. Run setup-testnet first.");
    process.exit(1);
  }

  const demoAgents = [
    {
      name: "Yield Optimizer v1",
      uri: JSON.stringify({
        endpoints: { query: "https://agentnet-backend.railway.app/api/yield/query" },
        capabilities: ["yield", "rebalance"],
        pricing: { protocol: "x402", amount: "100000", asset: "USDC" },
        model: "claude-sonnet-4-5-20250929",
        version: "0.1.0",
      }),
    },
  ];

  for (const agent of demoAgents) {
    console.log(`\nRegistering: ${agent.name}...`);
    try {
      // Check current count first
      const nextId = run(
        `stellar contract invoke --id ${registryAddress} --source-account agentnet-admin --network ${NETWORK} -- next_id`
      );
      console.log(`  Next ID will be: ${nextId}`);

      // Strings need to be passed with proper escaping for Soroban
      const id = run(
        `stellar contract invoke --id ${registryAddress} --source-account agentnet-admin --network ${NETWORK} -- register --owner ${adminPubkey} --name '${agent.name}' --agent_uri '${agent.uri}' --vault_address ${vaultAddress} --agent_signer ${agentSignerPubkey}`
      );
      console.log(`  Registered with ID: ${id}`);
    } catch (err: any) {
      const msg = err.stderr?.toString() || err.message;
      console.warn(`  Register warning: ${msg}`);
    }
  }

  // Verify
  console.log("\nVerifying registrations...");
  try {
    const count = run(
      `stellar contract invoke --id ${registryAddress} --source-account agentnet-admin --network ${NETWORK} -- agent_count`
    );
    console.log(`  Total active agents: ${count}`);

    const agent1 = run(
      `stellar contract invoke --id ${registryAddress} --source-account agentnet-admin --network ${NETWORK} -- get_agent --agent_id 1`
    );
    console.log(`  Agent #1: ${agent1}`);
  } catch (err: any) {
    console.warn(`  Verify: ${err.stderr?.toString() || err.message}`);
  }

  console.log("\n=== Seed Complete ===");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
