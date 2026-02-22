import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");
const ENV_CONTRACTS_PATH = path.join(ROOT, ".env.contracts");
const ENV_PATH = path.join(ROOT, ".env");
const NETWORK = "testnet";
const PATH_ENV = `${process.env.HOME}/.cargo/bin:${process.env.PATH}`;

const MAX_RETRIES = 6;
const LEDGER_SETTLE_MS = 8000;

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
  const result: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    result[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return result;
}

function loadEnv(): Record<string, string> {
  const fromContracts = parseEnvFile(ENV_CONTRACTS_PATH);
  const fromDotEnv = parseEnvFile(ENV_PATH);
  const merged = { ...fromDotEnv, ...fromContracts };
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string" && v.length > 0) merged[k] = v;
  }
  return merged;
}

function parseCliArg(name: string): string {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return "";
}

function requireValue(label: string, value: string): string {
  if (!value) {
    throw new Error(`${label} is missing. Provide via .env/.env.contracts or --${label.toLowerCase()}.`);
  }
  return value;
}

function ensureKey(alias: string): string {
  try {
    return run(`stellar keys address ${alias}`);
  } catch {
    run(`stellar keys generate ${alias} --network ${NETWORK} --fund`);
    return run(`stellar keys address ${alias}`);
  }
}

function parseNumber(raw: string): number {
  const match = raw.match(/-?\d+/);
  if (!match) throw new Error(`Unable to parse number from: ${raw}`);
  return parseInt(match[0], 10);
}

function normalizeAddress(raw: string): string {
  return raw.replace(/^"|"$/g, "").trim();
}

function assertContains(output: string, expected: string, label: string) {
  if (!output.includes(expected)) {
    throw new Error(`${label} failed. Missing expected fragment '${expected}'. Output: ${output}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settleLedger() {
  await sleep(LEDGER_SETTLE_MS);
}

function isTransientError(msg: string): boolean {
  return (
    msg.includes("TxBadSeq") ||
    msg.includes("transaction submission timeout") ||
    msg.includes("Error(Contract, #3)") ||
    msg.includes("Error(Contract, #5)")
  );
}

async function runWrite(cmd: string, label: string, retries = MAX_RETRIES): Promise<string> {
  let lastErr = "";
  for (let i = 0; i < retries; i += 1) {
    try {
      return run(cmd);
    } catch (err: any) {
      const msg = formatErr(err);
      lastErr = msg;
      if (isTransientError(msg) && i + 1 < retries) {
        console.warn(`  ! ${label}: transient chain error, retrying after ledger close...`);
        await settleLedger();
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${label} failed after retries: ${lastErr}`);
}

async function runEventually(
  cmd: string,
  predicate: (output: string) => boolean,
  label: string,
  attempts = 15,
  delayMs = 2000
): Promise<string> {
  let last = "";
  for (let i = 0; i < attempts; i += 1) {
    try {
      last = run(cmd);
      if (predicate(last)) return last;
    } catch (err: any) {
      last = formatErr(err);
    }
    await sleep(delayMs);
  }
  throw new Error(`${label} did not reach expected state. Last output: ${last}`);
}

function sep(title: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(70));
}

async function main() {
  sep("Complete Testnet Contract Flow");

  const env = loadEnv();
  const usdcSacAddress = requireValue("USDC", parseCliArg("usdc") || env.USDC_SAC_ADDRESS || "");
  const factoryAddress = requireValue("FACTORY", parseCliArg("factory") || env.VAULT_FACTORY_ADDRESS || "");
  const registryAddress = requireValue(
    "REGISTRY",
    parseCliArg("registry") || process.env.AGENT_REGISTRY_ADDRESS || env.AGENT_REGISTRY_ADDRESS || ""
  );
  const reputationAddress = requireValue(
    "REPUTATION",
    parseCliArg("reputation") || env.REPUTATION_REGISTRY_ADDRESS || ""
  );
  const validationAddress = requireValue(
    "VALIDATION",
    parseCliArg("validation") || env.VALIDATION_REGISTRY_ADDRESS || ""
  );

  const adminKey = "agentnet-admin";
  const facilitatorKey = "agentnet-facilitator";
  const operatorKey = "agentnet-agent-signer";
  const recipientKey = "agentnet-reg-recipient";
  const issuerKey = "agentnet-usdc-issuer";

  const admin = ensureKey(adminKey);
  const facilitator = ensureKey(facilitatorKey);
  const operator = ensureKey(operatorKey);
  const recipient = ensureKey(recipientKey);
  const issuer = ensureKey(issuerKey);

  console.log(`USDC SAC:            ${usdcSacAddress}`);
  console.log(`VaultFactory:        ${factoryAddress}`);
  console.log(`AgentRegistry:       ${registryAddress}`);
  console.log(`ReputationRegistry:  ${reputationAddress}`);
  console.log(`ValidationRegistry:  ${validationAddress}`);
  console.log(`Admin:               ${admin}`);
  console.log(`Facilitator:         ${facilitator}`);
  console.log(`Operator:            ${operator}`);
  console.log(`Recipient:           ${recipient}`);
  console.log(`USDC Issuer:         ${issuer}`);

  sep("1) USDC mint and balances");
  try {
    await runWrite(
      `stellar contract invoke --id ${usdcSacAddress} --source-account ${issuerKey} --network ${NETWORK} -- mint --to ${admin} --amount 150000000`,
      "mint admin"
    );
  } catch (err: any) {
    console.warn(`  mint admin skipped: ${formatErr(err)}`);
  }
  try {
    await runWrite(
      `stellar contract invoke --id ${usdcSacAddress} --source-account ${issuerKey} --network ${NETWORK} -- mint --to ${facilitator} --amount 50000000`,
      "mint facilitator"
    );
  } catch (err: any) {
    console.warn(`  mint facilitator skipped: ${formatErr(err)}`);
  }
  await settleLedger();

  const adminBalance = run(
    `stellar contract invoke --id ${usdcSacAddress} --source-account ${adminKey} --network ${NETWORK} -- balance --id ${admin}`
  );
  const facilitatorBalance = run(
    `stellar contract invoke --id ${usdcSacAddress} --source-account ${adminKey} --network ${NETWORK} -- balance --id ${facilitator}`
  );
  console.log(`  admin usdc balance: ${adminBalance}`);
  console.log(`  facilitator usdc balance: ${facilitatorBalance}`);

  sep("2) VaultFactory + UserVault flow");
  const hasVault = run(
    `stellar contract invoke --id ${factoryAddress} --source-account ${adminKey} --network ${NETWORK} -- has_vault --owner ${admin}`
  );

  let vaultAddress = "";
  if (hasVault.toLowerCase().includes("true")) {
    vaultAddress = normalizeAddress(
      run(
        `stellar contract invoke --id ${factoryAddress} --source-account ${adminKey} --network ${NETWORK} -- get_vault --owner ${admin}`
      )
    );
  } else {
    vaultAddress = normalizeAddress(
      await runWrite(
        `stellar contract invoke --id ${factoryAddress} --source-account ${adminKey} --network ${NETWORK} -- create_vault --owner ${admin}`,
        "create_vault"
      )
    );
    await settleLedger();
  }
  console.log(`  vault: ${vaultAddress}`);

  await runWrite(
    `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- deposit --from ${admin} --amount 50000000`,
    "vault deposit"
  );
  await settleLedger();

  let policyReady = false;
  for (let i = 0; i < 3 && !policyReady; i += 1) {
    try {
      run(
        `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- get_agent_policy --agent ${operator}`
      );
      policyReady = true;
      break;
    } catch (err: any) {
      const msg = formatErr(err);
      if (!(msg.includes("AgentNotFound") || msg.includes("Error(Contract, #4)"))) {
        throw err;
      }
    }

    try {
      await runWrite(
        `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- add_agent --owner ${admin} --agent ${operator} --daily_limit 30000000 --allowed_destinations '[]'`,
        "vault add_agent"
      );
    } catch (err: any) {
      const msg = formatErr(err);
      if (!(msg.includes("DuplicateAgent") || msg.includes("Error(Contract, #9)"))) {
        throw err;
      }
      console.log("  add_agent: already exists, continuing.");
    }
    await settleLedger();
  }

  await runEventually(
    `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- get_agent_policy --agent ${operator}`,
    (out) => out.includes("daily_limit"),
    "vault get_agent_policy after add"
  );

  await runWrite(
    `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- set_agent_limit --owner ${admin} --agent ${operator} --new_limit 30000000`,
    "vault set_agent_limit"
  );
  await settleLedger();

  const remainingBefore = run(
    `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- remaining_limit --agent ${operator}`
  );
  console.log(`  remaining before pay: ${remainingBefore}`);

  await runWrite(
    `stellar contract invoke --id ${vaultAddress} --source-account ${operatorKey} --network ${NETWORK} -- agent_pay --agent ${operator} --pay_to ${facilitator} --amount 1000000 --memo flowpay`,
    "vault agent_pay"
  );
  await settleLedger();

  const remainingAfter = run(
    `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- remaining_limit --agent ${operator}`
  );
  const totalSpent = run(
    `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- total_spent`
  );
  const vaultBalance = run(
    `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- balance`
  );
  const agentPolicy = run(
    `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- get_agent_policy --agent ${operator}`
  );

  await runWrite(
    `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- withdraw --owner ${admin} --amount 100000`,
    "vault withdraw"
  );
  await settleLedger();
  const vaultBalanceAfterWithdraw = run(
    `stellar contract invoke --id ${vaultAddress} --source-account ${adminKey} --network ${NETWORK} -- balance`
  );

  console.log(`  remaining after pay: ${remainingAfter}`);
  console.log(`  total_spent: ${totalSpent}`);
  console.log(`  vault balance: ${vaultBalance}`);
  console.log(`  vault balance after withdraw: ${vaultBalanceAfterWithdraw}`);
  console.log(`  agent policy: ${agentPolicy}`);

  sep("3) AgentRegistry (ERC-8004-style identity NFT flow)");
  const now = Date.now();
  const handleA = `flow-${now}`;
  const handleB = `flow-${now}-v2`;
  const uriA = `https://agentnet.test/flow/${now}/v1`;
  const uriB = `https://agentnet.test/flow/${now}/v2`;
  const nextTokenBeforeMint = parseNumber(
    run(
      `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- next_token_id`
    )
  );

  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- mint_identity --owner ${admin} --name 'Flow Agent ${now}' --handle '${handleA}' --agent_uri '${uriA}' --vault_address ${vaultAddress} --agent_signer ${operator}`,
    "registry mint_identity"
  );
  const tokenId = nextTokenBeforeMint;
  const tokenIdU32 = tokenId >>> 0;
  if (tokenIdU32 !== tokenId) {
    throw new Error(`Token ID ${tokenId} does not fit into u32 for reputation/validation calls.`);
  }
  await settleLedger();

  const ownerOfMinted = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- owner_of --token_id ${tokenId}`,
    (out) => out.includes(admin),
    "registry owner_of minted token"
  );
  const tokenUriOut = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- token_uri --token_id ${tokenId}`,
    (out) => out.includes("agentnet.test/flow"),
    "registry token_uri"
  );
  const byHandleOut = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- get_agent_by_handle --handle '${handleA}'`
  );
  const balanceOwner = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- balance_of --owner ${admin}`
  );

  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- approve --owner ${admin} --to ${operator} --token_id ${tokenId}`,
    "registry approve"
  );
  await settleLedger();

  const approved = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- get_approved --token_id ${tokenId}`
  );
  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- set_approval_for_all --owner ${admin} --operator ${operator} --approved true`,
    "registry set_approval_for_all"
  );
  await settleLedger();

  const isForAll = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- is_approved_for_all --owner ${admin} --operator ${operator}`
  );

  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- set_agent_uri --caller ${admin} --token_id ${tokenId} --new_uri '${uriB}'`,
    "registry set_agent_uri"
  );
  await settleLedger();

  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- set_handle --caller ${admin} --token_id ${tokenId} --new_handle '${handleB}'`,
    "registry set_handle"
  );
  await settleLedger();

  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- set_metadata --caller ${admin} --token_id ${tokenId} --key 'model' --value 'gpt-5'`,
    "registry set_metadata"
  );
  await settleLedger();

  const metadata = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- get_metadata --token_id ${tokenId} --key 'model'`,
    (out) => out.includes("gpt-5"),
    "registry get_metadata"
  );
  const oldHandleAvailable = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- is_handle_available --handle '${handleA}'`
  );
  const newHandleAvailable = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- is_handle_available --handle '${handleB}'`
  );

  const preLifecycleAgent = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- get_agent --token_id ${tokenId}`
  );

  if (preLifecycleAgent.includes("\"is_active\":true")) {
    try {
      await runWrite(
        `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- deactivate --caller ${admin} --token_id ${tokenId}`,
        "registry deactivate"
      );
      await settleLedger();
    } catch (err: any) {
      const msg = formatErr(err);
      if (!(msg.includes("AlreadyInactive") || msg.includes("Error(Contract, #11)"))) {
        throw err;
      }
    }
  }

  const inactiveAgent = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- get_agent --token_id ${tokenId}`,
    (out) => out.includes("\"is_active\":false"),
    "registry get_agent inactive state"
  );

  if (inactiveAgent.includes("\"is_active\":false")) {
    try {
      await runWrite(
        `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- reactivate --caller ${admin} --token_id ${tokenId}`,
        "registry reactivate"
      );
      await settleLedger();
    } catch (err: any) {
      const msg = formatErr(err);
      if (!(msg.includes("AlreadyActive") || msg.includes("Error(Contract, #12)"))) {
        throw err;
      }
    }
  }

  await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- get_agent --token_id ${tokenId}`,
    (out) => out.includes("\"is_active\":true"),
    "registry get_agent active state"
  );

  const listByOwner = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- list_tokens_by_owner --owner ${admin} --offset 0 --limit 100`
  );
  const listAgents = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- list_agents --start_token_id 1 --limit 30`
  );
  const totalSupply = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- total_supply`
  );
  const activeCount = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- active_count`
  );
  const nextTokenId = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- next_token_id`
  );
  if (parseNumber(nextTokenId) <= tokenId) {
    throw new Error(`next_token_id did not advance after mint. token_id=${tokenId}, next=${nextTokenId}`);
  }

  await runWrite(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- transfer_from --caller ${admin} --from ${admin} --to ${recipient} --token_id ${tokenId}`,
    "registry transfer_from owner->recipient"
  );
  await settleLedger();

  const ownerAfterTransfer = await runEventually(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- owner_of --token_id ${tokenId}`,
    (out) => out.includes(recipient),
    "registry owner_of after transfer to recipient"
  );

  const currentOwner = normalizeAddress(ownerAfterTransfer);
  if (currentOwner === recipient) {
    await runWrite(
      `stellar contract invoke --id ${registryAddress} --source-account ${recipientKey} --network ${NETWORK} -- transfer_from --caller ${recipient} --from ${recipient} --to ${admin} --token_id ${tokenId}`,
      "registry transfer_from recipient->owner"
    );
    await settleLedger();
  }

  const ownerAfterReturn = run(
    `stellar contract invoke --id ${registryAddress} --source-account ${adminKey} --network ${NETWORK} -- owner_of --token_id ${tokenId}`
  );

  assertContains(ownerOfMinted, admin, "owner_of minted");
  assertContains(tokenUriOut, "agentnet.test/flow", "token_uri");
  assertContains(byHandleOut, `${tokenId}`, "get_agent_by_handle");
  assertContains(approved, operator, "get_approved");
  assertContains(isForAll.toLowerCase(), "true", "is_approved_for_all");
  assertContains(metadata, "gpt-5", "get_metadata");
  assertContains(oldHandleAvailable.toLowerCase(), "true", "is_handle_available old");
  assertContains(newHandleAvailable.toLowerCase(), "false", "is_handle_available new");
  assertContains(ownerAfterTransfer, recipient, "owner after transfer");
  assertContains(ownerAfterReturn, admin, "owner after return");

  console.log(`  token_id: ${tokenId}`);
  console.log(`  balance(owner): ${balanceOwner}`);
  console.log(`  total_supply: ${totalSupply}`);
  console.log(`  active_count: ${activeCount}`);
  console.log(`  next_token_id: ${nextTokenId}`);
  console.log(`  list_tokens_by_owner: ${listByOwner}`);
  console.log(`  list_agents: ${listAgents}`);

  sep("4) ReputationRegistry flow");
  const proofHash = `proof-${now}`;
  const feedbackUri = `https://agentnet.test/feedback/${now}`;

  await runWrite(
    `stellar contract invoke --id ${reputationAddress} --source-account ${facilitatorKey} --network ${NETWORK} -- post_feedback --agent_id ${tokenIdU32} --reviewer ${facilitator} --score 5 --category 'quality' --data_uri '${feedbackUri}' --payment_proof_hash '${proofHash}'`,
    "reputation post_feedback"
  );
  await settleLedger();

  const feedbackList = run(
    `stellar contract invoke --id ${reputationAddress} --source-account ${adminKey} --network ${NETWORK} -- get_feedback --agent_id ${tokenIdU32} --offset 0 --limit 20`
  );
  const feedbackSummary = run(
    `stellar contract invoke --id ${reputationAddress} --source-account ${adminKey} --network ${NETWORK} -- get_feedback_summary --agent_id ${tokenIdU32}`
  );

  assertContains(feedbackList, feedbackUri, "reputation get_feedback");
  assertContains(feedbackSummary, "total_reviews", "reputation get_feedback_summary");
  console.log(`  feedback summary: ${feedbackSummary}`);

  sep("5) ValidationRegistry flow");
  const requestUri = `https://agentnet.test/validation/request/${now}`;
  const dataHash = `hash-${now}`;
  const evidenceUri = `https://agentnet.test/validation/evidence/${now}`;

  const requestOut = await runWrite(
    `stellar contract invoke --id ${validationAddress} --source-account ${facilitatorKey} --network ${NETWORK} -- request_validation --agent_id ${tokenIdU32} --validator ${facilitator} --request_uri '${requestUri}' --data_hash '${dataHash}'`,
    "validation request_validation"
  );
  const requestId = parseNumber(requestOut);
  await settleLedger();

  const validationBefore = await runEventually(
    `stellar contract invoke --id ${validationAddress} --source-account ${adminKey} --network ${NETWORK} -- get_validation --request_id ${requestId}`,
    (out) => out.includes(`"request_id":${requestId}`),
    "validation get_validation before submit"
  );

  for (let i = 0; i < 4; i += 1) {
    try {
      await runWrite(
        `stellar contract invoke --id ${validationAddress} --source-account ${facilitatorKey} --network ${NETWORK} -- submit_validation --request_id ${requestId} --validator ${facilitator} --success true --evidence_uri '${evidenceUri}'`,
        "validation submit_validation"
      );
      break;
    } catch (err: any) {
      const msg = formatErr(err);
      if ((msg.includes("RequestNotFound") || msg.includes("Error(Contract, #2)")) && i < 3) {
        await settleLedger();
        continue;
      }
      throw err;
    }
  }
  await settleLedger();

  const validationAfter = await runEventually(
    `stellar contract invoke --id ${validationAddress} --source-account ${adminKey} --network ${NETWORK} -- get_validation --request_id ${requestId}`,
    (out) => out.toLowerCase().includes("status"),
    "validation get_validation after submit"
  );
  const validationList = run(
    `stellar contract invoke --id ${validationAddress} --source-account ${adminKey} --network ${NETWORK} -- get_validations --agent_id ${tokenIdU32}`
  );

  assertContains(validationBefore.toLowerCase(), "pending", "validation before submit");
  assertContains(validationAfter.toLowerCase(), "completed", "validation after submit");
  assertContains(validationList, `${requestId}`, "validation list includes request");

  sep("Result");
  console.log("Complete cross-contract testnet flow passed.");
  console.log(`Vault:              ${vaultAddress}`);
  console.log(`Minted token_id:    ${tokenId}`);
  console.log(`Validation request: ${requestId}`);
  console.log("\nContract Explorer Links:");
  console.log(`- USDC SAC: https://stellar.expert/explorer/testnet/contract/${usdcSacAddress}`);
  console.log(`- VaultFactory: https://stellar.expert/explorer/testnet/contract/${factoryAddress}`);
  console.log(`- UserVault: https://stellar.expert/explorer/testnet/contract/${vaultAddress}`);
  console.log(`- AgentRegistry: https://stellar.expert/explorer/testnet/contract/${registryAddress}`);
  console.log(`- ReputationRegistry: https://stellar.expert/explorer/testnet/contract/${reputationAddress}`);
  console.log(`- ValidationRegistry: https://stellar.expert/explorer/testnet/contract/${validationAddress}`);
}

main().catch((err: any) => {
  console.error("\nComplete flow test failed:", err?.message || err);
  process.exit(1);
});
