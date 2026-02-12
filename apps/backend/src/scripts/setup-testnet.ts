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
  console.log("=== AgentNet Testnet Setup ===\n");

  const env = loadEnvContracts();
  const factoryAddress = env.VAULT_FACTORY_ADDRESS;
  const registryAddress = env.AGENT_REGISTRY_ADDRESS;
  const usdcSacAddress = env.USDC_SAC_ADDRESS;

  console.log(`Factory:  ${factoryAddress}`);
  console.log(`Registry: ${registryAddress}`);
  console.log(`USDC SAC: ${usdcSacAddress}`);

  // ── Mint test USDC to admin ──
  console.log("\n[1] Minting test USDC to admin...");
  const adminPubkey = run("stellar keys address agentnet-admin");
  const issuerPubkey = run("stellar keys address agentnet-usdc-issuer");

  // Mint 10,000 USDC (10_000 * 10^7 = 100_000_000_000 stroops)
  // Use the SAC contract to mint (issuer calls mint)
  try {
    run(
      `stellar contract invoke --id ${usdcSacAddress} --source-account agentnet-usdc-issuer --network ${NETWORK} -- mint --to ${adminPubkey} --amount 100000000000`
    );
    console.log("  Minted 10,000 USDC to admin.");
  } catch (err: any) {
    const msg = err.stderr?.toString() || err.message;
    console.warn(`  Mint warning: ${msg}`);
  }

  // Mint some to facilitator too
  const facilitatorPubkey = run("stellar keys address agentnet-facilitator");
  try {
    run(
      `stellar contract invoke --id ${usdcSacAddress} --source-account agentnet-usdc-issuer --network ${NETWORK} -- mint --to ${facilitatorPubkey} --amount 10000000000`
    );
    console.log("  Minted 1,000 USDC to facilitator.");
  } catch (err: any) {
    console.warn(`  Mint warning: ${err.stderr?.toString() || err.message}`);
  }

  // ── Create a vault for admin ──
  console.log("\n[2] Creating vault for admin...");
  let vaultAddress: string | undefined;
  try {
    // Check if vault already exists
    const existing = run(
      `stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin --network ${NETWORK} -- has_vault --owner ${adminPubkey}`
    );
    if (existing === "true") {
      vaultAddress = run(
        `stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin --network ${NETWORK} -- get_vault --owner ${adminPubkey}`
      );
      // Strip quotes if present
      vaultAddress = vaultAddress.replace(/"/g, "");
      console.log(`  Vault already exists: ${vaultAddress}`);
    } else {
      throw new Error("No vault yet");
    }
  } catch {
    try {
      vaultAddress = run(
        `stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin --network ${NETWORK} -- create_vault --owner ${adminPubkey}`
      );
      vaultAddress = vaultAddress.replace(/"/g, "");
      console.log(`  Created vault: ${vaultAddress}`);
    } catch (err: any) {
      const msg = err.stderr?.toString() || err.message;
      if (msg.includes("UserAlreadyHasVault") || msg.includes("Error(Contract, #3)")) {
        console.log("  Vault already exists, fetching address...");
        vaultAddress = run(
          `stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin --network ${NETWORK} -- get_vault --owner ${adminPubkey}`
        );
        vaultAddress = vaultAddress.replace(/"/g, "");
        console.log(`  Vault: ${vaultAddress}`);
      } else {
        console.error(`  Create vault failed: ${msg}`);
      }
    }
  }

  if (!vaultAddress) {
    console.error("Failed to get vault address");
    process.exit(1);
  }

  // ── Deposit USDC into vault ──
  console.log("\n[3] Depositing 100 USDC into vault...");
  try {
    run(
      `stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin --network ${NETWORK} -- deposit --from ${adminPubkey} --amount 1000000000`
    );
    console.log("  Deposited 100 USDC.");
  } catch (err: any) {
    console.warn(`  Deposit warning: ${err.stderr?.toString() || err.message}`);
  }

  // ── Check balance ──
  console.log("\n[4] Checking vault balance...");
  try {
    const balance = run(
      `stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin --network ${NETWORK} -- balance`
    );
    const balUsdc = (parseInt(balance) / 10_000_000).toFixed(7);
    console.log(`  Vault balance: ${balance} stroops (${balUsdc} USDC)`);
  } catch (err: any) {
    console.warn(`  Balance check: ${err.stderr?.toString() || err.message}`);
  }

  // ── Add agent to vault ──
  console.log("\n[5] Adding agent-signer to vault...");
  const agentPubkey = run("stellar keys address agentnet-agent-signer");
  try {
    run(
      `stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin --network ${NETWORK} -- add_agent --owner ${adminPubkey} --agent ${agentPubkey} --daily_limit 100000000 --allowed_destinations '[]'`
    );
    console.log(`  Agent added with 10 USDC daily limit.`);
  } catch (err: any) {
    const msg = err.stderr?.toString() || err.message;
    if (msg.includes("DuplicateAgent") || msg.includes("Error(Contract, #9)")) {
      console.log("  Agent already added, skipping.");
    } else {
      console.warn(`  Add agent warning: ${msg}`);
    }
  }

  // ── Test agent_pay ──
  console.log("\n[6] Testing agent_pay (0.01 USDC)...");
  try {
    run(
      `stellar contract invoke --id ${vaultAddress} --source-account agentnet-agent-signer --network ${NETWORK} -- agent_pay --agent ${agentPubkey} --pay_to ${facilitatorPubkey} --amount 100000 --memo test_payment`
    );
    console.log("  agent_pay succeeded! Paid 0.01 USDC to facilitator.");
  } catch (err: any) {
    console.warn(`  agent_pay: ${err.stderr?.toString() || err.message}`);
  }

  // ── Verify balances ──
  console.log("\n[7] Post-payment verification...");
  try {
    const balance = run(
      `stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin --network ${NETWORK} -- balance`
    );
    console.log(`  Vault balance: ${balance}`);
    const remaining = run(
      `stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin --network ${NETWORK} -- remaining_limit --agent ${agentPubkey}`
    );
    console.log(`  Agent remaining limit: ${remaining}`);
    const totalSpent = run(
      `stellar contract invoke --id ${vaultAddress} --source-account agentnet-admin --network ${NETWORK} -- total_spent`
    );
    console.log(`  Total spent via agents: ${totalSpent}`);
  } catch (err: any) {
    console.warn(`  Verify: ${err.stderr?.toString() || err.message}`);
  }

  console.log(`\n=== Setup Complete ===`);
  console.log(`\nVault: ${vaultAddress}`);
  console.log(`View: https://stellar.expert/explorer/testnet/contract/${vaultAddress}`);
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  process.exit(1);
});
