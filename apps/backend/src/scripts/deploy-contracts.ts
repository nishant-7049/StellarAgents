import { createHash } from "crypto";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig(); // load apps/backend/.env

const ROOT = path.resolve(process.cwd(), "../..");
const CONTRACTS_DIR = path.join(ROOT, "contracts");
const WASM_DIR = path.join(CONTRACTS_DIR, "target/wasm32v1-none/release");
const ENV_CONTRACTS_PATH = path.join(ROOT, ".env.contracts");

const CIRCLE_USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const NETWORK_ARG = process.argv.find((a) => a.startsWith("--network="))?.split("=")[1]
  || process.argv[process.argv.indexOf("--network") + 1];
const NETWORK = NETWORK_ARG === "mainnet" ? "mainnet" : "testnet";
const SKIP_BUILD = process.argv.includes("--skip-build");
const EXPLORER_NETWORK = NETWORK === "mainnet" ? "public" : "testnet";

const deployerAliasFromFlag = (() => {
  const idx = process.argv.findIndex((a) => a === "--deployer-key");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return "";
})();
const DEPLOYER_ALIAS = deployerAliasFromFlag || process.env.AGENTNET_DEPLOYER_ALIAS || "agentnet-admin";

const MAINNET_SINGLE_KEY = process.env.MAINNET_SINGLE_KEY !== "false";
const PATH_ENV = `${process.env.HOME}/.cargo/bin:${process.env.PATH}`;
const MAINNET_PASSPHRASE_REF = process.env.STELLAR_MAINNET_NETWORK_PASSPHRASE || "";
const TESTNET_PASSPHRASE_REF = process.env.STELLAR_TESTNET_NETWORK_PASSPHRASE || "";
// Mainnet: soroban.stellar.org often returns 301 redirect; CLI does not follow it. Use a direct RPC.
const NETWORK_RPC_URL = NETWORK === "mainnet"
  ? (process.env.STELLAR_MAINNET_RPC_URL || "https://rpc.lightsail.network")
  : (process.env.STELLAR_TESTNET_RPC_URL || "https://soroban-testnet.stellar.org");
const NETWORK_PASSPHRASE = NETWORK === "mainnet"
  ? (process.env.STELLAR_MAINNET_NETWORK_PASSPHRASE || process.env.STELLAR_NETWORK_PASSPHRASE || "")
  : (process.env.STELLAR_TESTNET_NETWORK_PASSPHRASE || process.env.STELLAR_NETWORK_PASSPHRASE || "");
const NETWORK_CLI_ARGS = NETWORK_PASSPHRASE
  ? `--rpc-url ${NETWORK_RPC_URL} --network-passphrase "${NETWORK_PASSPHRASE}"`
  : `--rpc-url ${NETWORK_RPC_URL} --network ${NETWORK}`;

if (NETWORK === "mainnet") {
  console.warn("⚠️  MAINNET DEPLOYMENT — Ensure contracts have been audited before proceeding.");
  console.warn("⚠️  Using Circle USDC issuer by default and existing funded keys only.");
  console.warn("⚠️  Check AUDIT_CHECKLIST.md for required pre-deployment steps.\n");
}

function run(cmd: string, opts?: { cwd?: string }): string {
  console.log(`  $ ${cmd}`);
  const childEnv: NodeJS.ProcessEnv = { ...process.env, PATH: PATH_ENV };
  delete childEnv.STELLAR_RPC_URL;
  delete childEnv.STELLAR_RPC_HEADERS;
  delete childEnv.STELLAR_NETWORK;
  delete childEnv.STELLAR_NETWORK_PASSPHRASE;

  return execSync(cmd, {
    encoding: "utf-8",
    cwd: opts?.cwd || ROOT,
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function runInherit(cmd: string, opts?: { cwd?: string }): void {
  console.log(`  $ ${cmd}`);
  const childEnv: NodeJS.ProcessEnv = { ...process.env, PATH: PATH_ENV };
  delete childEnv.STELLAR_RPC_URL;
  delete childEnv.STELLAR_RPC_HEADERS;
  delete childEnv.STELLAR_NETWORK;
  delete childEnv.STELLAR_NETWORK_PASSPHRASE;

  execSync(cmd, {
    cwd: opts?.cwd || ROOT,
    env: childEnv,
    stdio: "inherit",
  });
}

function parseError(err: any): string {
  return err?.stderr?.toString?.().trim() || err?.message || String(err);
}

function extractHash(output: string, label: string): string {
  const hashMatch = output.match(/[0-9a-f]{64}/i);
  if (!hashMatch) {
    throw new Error(`Could not parse hash for ${label}: ${output}`);
  }
  return hashMatch[0].toLowerCase();
}

function fileSha256(filePath: string): string {
  const bytes = readFileSync(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

function assertExpectedVaultHash(vaultWasmPath: string) {
  if (NETWORK !== "mainnet") return;
  const expected = (process.env.AUDITED_VAULT_WASM_HASH || "").trim().toLowerCase();
  const local = fileSha256(vaultWasmPath);
  console.log(`  local user_vault.wasm sha256: ${local}`);

  if (!expected) {
    console.warn("  ! AUDITED_VAULT_WASM_HASH not set; continuing without audit hash enforcement.");
    return;
  }

  if (expected !== local) {
    throw new Error(
      `Audited vault hash mismatch. expected=${expected}, local=${local}. Refusing mainnet deployment.`
    );
  }
  console.log("  Audited vault hash matched.");
}

function uploadWasm(contractName: string, sourceAlias: string): string {
  const uploadCmd =
    `stellar contract upload --wasm ${WASM_DIR}/${contractName}.optimized.wasm ` +
    `--source-account ${sourceAlias} ${NETWORK_CLI_ARGS}`;

  try {
    const out = run(uploadCmd);
    return extractHash(out, contractName);
  } catch (err: any) {
    const msg = parseError(err);
    if (msg.includes("xdr processing error: xdr value invalid")) {
      const verbose = run(uploadCmd.replace("stellar contract upload", "stellar --very-verbose contract upload"));
      return extractHash(verbose, contractName);
    }
    throw err;
  }
}

function getConfiguredWasmHash(envKey: string): string {
  const value = (process.env[envKey] || "").trim().toLowerCase();
  if (!value) return "";
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`Invalid ${envKey}: expected 64-char hex hash`);
  }
  return value;
}

function resolveWasmHash(contractName: string, sourceAlias: string, envKey: string): string {
  const configured = getConfiguredWasmHash(envKey);
  if (configured) {
    console.log(`  ${contractName}.wasm hash from env ${envKey}: ${configured}`);
    return configured;
  }
  return uploadWasm(contractName, sourceAlias);
}

function ensureExistingKey(alias: string): { public: string; secret: string } {
  try {
    const pubkey = run(`stellar keys address ${alias}`);
    const secret = run(`stellar keys show ${alias}`);
    return { public: pubkey, secret };
  } catch {
    throw new Error(
      `Missing key alias '${alias}'. Create/import it first (mainnet keys are not auto-generated).`
    );
  }
}

function ensureTestnetKey(alias: string): { public: string; secret: string } {
  try {
    const pubkey = run(`stellar keys address ${alias}`);
    const secret = run(`stellar keys show ${alias}`);
    console.log(`  ${alias}: ${pubkey} (existing)`);
    return { public: pubkey, secret };
  } catch {
    run(`stellar keys generate ${alias} --network testnet --fund`);
    const pubkey = run(`stellar keys address ${alias}`);
    const secret = run(`stellar keys show ${alias}`);
    console.log(`  ${alias}: ${pubkey} (new, funded)`);
    return { public: pubkey, secret };
  }
}

function resolveOrDeployUsdcSac(sourceAlias: string, issuer: string): string {
  const configuredUsdcSac = (process.env.USDC_SAC_ADDRESS || "").trim();
  if (configuredUsdcSac) {
    console.log(`  USDC SAC from env: ${configuredUsdcSac}`);
    return configuredUsdcSac;
  }

  const asset = `USDC:${issuer}`;

  // Mainnet should not submit a deploy transaction for Circle USDC SAC.
  if (NETWORK === "mainnet") {
    try {
      const id = run(`stellar contract id asset --asset ${asset} ${NETWORK_CLI_ARGS}`);
      console.log(`  USDC SAC resolved: ${id}`);
      return id;
    } catch (err: any) {
      const msg = parseError(err);
      throw new Error(`Could not resolve mainnet USDC SAC id for ${asset}: ${msg}`);
    }
  }

  try {
    const out = run(
      `stellar contract asset deploy --asset ${asset} --source-account ${sourceAlias} ${NETWORK_CLI_ARGS}`
    );
    console.log(`  USDC SAC deployed: ${out}`);
    return out;
  } catch (err: any) {
    const msg = parseError(err);
    if (msg.includes("already exists") || msg.includes("ExistingValue")) {
      const id = run(`stellar contract id asset --asset ${asset} ${NETWORK_CLI_ARGS}`);
      console.log(`  USDC SAC existing: ${id}`);
      return id;
    }
    throw new Error(`Could not resolve/deploy USDC SAC for ${asset}: ${msg}`);
  }
}

async function main() {
  console.log(`=== AgentNet Stellar: ${NETWORK} Deployment ===\n`);

  console.log("[0] Verifying toolchain...");
  try {
    const version = run("stellar version");
    console.log(`  stellar CLI: ${version}`);
  } catch {
    console.error("stellar CLI not found. Install with: cargo install stellar-cli --locked");
    process.exit(1);
  }

  console.log("\n[1] Building WASM contracts...");
  if (SKIP_BUILD) {
    console.log("  --skip-build set, using existing artifacts.");
  } else {
    runInherit("cargo build --release --target wasm32v1-none", { cwd: CONTRACTS_DIR });
  }

  const contractNames = ["user_vault", "vault_factory", "agent_registry", "reputation_registry", "validation_registry"];
  for (const name of contractNames) {
    const wasmPath = path.join(WASM_DIR, `${name}.optimized.wasm`);
    if (!existsSync(wasmPath)) {
      throw new Error(`Missing WASM artifact: ${wasmPath}`);
    }
    console.log(`  Found: ${name}.optimized.wasm`);
  }
  assertExpectedVaultHash(path.join(WASM_DIR, "user_vault.optimized.wasm"));

  console.log("\n[2] Resolving key aliases...");
  const accounts: Record<string, { public: string; secret: string }> = {};

  if (NETWORK === "mainnet") {
    const deployer = ensureExistingKey(DEPLOYER_ALIAS);
    accounts["agentnet-admin"] = deployer;

    if (MAINNET_SINGLE_KEY) {
      accounts["agentnet-facilitator"] = deployer;
      accounts["agentnet-agent-signer"] = deployer;
      console.log(`  single-key mainnet mode enabled (alias '${DEPLOYER_ALIAS}' used for admin/facilitator/agent-signer)`);
    } else {
      accounts["agentnet-facilitator"] = ensureExistingKey("agentnet-facilitator");
      accounts["agentnet-agent-signer"] = ensureExistingKey("agentnet-agent-signer");
      console.log("  multi-key mainnet mode enabled.");
    }

    console.log(`  deployer alias: ${DEPLOYER_ALIAS}`);
    console.log(`  admin pubkey:   ${accounts["agentnet-admin"].public}`);
    console.log(`  facilitator:    ${accounts["agentnet-facilitator"].public}`);
    console.log(`  agent signer:   ${accounts["agentnet-agent-signer"].public}`);
  } else {
    for (const name of ["agentnet-admin", "agentnet-facilitator", "agentnet-agent-signer", "agentnet-usdc-issuer"]) {
      accounts[name] = ensureTestnetKey(name);
    }
  }

  const admin = accounts["agentnet-admin"];
  const facilitator = accounts["agentnet-facilitator"];
  const agentSigner = accounts["agentnet-agent-signer"];

  const usdcIssuer = NETWORK === "mainnet"
    ? CIRCLE_USDC_ISSUER
    : accounts["agentnet-usdc-issuer"].public;

  if (NETWORK === "mainnet") {
    const configuredPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || "";
    if (!configuredPassphrase) {
      throw new Error("Missing STELLAR_NETWORK_PASSPHRASE for mainnet deployment.");
    }
    if (MAINNET_PASSPHRASE_REF && configuredPassphrase !== MAINNET_PASSPHRASE_REF) {
      throw new Error(
        "STELLAR_NETWORK_PASSPHRASE mismatch for mainnet. " +
        "Set STELLAR_MAINNET_NETWORK_PASSPHRASE to the expected value and retry."
      );
    }
  } else {
    const configuredPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || "";
    if (TESTNET_PASSPHRASE_REF && configuredPassphrase && configuredPassphrase !== TESTNET_PASSPHRASE_REF) {
      console.warn("  ! STELLAR_NETWORK_PASSPHRASE differs from STELLAR_TESTNET_NETWORK_PASSPHRASE.");
    }
  }

  console.log("\n[3] Resolving USDC SAC...");
  console.log(`  asset issuer: ${usdcIssuer}`);
  const usdcSacAddress = resolveOrDeployUsdcSac(DEPLOYER_ALIAS, usdcIssuer);

  console.log("\n[4] Uploading WASM blobs...");
  const vaultWasmHash = resolveWasmHash("user_vault", DEPLOYER_ALIAS, "USER_VAULT_WASM_HASH");
  const factoryWasmHash = resolveWasmHash("vault_factory", DEPLOYER_ALIAS, "VAULT_FACTORY_WASM_HASH");
  const registryWasmHash = resolveWasmHash("agent_registry", DEPLOYER_ALIAS, "AGENT_REGISTRY_WASM_HASH");
  const reputationWasmHash = resolveWasmHash("reputation_registry", DEPLOYER_ALIAS, "REPUTATION_REGISTRY_WASM_HASH");
  const validationWasmHash = resolveWasmHash("validation_registry", DEPLOYER_ALIAS, "VALIDATION_REGISTRY_WASM_HASH");

  console.log(`  USER_VAULT_WASM_HASH: ${vaultWasmHash}`);
  console.log(`  VAULT_FACTORY_WASM_HASH: ${factoryWasmHash}`);
  console.log(`  AGENT_REGISTRY_WASM_HASH: ${registryWasmHash}`);
  console.log(`  REPUTATION_REGISTRY_WASM_HASH: ${reputationWasmHash}`);
  console.log(`  VALIDATION_REGISTRY_WASM_HASH: ${validationWasmHash}`);

  console.log("\n[5] Deploying contracts...");
  const factoryAddress = run(
    `stellar contract deploy --wasm-hash ${factoryWasmHash} --source-account ${DEPLOYER_ALIAS} ${NETWORK_CLI_ARGS}`
  );
  const registryAddress = run(
    `stellar contract deploy --wasm-hash ${registryWasmHash} --source-account ${DEPLOYER_ALIAS} ${NETWORK_CLI_ARGS}`
  );
  const reputationAddress = run(
    `stellar contract deploy --wasm-hash ${reputationWasmHash} --source-account ${DEPLOYER_ALIAS} ${NETWORK_CLI_ARGS}`
  );
  const validationAddress = run(
    `stellar contract deploy --wasm-hash ${validationWasmHash} --source-account ${DEPLOYER_ALIAS} ${NETWORK_CLI_ARGS}`
  );

  console.log(`  VAULT_FACTORY: ${factoryAddress}`);
  console.log(`  AGENT_REGISTRY: ${registryAddress}`);
  console.log(`  REPUTATION_REGISTRY: ${reputationAddress}`);
  console.log(`  VALIDATION_REGISTRY: ${validationAddress}`);

  console.log("\n[6] Initializing contracts...");
  const initCommands = [
    `stellar contract invoke --id ${factoryAddress} --source-account ${DEPLOYER_ALIAS} ${NETWORK_CLI_ARGS} -- initialize --admin ${admin.public} --vault_wasm_hash ${vaultWasmHash} --usdc_token ${usdcSacAddress}`,
    `stellar contract invoke --id ${registryAddress} --source-account ${DEPLOYER_ALIAS} ${NETWORK_CLI_ARGS} -- initialize --admin ${admin.public}`,
    `stellar contract invoke --id ${reputationAddress} --source-account ${DEPLOYER_ALIAS} ${NETWORK_CLI_ARGS} -- initialize --admin ${admin.public}`,
    `stellar contract invoke --id ${validationAddress} --source-account ${DEPLOYER_ALIAS} ${NETWORK_CLI_ARGS} -- initialize --admin ${admin.public}`,
  ];

  for (const cmd of initCommands) {
    try {
      run(cmd);
    } catch (err: any) {
      const stderr = parseError(err);
      if (stderr.includes("AlreadyInitialized") || stderr.includes("Error(Contract, #1)")) {
        console.log("  Already initialized, skipping one init call.");
      } else {
        throw new Error(`Initialization failed: ${stderr}`);
      }
    }
  }

  console.log("\n[7] Verifying reads...");
  try {
    const vaultCount = run(
      `stellar contract invoke --id ${factoryAddress} --source-account ${DEPLOYER_ALIAS} ${NETWORK_CLI_ARGS} -- vault_count`
    );
    console.log(`  VaultFactory.vault_count() = ${vaultCount}`);
  } catch (err: any) {
    console.warn(`  Could not verify vault_count: ${parseError(err)}`);
  }

  try {
    const activeCount = run(
      `stellar contract invoke --id ${registryAddress} --source-account ${DEPLOYER_ALIAS} ${NETWORK_CLI_ARGS} -- active_count`
    );
    console.log(`  AgentRegistry.active_count() = ${activeCount}`);
  } catch (err: any) {
    console.warn(`  Could not verify active_count: ${parseError(err)}`);
  }

  console.log("\n[8] Writing deployment env files...");
  const envContent = `# AgentNet Contract Deployment — ${new Date().toISOString()}
# Network: Stellar ${NETWORK}

# ── Contract Addresses ──
VAULT_FACTORY_ADDRESS=${factoryAddress}
AGENT_REGISTRY_ADDRESS=${registryAddress}
REPUTATION_REGISTRY_ADDRESS=${reputationAddress}
VALIDATION_REGISTRY_ADDRESS=${validationAddress}
USDC_SAC_ADDRESS=${usdcSacAddress}
VAULT_WASM_HASH=${vaultWasmHash}

# ── Mainnet Asset Source ──
USDC_ASSET_CODE=USDC
USDC_ISSUER_PUBLIC_KEY=${usdcIssuer}

# ── Key Alias ──
DEPLOYER_KEY_ALIAS=${DEPLOYER_ALIAS}
MAINNET_SINGLE_KEY=${MAINNET_SINGLE_KEY}

# ── Keypairs ──
ADMIN_SECRET_KEY=${admin.secret}
FACILITATOR_SECRET_KEY=${facilitator.secret}
AGENT_SIGNER_SECRET_KEY=${agentSigner.secret}

# ── Public Keys (for reference) ──
ADMIN_PUBLIC_KEY=${admin.public}
FACILITATOR_PUBLIC_KEY=${facilitator.public}
AGENT_SIGNER_PUBLIC_KEY=${agentSigner.public}
`;

  writeFileSync(ENV_CONTRACTS_PATH, envContent);
  console.log(`  Written: ${ENV_CONTRACTS_PATH}`);

  const frontendEnvPath = path.join(ROOT, "apps/web/.env.local");
  const frontendEnv = `# Auto-generated from deploy-contracts.ts
NEXT_PUBLIC_BACKEND_URL=${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"}
NEXT_PUBLIC_STELLAR_NETWORK=${NETWORK}
NEXT_PUBLIC_VAULT_FACTORY_ADDRESS=${factoryAddress}
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=${registryAddress}
NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS=${reputationAddress}
NEXT_PUBLIC_VALIDATION_REGISTRY_ADDRESS=${validationAddress}
NEXT_PUBLIC_USDC_SAC_ADDRESS=${usdcSacAddress}
`;
  writeFileSync(frontendEnvPath, frontendEnv);
  console.log(`  Written: ${frontendEnvPath}`);

  console.log("\n=== Deployment Complete ===");
  console.log(`  Factory:    https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${factoryAddress}`);
  console.log(`  Registry:   https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${registryAddress}`);
  console.log(`  Reputation: https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${reputationAddress}`);
  console.log(`  Validation: https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${validationAddress}`);
  console.log(`  USDC SAC:   https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${usdcSacAddress}`);
}

main().catch((err: any) => {
  console.error("\nDeployment failed:", err?.message || err);
  process.exit(1);
});
