import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");
const ENV_CONTRACTS_PATH = path.join(ROOT, ".env.contracts");
const ENV_PATH = path.join(ROOT, ".env");
const NETWORK = "testnet";
const PATH_ENV = `${process.env.HOME}/.cargo/bin:${process.env.PATH}`;

function run(cmd: string): string {
  const normalizedCmd = cmd.startsWith("stellar ")
    ? cmd.replace(/^stellar\s+/, "stellar --no-cache ")
    : cmd;
  console.log(`  $ ${normalizedCmd}`);
  return execSync(normalizedCmd, {
    encoding: "utf-8",
    env: { ...process.env, PATH: PATH_ENV },
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function formatErr(err: any): string {
  return err?.stderr?.toString?.().trim() || err?.message || String(err);
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const envContent = readFileSync(filePath, "utf-8");
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

function loadEnvContracts(): Record<string, string> {
  const fromContracts = parseEnvFile(ENV_CONTRACTS_PATH);
  const fromDotEnv = parseEnvFile(ENV_PATH);

  const merged: Record<string, string> = {
    ...fromDotEnv,
    ...fromContracts,
  };

  // explicit process env should win
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string" && v.length > 0) {
      merged[k] = v;
    }
  }

  return merged;
}

function ensureKey(name: string): string {
  try {
    return run(`stellar keys address ${name}`);
  } catch {
    run(`stellar keys generate ${name} --network ${NETWORK} --fund`);
    return run(`stellar keys address ${name}`);
  }
}

function parseNumber(raw: string): number {
  const match = raw.match(/-?\d+/);
  if (!match) throw new Error(`Cannot parse number from output: ${raw}`);
  return parseInt(match[0], 10);
}

function assertIncludes(output: string, expected: string, label: string) {
  if (!output.includes(expected)) {
    throw new Error(`${label} failed. Expected output to include "${expected}", got: ${output}`);
  }
}

function sep(title: string) {
  console.log(`\n${"=".repeat(66)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(66));
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function settleLedger() {
  // Testnet closes ledgers roughly every 5s; wait slightly above that between writes and reads.
  await sleep(8000);
}

async function runWrite(cmd: string, label: string, retries = 5): Promise<string> {
  for (let i = 0; i < retries; i += 1) {
    try {
      return run(cmd);
    } catch (err: any) {
      const msg = formatErr(err);
      // On testnet, submission can time out even when the tx eventually lands.
      if (msg.includes("transaction submission timeout")) {
        console.warn(`  ! ${label}: submission timed out, continuing and verifying via read checks...`);
        return "";
      }
      // Retry transient sequence/state race conditions after waiting one ledger close.
      if (
        (msg.includes("TxBadSeq") ||
          msg.includes("Error(Contract, #3)") ||
          msg.includes("Error(Contract, #5)")) &&
        i + 1 < retries
      ) {
        console.warn(`  ! ${label}: transient chain state race, retrying after ledger close...`);
        await settleLedger();
        continue;
      }
      throw err;
    }
  }
  return "";
}

async function runEventually(
  cmd: string,
  predicate: (out: string) => boolean,
  label: string,
  attempts = 15,
  delayMs = 2000
): Promise<string> {
  let lastOut = "";
  for (let i = 0; i < attempts; i += 1) {
    try {
      lastOut = run(cmd);
      if (predicate(lastOut)) {
        return lastOut;
      }
    } catch (err: any) {
      lastOut = formatErr(err);
    }
    await sleep(delayMs);
  }
  throw new Error(`${label} did not reach expected state. Last output: ${lastOut}`);
}

async function main() {
  sep("AgentRegistry Testnet Function Smoke Test");

  const env = loadEnvContracts();
  const cliRegistryArgIndex = process.argv.findIndex(a => a === "--registry");
  const cliRegistry =
    cliRegistryArgIndex !== -1 && process.argv[cliRegistryArgIndex + 1]
      ? process.argv[cliRegistryArgIndex + 1]
      : "";
  const registryAddress = cliRegistry || env.AGENT_REGISTRY_ADDRESS || "";
  if (!registryAddress) {
    throw new Error(
      "AGENT_REGISTRY_ADDRESS is missing. Set it in .env/.env.contracts or pass --registry <contract_id>."
    );
  }

  console.log(`Registry: ${registryAddress}`);

  const ownerKey = "agentnet-reg-owner";
  const recipientKey = "agentnet-reg-recipient";
  const operatorKey = "agentnet-reg-operator";

  const owner = ensureKey(ownerKey);
  const recipient = ensureKey(recipientKey);
  const operator = ensureKey(operatorKey);

  console.log(`Owner:     ${owner}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Operator:  ${operator}`);

  const now = Date.now();
  const handleA = `smoke-a-${now}`;
  const handleANew = `smoke-a-new-${now}`;
  const uriA = `https://agentnet.test/registry-smoke/${now}/a-v020`;
  const uriANew = `https://agentnet.test/registry-smoke/${now}/a-v030`;

  sep("1) Mint identities");
  let mintAOut = "";
  try {
    mintAOut = run(
      `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- mint_identity --owner ${owner} --name 'Registry Smoke A' --handle '${handleA}' --agent_uri '${uriA}' --vault_address ${owner} --agent_signer ${owner}`
    );
  } catch (err: any) {
    const msg = formatErr(err);
    if (msg.includes("unrecognized subcommand 'mint_identity'")) {
      throw new Error(
        [
          "Deployed AGENT_REGISTRY_ADDRESS is still on the legacy ABI (no mint_identity).",
          "Redeploy the updated contracts first, then rerun this script.",
          "Expected method set: mint_identity, owner_of, balance_of, transfer_from, set_handle, list_tokens_by_owner, active_count.",
        ].join(" ")
      );
    }
    throw err;
  }
  const tokenA = parseNumber(mintAOut);
  console.log(`  tokenA: ${tokenA}`);
  await settleLedger();

  sep("2) Read core ownership/token views");
  const ownerOfA1 = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- owner_of --token_id ${tokenA}`,
    (out) => out.includes(owner),
    "owner_of(tokenA)"
  );
  assertIncludes(ownerOfA1, owner, "owner_of(tokenA)");

  const balOwner1 = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- balance_of --owner ${owner}`
  );
  console.log(`  balance(owner)=${balOwner1}`);

  const uriAOut = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- token_uri --token_id ${tokenA}`,
    (out) => out.includes("registry-smoke"),
    "token_uri(tokenA)"
  );
  assertIncludes(uriAOut, "registry-smoke", "token_uri(tokenA)");

  const byHandleA = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- get_agent_by_handle --handle '${handleA}'`,
    (out) => out.includes(`${tokenA}`),
    "get_agent_by_handle(handleA)"
  );
  assertIncludes(byHandleA, `${tokenA}`, "get_agent_by_handle(handleA)");

  sep("3) Token approvals");
  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- approve --owner ${owner} --to ${operator} --token_id ${tokenA}`
  , "approve");
  await settleLedger();

  const approvedOut = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- get_approved --token_id ${tokenA}`,
    (out) => out.includes(operator),
    "get_approved(tokenA)"
  );
  assertIncludes(approvedOut, operator, "get_approved(tokenA)");

  sep("4) Operator approval-for-all");
  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- set_approval_for_all --owner ${owner} --operator ${operator} --approved true`
  , "set_approval_for_all");
  await settleLedger();
  const isForAll = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- is_approved_for_all --owner ${owner} --operator ${operator}`,
    (out) => out.toLowerCase().includes("true"),
    "is_approved_for_all"
  );
  assertIncludes(isForAll.toLowerCase(), "true", "is_approved_for_all");

  sep("5) Update profile fields");
  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- set_agent_uri --caller ${owner} --token_id ${tokenA} --new_uri '${uriANew}'`
  , "set_agent_uri");
  await settleLedger();
  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- set_handle --caller ${owner} --token_id ${tokenA} --new_handle '${handleANew}'`
  , "set_handle");
  await settleLedger();
  const updatedHandleOut = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- get_agent_by_handle --handle '${handleANew}'`,
    (out) => out.includes(`${tokenA}`),
    "get_agent_by_handle(new handle)"
  );
  assertIncludes(updatedHandleOut, `${tokenA}`, "get_agent_by_handle(new handle)");

  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- set_metadata --caller ${owner} --token_id ${tokenA} --key 'model' --value 'claude-sonnet-4-5'`
  , "set_metadata");
  await settleLedger();
  const metadataOut = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- get_metadata --token_id ${tokenA} --key 'model'`,
    (out) => out.includes("claude-sonnet-4-5"),
    "get_metadata"
  );
  assertIncludes(metadataOut, "claude-sonnet-4-5", "get_metadata");

  sep("6) Activation lifecycle");
  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- deactivate --caller ${owner} --token_id ${tokenA}`
  , "deactivate");
  await settleLedger();
  const activeAfterDeactivate = parseNumber(
    run(`stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- active_count`)
  );
  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- reactivate --caller ${owner} --token_id ${tokenA}`
  , "reactivate");
  await settleLedger();
  const activeAfterReactivate = parseNumber(
    run(`stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- active_count`)
  );
  if (activeAfterReactivate < activeAfterDeactivate) {
    throw new Error("active_count regression after reactivate");
  }

  sep("7) Enumeration and counters");
  const ownerTokens = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- list_tokens_by_owner --owner ${owner} --offset 0 --limit 20`,
    (out) => out.includes(`${tokenA}`),
    "list_tokens_by_owner(owner)"
  );
  assertIncludes(ownerTokens, `${tokenA}`, "list_tokens_by_owner(owner)");

  const activeAgents = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- list_agents --start_token_id 1 --limit 20`
  );
  assertIncludes(activeAgents, "token_id", "list_agents");

  const totalSupply = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- total_supply`
  );
  const activeCount = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- active_count`
  );
  const nextTokenId = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- next_token_id`
  );
  console.log(`  total_supply=${totalSupply}`);
  console.log(`  active_count=${activeCount}`);
  console.log(`  next_token_id=${nextTokenId}`);

  const oldHandleAvailable = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- is_handle_available --handle '${handleA}'`,
    (out) => out.toLowerCase().includes("true"),
    "is_handle_available(old handle)"
  );
  const newHandleAvailable = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${ownerKey} --network ${NETWORK} -- is_handle_available --handle '${handleANew}'`,
    (out) => out.toLowerCase().includes("false"),
    "is_handle_available(new handle)"
  );
  assertIncludes(oldHandleAvailable.toLowerCase(), "true", "is_handle_available(old handle)");
  assertIncludes(newHandleAvailable.toLowerCase(), "false", "is_handle_available(new handle)");

  sep("Result");
  console.log("All AgentRegistry function smoke checks passed on testnet.");
  console.log(`Registry Explorer: https://stellar.expert/explorer/testnet/contract/${registryAddress}`);
}

main().catch((err: any) => {
  console.error("\nAgent registry smoke test failed:", err.message || err);
  process.exit(1);
});
