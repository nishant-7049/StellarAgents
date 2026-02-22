import { execSync } from "child_process";
import { writeFileSync, existsSync } from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");
const CONTRACTS_DIR = path.join(ROOT, "contracts");
const WASM_DIR = path.join(CONTRACTS_DIR, "target/wasm32v1-none/release");
const ENV_CONTRACTS_PATH = path.join(ROOT, ".env.contracts");

// Support --network mainnet flag for post-audit mainnet deployment
const NETWORK_ARG = process.argv.find(a => a.startsWith("--network="))?.split("=")[1]
  || process.argv[process.argv.indexOf("--network") + 1];
const NETWORK = (NETWORK_ARG === "mainnet") ? "mainnet" : "testnet";
const SKIP_BUILD = process.argv.includes("--skip-build");
const EXPLORER_NETWORK = NETWORK === "mainnet" ? "public" : "testnet";

if (NETWORK === "mainnet") {
  console.warn("⚠️  MAINNET DEPLOYMENT — Ensure contracts have been audited before proceeding.");
  console.warn("⚠️  Check AUDIT_CHECKLIST.md for required pre-deployment steps.\n");
}

// Ensure stellar CLI and cargo are in PATH
const PATH_ENV = `${process.env.HOME}/.cargo/bin:${process.env.PATH}`;

function run(cmd: string, opts?: { cwd?: string }): string {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, {
    encoding: "utf-8",
    cwd: opts?.cwd || ROOT,
    env: { ...process.env, PATH: PATH_ENV },
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function runInherit(cmd: string, opts?: { cwd?: string }): void {
  console.log(`  $ ${cmd}`);
  execSync(cmd, {
    cwd: opts?.cwd || ROOT,
    env: { ...process.env, PATH: PATH_ENV },
    stdio: "inherit",
  });
}

function extractHash(output: string, contractName: string): string {
  const hashMatch = output.match(/[0-9a-f]{64}/i);
  if (!hashMatch) {
    throw new Error(`Could not parse uploaded hash for ${contractName}: ${output}`);
  }
  return hashMatch[0];
}

function uploadWasm(contractName: string): string {
  const uploadCmd =
    `stellar contract upload --wasm ${WASM_DIR}/${contractName}.wasm ` +
    `--source-account agentnet-admin --network ${NETWORK}`;
  try {
    const out = run(uploadCmd);
    return extractHash(out, contractName);
  } catch (err: any) {
    const msg = err?.stderr?.toString?.() || err?.message || String(err);
    // Some CLI/RPC combinations emit an xdr parsing error even when the upload actually landed.
    if (msg.includes("xdr processing error: xdr value invalid")) {
      const out = run(uploadCmd.replace("stellar contract upload", "stellar --very-verbose contract upload"));
      return extractHash(out, contractName);
    }
    throw err;
  }
}

async function main() {
  console.log(`=== AgentNet Stellar: ${NETWORK} Deployment ===\n`);

  // ── Step 0: Verify stellar CLI ──
  console.log("[0] Verifying stellar CLI...");
  try {
    const version = run("stellar version");
    console.log(`  stellar CLI: ${version}`);
  } catch {
    console.error("stellar CLI not found. Install with: cargo install stellar-cli --locked");
    process.exit(1);
  }

  // ── Step 1: Build WASM contracts ──
  console.log("\n[1] Building WASM contracts...");
  if (SKIP_BUILD) {
    console.log("  --skip-build set, using existing WASM artifacts.");
  } else {
    try {
      // Always rebuild to avoid deploying stale ABI changes.
      runInherit("cargo build --release --target wasm32v1-none", { cwd: CONTRACTS_DIR });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("can't find crate for `core`") || msg.includes("wasm32v1-none")) {
        console.error("  Missing rust target wasm32v1-none.");
        console.error("  Install with: rustup target add wasm32v1-none");
      }
      throw err;
    }
  }

  // Verify all 5 WASM files exist
  for (const name of ["user_vault", "vault_factory", "agent_registry", "reputation_registry", "validation_registry"]) {
    const wasmPath = path.join(WASM_DIR, `${name}.wasm`);
    if (!existsSync(wasmPath)) {
      console.error(`  Missing: ${wasmPath}`);
      process.exit(1);
    }
    console.log(`  Found: ${name}.wasm`);
  }

  // ── Step 2: Generate & fund testnet accounts ──
  console.log("\n[2] Generating testnet accounts...");
  const accounts: Record<string, { public: string; secret: string }> = {};

  for (const name of ["agentnet-admin", "agentnet-facilitator", "agentnet-agent-signer", "agentnet-usdc-issuer"]) {
    try {
      // Try to get existing key first
      const pubkey = run(`stellar keys address ${name}`);
      const secret = run(`stellar keys show ${name}`);
      accounts[name] = { public: pubkey, secret };
      console.log(`  ${name}: ${pubkey} (existing)`);
    } catch {
      // Generate new key and fund
      console.log(`  Generating ${name}...`);
      run(`stellar keys generate ${name} --network ${NETWORK} --fund`);
      const pubkey = run(`stellar keys address ${name}`);
      const secret = run(`stellar keys show ${name}`);
      accounts[name] = { public: pubkey, secret };
      console.log(`  ${name}: ${pubkey} (new, funded)`);
    }
  }

  const admin = accounts["agentnet-admin"];
  const facilitator = accounts["agentnet-facilitator"];
  const agentSigner = accounts["agentnet-agent-signer"];
  const usdcIssuer = accounts["agentnet-usdc-issuer"];

  // ── Step 3: Deploy USDC SAC ──
  console.log("\n[3] Deploying test USDC SAC...");
  let usdcSacAddress: string;
  try {
    const sacOutput = run(
      `stellar contract asset deploy --asset USDC:${usdcIssuer.public} --source-account agentnet-admin --network ${NETWORK}`
    );
    usdcSacAddress = sacOutput;
    console.log(`  USDC SAC: ${usdcSacAddress}`);
  } catch (err: any) {
    // If already deployed, try to get the ID
    const stderr = err.stderr?.toString() || err.message;
    if (stderr.includes("already exists") || stderr.includes("ExistingValue")) {
      console.log("  USDC SAC already deployed, deriving address...");
      usdcSacAddress = run(
        `stellar contract id asset --asset USDC:${usdcIssuer.public} --network ${NETWORK}`
      );
      console.log(`  USDC SAC: ${usdcSacAddress}`);
    } else {
      console.error(`  SAC deploy error: ${stderr}`);
      process.exit(1);
    }
  }

  // ── Step 4: Upload WASM blobs ──
  console.log("\n[4] Uploading WASM blobs...");
  let vaultWasmHash: string;
  let factoryWasmHash: string;
  let registryWasmHash: string;
  let reputationWasmHash: string;
  let validationWasmHash: string;
  try {
    vaultWasmHash = uploadWasm("user_vault");
    factoryWasmHash = uploadWasm("vault_factory");
    registryWasmHash = uploadWasm("agent_registry");
    reputationWasmHash = uploadWasm("reputation_registry");
    validationWasmHash = uploadWasm("validation_registry");
    console.log(`  USER_VAULT_WASM_HASH: ${vaultWasmHash}`);
    console.log(`  VAULT_FACTORY_WASM_HASH: ${factoryWasmHash}`);
    console.log(`  AGENT_REGISTRY_WASM_HASH: ${registryWasmHash}`);
    console.log(`  REPUTATION_REGISTRY_WASM_HASH: ${reputationWasmHash}`);
    console.log(`  VALIDATION_REGISTRY_WASM_HASH: ${validationWasmHash}`);
  } catch (err: any) {
    console.error(`  Upload error: ${err.stderr?.toString() || err.message}`);
    process.exit(1);
  }

  // ── Step 5: Deploy VaultFactory ──
  console.log("\n[5] Deploying VaultFactory...");
  let factoryAddress: string;
  try {
    factoryAddress = run(
      `stellar contract deploy --wasm-hash ${factoryWasmHash} --source-account agentnet-admin --network ${NETWORK}`
    );
    console.log(`  VAULT_FACTORY: ${factoryAddress}`);
  } catch (err: any) {
    console.error(`  Deploy error: ${err.stderr?.toString() || err.message}`);
    process.exit(1);
  }

  // ── Step 6: Deploy AgentRegistry ──
  console.log("\n[6] Deploying AgentRegistry...");
  let registryAddress: string;
  try {
    registryAddress = run(
      `stellar contract deploy --wasm-hash ${registryWasmHash} --source-account agentnet-admin --network ${NETWORK}`
    );
    console.log(`  AGENT_REGISTRY: ${registryAddress}`);
  } catch (err: any) {
    console.error(`  Deploy error: ${err.stderr?.toString() || err.message}`);
    process.exit(1);
  }

  // ── Step 6B: Deploy ReputationRegistry ──
  console.log("\n[6B] Deploying ReputationRegistry...");
  let reputationAddress: string;
  try {
    reputationAddress = run(
      `stellar contract deploy --wasm-hash ${reputationWasmHash} --source-account agentnet-admin --network ${NETWORK}`
    );
    console.log(`  REPUTATION_REGISTRY: ${reputationAddress}`);
  } catch (err: any) {
    console.error(`  Deploy error: ${err.stderr?.toString() || err.message}`);
    process.exit(1);
  }

  // ── Step 6C: Deploy ValidationRegistry ──
  console.log("\n[6C] Deploying ValidationRegistry...");
  let validationAddress: string;
  try {
    validationAddress = run(
      `stellar contract deploy --wasm-hash ${validationWasmHash} --source-account agentnet-admin --network ${NETWORK}`
    );
    console.log(`  VALIDATION_REGISTRY: ${validationAddress}`);
  } catch (err: any) {
    console.error(`  Deploy error: ${err.stderr?.toString() || err.message}`);
    process.exit(1);
  }

  // ── Step 7: Initialize VaultFactory ──
  console.log("\n[7] Initializing VaultFactory...");
  try {
    run(
      `stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin --network ${NETWORK} -- initialize --admin ${admin.public} --vault_wasm_hash ${vaultWasmHash} --usdc_token ${usdcSacAddress}`
    );
    console.log("  VaultFactory initialized.");
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message;
    if (stderr.includes("AlreadyInitialized") || stderr.includes("Error(Contract, #1)")) {
      console.log("  VaultFactory already initialized, skipping.");
    } else {
      console.error(`  Init error: ${stderr}`);
      process.exit(1);
    }
  }

  // ── Step 8: Initialize AgentRegistry ──
  console.log("\n[8] Initializing AgentRegistry...");
  try {
    run(
      `stellar contract invoke --id ${registryAddress} --source-account agentnet-admin --network ${NETWORK} -- initialize --admin ${admin.public}`
    );
    console.log("  AgentRegistry initialized.");
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message;
    if (stderr.includes("AlreadyInitialized") || stderr.includes("Error(Contract, #1)")) {
      console.log("  AgentRegistry already initialized, skipping.");
    } else {
      console.error(`  Init error: ${stderr}`);
      process.exit(1);
    }
  }

  // ── Step 8B: Initialize ReputationRegistry ──
  console.log("\n[8B] Initializing ReputationRegistry...");
  try {
    run(
      `stellar contract invoke --id ${reputationAddress} --source-account agentnet-admin --network ${NETWORK} -- initialize --admin ${admin.public}`
    );
    console.log("  ReputationRegistry initialized.");
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message;
    if (stderr.includes("AlreadyInitialized") || stderr.includes("Error(Contract, #1)")) {
      console.log("  ReputationRegistry already initialized, skipping.");
    } else {
      console.error(`  Init error: ${stderr}`);
      process.exit(1);
    }
  }

  // ── Step 8C: Initialize ValidationRegistry ──
  console.log("\n[8C] Initializing ValidationRegistry...");
  try {
    run(
      `stellar contract invoke --id ${validationAddress} --source-account agentnet-admin --network ${NETWORK} -- initialize --admin ${admin.public}`
    );
    console.log("  ValidationRegistry initialized.");
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message;
    if (stderr.includes("AlreadyInitialized") || stderr.includes("Error(Contract, #1)")) {
      console.log("  ValidationRegistry already initialized, skipping.");
    } else {
      console.error(`  Init error: ${stderr}`);
      process.exit(1);
    }
  }

  // ── Step 9: Verify deployments ──
  console.log("\n[9] Verifying deployments...");
  try {
    const vaultCount = run(
      `stellar contract invoke --id ${factoryAddress} --source-account agentnet-admin --network ${NETWORK} -- vault_count`
    );
    console.log(`  VaultFactory.vault_count() = ${vaultCount}`);
  } catch (err: any) {
    console.warn(`  Could not verify VaultFactory: ${err.message}`);
  }

  try {
    const agentCount = run(
      `stellar contract invoke --id ${registryAddress} --source-account agentnet-admin --network ${NETWORK} -- active_count`
    );
    console.log(`  AgentRegistry.active_count() = ${agentCount}`);
  } catch (err: any) {
    console.warn(`  Could not verify AgentRegistry: ${err.message}`);
  }

  // ── Step 10: Write .env.contracts ──
  console.log("\n[10] Writing .env.contracts...");
  const envContent = `# AgentNet Contract Deployment — ${new Date().toISOString()}
# Network: Stellar ${NETWORK}

# ── Contract Addresses ──
VAULT_FACTORY_ADDRESS=${factoryAddress}
AGENT_REGISTRY_ADDRESS=${registryAddress}
REPUTATION_REGISTRY_ADDRESS=${reputationAddress}
VALIDATION_REGISTRY_ADDRESS=${validationAddress}
USDC_SAC_ADDRESS=${usdcSacAddress}
VAULT_WASM_HASH=${vaultWasmHash}

# ── Keypairs ──
ADMIN_SECRET_KEY=${admin.secret}
FACILITATOR_SECRET_KEY=${facilitator.secret}
AGENT_SIGNER_SECRET_KEY=${agentSigner.secret}

# ── Public Keys (for reference) ──
ADMIN_PUBLIC_KEY=${admin.public}
FACILITATOR_PUBLIC_KEY=${facilitator.public}
AGENT_SIGNER_PUBLIC_KEY=${agentSigner.public}
USDC_ISSUER_PUBLIC_KEY=${usdcIssuer.public}
`;

  writeFileSync(ENV_CONTRACTS_PATH, envContent);
  console.log(`  Written to ${ENV_CONTRACTS_PATH}`);

  // Also write frontend env vars
  const frontendEnvPath = path.join(ROOT, "apps/web/.env.local");
  const frontendEnv = `# Auto-generated from deploy-contracts.ts
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_VAULT_FACTORY_ADDRESS=${factoryAddress}
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=${registryAddress}
NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS=${reputationAddress}
NEXT_PUBLIC_VALIDATION_REGISTRY_ADDRESS=${validationAddress}
NEXT_PUBLIC_USDC_SAC_ADDRESS=${usdcSacAddress}
`;
  writeFileSync(frontendEnvPath, frontendEnv);
  console.log(`  Written to ${frontendEnvPath}`);

  console.log("\n=== Deployment Complete ===");
  console.log(`\nView contracts on Stellar Expert:`);
  console.log(`  Factory:    https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${factoryAddress}`);
  console.log(`  Registry:   https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${registryAddress}`);
  console.log(`  Reputation: https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${reputationAddress}`);
  console.log(`  Validation: https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${validationAddress}`);
  console.log(`  USDC SAC:   https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${usdcSacAddress}`);
}

main().catch((err) => {
  console.error("\nDeployment failed:", err.message);
  process.exit(1);
});
