# AgenticOcean — Full Testing Guide

> **Network: Stellar TESTNET only.**
> Testnet XLM is free via Friendbot. No real funds needed.

---

## Prerequisites

### 1. Install Stellar CLI

```bash
# macOS
brew install stellar-cli

# or via cargo
cargo install stellar-cli --locked

# Verify
stellar version
```

### 2. Verify Rust + WASM target

```bash
rustup target add wasm32-unknown-unknown
rustc --version      # should be 1.70+
```

### 3. Verify Node.js + pnpm

```bash
node --version       # >= 20
pnpm --version       # >= 10
```

---

## Step 1: Generate Testnet Accounts

You need 4 accounts: **Admin** (deploys contracts), **Facilitator** (pays XLM fees for x402), **Agent Signer** (test AI agent), **User1** (test vault owner).

```bash
# Generate Admin account
stellar keys generate admin --network testnet --fund
stellar keys address admin
# → GA7XYZ... (copy this)

# Generate Facilitator account
stellar keys generate facilitator --network testnet --fund
stellar keys address facilitator
# → GB8ABC... (copy this)

# Generate Agent Signer account
stellar keys generate agent-signer --network testnet --fund
stellar keys address agent-signer
# → GC9DEF... (copy this)

# Generate User1 account
stellar keys generate user1 --network testnet --fund
stellar keys address user1
# → GD0GHI... (copy this)
```

Each `--fund` flag calls Friendbot automatically (10,000 testnet XLM each).

### Get the secret keys

```bash
stellar keys show admin
stellar keys show facilitator
stellar keys show agent-signer
stellar keys show user1
```

---

## Step 2: Build the Contracts

```bash
cd contracts

# Build all 5 contracts to WASM
cargo build --release --target wasm32-unknown-unknown

# Verify WASM outputs exist
ls -la target/wasm32-unknown-unknown/release/*.wasm
# Should see:
#   user_vault.wasm
#   vault_factory.wasm
#   agent_registry.wasm
#   reputation_registry.wasm
#   validation_registry.wasm
```

Soroban SDK version: `=25.0.2` (pinned in `contracts/Cargo.toml`).

---

## Step 3: Deploy Contracts to Testnet

### 3a. Install UserVault WASM (get the hash)

```bash
stellar contract install \
  --wasm target/wasm32-unknown-unknown/release/user_vault.wasm \
  --source admin \
  --network testnet
```

This prints a **WASM hash** (64-char hex). Save it:
```
# Example: 27b91b68f5c58464a69efd4ffb4e0a0761ba22da65a774e41fba3fdc7bdaf361
```

### 3b. Deploy VaultFactory

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/vault_factory.wasm \
  --source admin \
  --network testnet
```

Save the **factory contract address** (starts with `C`).

### 3c. Deploy AgentRegistry

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/agent_registry.wasm \
  --source admin \
  --network testnet
```

Save the **registry contract address**.

### 3d. Deploy ReputationRegistry

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/reputation_registry.wasm \
  --source admin \
  --network testnet
```

Save the **reputation registry address**.

### 3e. Deploy ValidationRegistry

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/validation_registry.wasm \
  --source admin \
  --network testnet
```

Save the **validation registry address**.

### 3f. Use the USDC Testnet SAC

Use the known testnet USDC SAC address:
```
CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
```
Asset: `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`

---

## Step 4: Initialize Contracts

### 4a. Initialize VaultFactory

```bash
stellar contract invoke \
  --id <VAULT_FACTORY_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  initialize \
  --admin $(stellar keys address admin) \
  --vault_wasm_hash <VAULT_WASM_HASH> \
  --usdc_token <USDC_SAC_ADDRESS>
```

### 4b. Initialize AgentRegistry

```bash
stellar contract invoke \
  --id <AGENT_REGISTRY_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  initialize \
  --admin $(stellar keys address admin)
```

### 4c. Initialize ReputationRegistry

```bash
stellar contract invoke \
  --id <REPUTATION_REGISTRY_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  initialize \
  --admin $(stellar keys address admin)
```

### 4d. Initialize ValidationRegistry

```bash
stellar contract invoke \
  --id <VALIDATION_REGISTRY_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  initialize \
  --admin $(stellar keys address admin)
```

---

## Step 5: Write the .env files

Create `.env.contracts` in the project root:

```bash
cat > .env.contracts << 'EOF'
VAULT_FACTORY_ADDRESS=<paste factory address>
AGENT_REGISTRY_ADDRESS=<paste registry address>
REPUTATION_REGISTRY_ADDRESS=<paste reputation address>
VALIDATION_REGISTRY_ADDRESS=<paste validation address>
USDC_SAC_ADDRESS=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
VAULT_WASM_HASH=<paste wasm hash>
ADMIN_SECRET_KEY=<paste from: stellar keys show admin>
FACILITATOR_SECRET_KEY=<paste from: stellar keys show facilitator>
AGENT_SIGNER_SECRET_KEY=<paste from: stellar keys show agent-signer>
EOF
```

Also copy to `.env` for the backend:

```bash
cp .env.example .env
# Edit .env and fill in the contract addresses + keys from above
# Also set:
#   PORT=3001
#   NODE_ENV=development
#   AI_API_KEY=sk-ant-...   (or AIza..., gsk_..., xai-...)
```

---

## Step 6: Test the Full On-Chain Flow

### 6a. Create a Vault

```bash
stellar contract invoke \
  --id <VAULT_FACTORY_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  create_vault \
  --owner $(stellar keys address user1)
```

This prints the **vault contract address**. Save it.

### 6b. Mint test USDC to User1

First establish a trustline (classic Stellar):
```bash
stellar tx new \
  --source user1 \
  --network testnet \
  change-trust \
  --asset "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" \
  --limit 1000000 \
  | stellar tx sign --source user1 \
  | stellar tx send --network testnet
```

Then mint USDC via the SAC (requires USDC issuer key — use testnet faucet or contact SDF):
```bash
# 10000000000 = 1000 USDC (7 decimal stroops)
stellar contract invoke \
  --id CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA \
  --source <usdc-issuer> \
  --network testnet \
  -- \
  mint \
  --to $(stellar keys address user1) \
  --amount 10000000000
```

### 6c. Deposit USDC into Vault

```bash
stellar contract invoke \
  --id <VAULT_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  deposit \
  --from $(stellar keys address user1) \
  --amount 10000000000
```

(10000000000 = 1000 USDC in stroops)

### 6d. Check Vault Balance

```bash
stellar contract invoke \
  --id <VAULT_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  balance
```

Should return `10000000000` (1000 USDC in stroops).

### 6e. Add Agent to Vault

```bash
stellar contract invoke \
  --id <VAULT_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  add_agent \
  --owner $(stellar keys address user1) \
  --agent $(stellar keys address agent-signer) \
  --daily_limit 100000000 \
  --allowed_destinations '{"vec":[]}'
```

(daily_limit = 10 USDC in stroops)

### 6f. Test agent_pay (the x402 payment function)

```bash
stellar contract invoke \
  --id <VAULT_ADDRESS> \
  --source agent-signer \
  --network testnet \
  -- \
  agent_pay \
  --agent $(stellar keys address agent-signer) \
  --pay_to $(stellar keys address facilitator) \
  --amount 100000 \
  --memo "test_x402_001"
```

(100000 = 0.01 USDC — the x402 query price)

### 6g. Verify the payment

```bash
# Check vault balance (should be 1000 - 0.01 = 999.99 USDC)
stellar contract invoke \
  --id <VAULT_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  balance

# Check remaining daily limit
stellar contract invoke \
  --id <VAULT_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  remaining_limit \
  --agent $(stellar keys address agent-signer)
```

---

## Step 7: Register an Agent with Handle

```bash
stellar contract invoke \
  --id <AGENT_REGISTRY_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  register \
  --owner $(stellar keys address user1) \
  --name "Yield Optimizer v1" \
  --handle "yield-optimizer-v1" \
  --agent_uri '{"capabilities":["yield"],"pricing":{"protocol":"x402","amount":"100000","asset":"USDC"},"model":"claude-sonnet-4-6"}' \
  --vault_address <VAULT_ADDRESS> \
  --agent_signer $(stellar keys address agent-signer)
```

Returns the agent ID (should be `1`).

**Handle rules**: 3–32 chars, lowercase `a-z`, `0-9`, hyphens only, no leading/trailing hyphens.

### Check handle availability

```bash
stellar contract invoke \
  --id <AGENT_REGISTRY_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  is_handle_available \
  --handle "yield-optimizer-v1"
# Returns false (just taken)
```

### Get agent by handle

```bash
stellar contract invoke \
  --id <AGENT_REGISTRY_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  get_agent_by_handle \
  --handle "yield-optimizer-v1"
```

### Verify by ID

```bash
stellar contract invoke \
  --id <AGENT_REGISTRY_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  get_agent \
  --agent_id 1
```

---

## Step 8: Post a Reputation Review

```bash
stellar contract invoke \
  --id <REPUTATION_REGISTRY_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  post_feedback \
  --agent_id 1 \
  --reviewer $(stellar keys address user1) \
  --score 5 \
  --category "accuracy" \
  --data_uri '{"comment":"Great yield strategy!","timestamp":1739000000}' \
  --payment_proof_hash ""
```

### Check reputation summary

```bash
stellar contract invoke \
  --id <REPUTATION_REGISTRY_ADDRESS> \
  --source user1 \
  --network testnet \
  -- \
  get_feedback_summary \
  --agent_id 1
```

---

## Step 9: Test the Backend (Live)

### 9a. Start backend

```bash
cd apps/backend
pnpm dev
```

### 9b. Health check

```bash
curl http://localhost:3001/health | jq
# Should show your real contract addresses
```

### 9c. Test 402 flow

```bash
# No payment header → 402
curl -s http://localhost:3001/api/yield/query?q=best+yield | jq

# Should return:
# {
#   "x402Version": 1,
#   "accepts": [{
#     "scheme": "stellar-vault",
#     "amount": "100000",
#     ...
#   }]
# }
```

### 9d. Test explorer endpoints

```bash
curl http://localhost:3001/api/explorer/agents | jq
curl http://localhost:3001/api/explorer/agents/1 | jq
curl http://localhost:3001/api/explorer/agents/1/stats | jq
curl http://localhost:3001/api/explorer/activity | jq
```

### 9e. Test reputation endpoints

```bash
curl http://localhost:3001/api/reputation/1/summary | jq
curl http://localhost:3001/api/reputation/1/feedback | jq
```

---

## Step 10: Run Automated Tests

```bash
# From project root:

# Contract tests (21+ tests, mock environment)
cd contracts && cargo test --workspace && cd ..

# Unit tests (mock data, no network)
pnpm test:unit

# Integration tests (uses real contract addresses from .env.contracts)
pnpm test:integration
```

---

## Step 11: View on Stellar Expert

Every transaction you made is visible at:

```
https://stellar.expert/explorer/testnet/contract/<CONTRACT_ADDRESS>
```

Replace `<CONTRACT_ADDRESS>` with your vault, factory, registry, or reputation address.

---

## Quick Reference — All Addresses to Track

| Item | Where to find it |
|------|-----------------|
| Admin pubkey | `stellar keys address admin` |
| Facilitator pubkey | `stellar keys address facilitator` |
| Agent Signer pubkey | `stellar keys address agent-signer` |
| VaultFactory address | Output of `stellar contract deploy` (step 3b) |
| AgentRegistry address | Output of `stellar contract deploy` (step 3c) |
| ReputationRegistry address | Output of `stellar contract deploy` (step 3d) |
| ValidationRegistry address | Output of `stellar contract deploy` (step 3e) |
| USDC SAC address | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Your vault address | Output of `create_vault` (step 6a) |
| WASM hash | Output of `stellar contract install` (step 3a) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `stellar: command not found` | `brew install stellar-cli` or `cargo install stellar-cli --locked` |
| `Account not found` | Fund it: `stellar keys generate <name> --network testnet --fund` |
| `HostError: insufficient balance` | Mint more test USDC or get more XLM from friendbot |
| `Contract not found` | Double-check the contract address, make sure you deployed to testnet |
| `simulation failed` | Run with `--verbose` flag for detailed error output |
| WASM build fails | `rustup target add wasm32-unknown-unknown` |
| `ExceedsDailyLimit` error | Wait 24h or re-add agent with higher limit |
| `HandleAlreadyTaken` | Choose a different handle |
| `HandleInvalidChars` | Use only lowercase a-z, 0-9, hyphens |
| Backend won't start | Check `.env` has all required values, especially contract addresses |
