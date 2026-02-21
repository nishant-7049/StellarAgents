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
pnpm --version       # >= 9
```

---

## Step 1: Generate Testnet Accounts

You need 3 accounts: **Admin** (deploys contracts), **Facilitator** (pays XLM fees for x402), **Agent Signer** (test AI agent).

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
```

Each `--fund` flag calls Friendbot automatically (10,000 testnet XLM each).

### Get the secret keys

```bash
stellar keys show admin
# → SABC...

stellar keys show facilitator
# → SDEF...

stellar keys show agent-signer
# → SGHI...
```

---

## Step 2: Build the Contracts

```bash
cd contracts

# Build all 3 contracts to WASM
cargo build --release --target wasm32-unknown-unknown

# Verify WASM outputs exist
ls -la target/wasm32-unknown-unknown/release/*.wasm
# Should see:
#   user_vault.wasm
#   vault_factory.wasm
#   agent_registry.wasm
```

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
# Example output:
# a1b2c3d4e5f6...  (this is your VAULT_WASM_HASH)
```

### 3b. Deploy VaultFactory

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/vault_factory.wasm \
  --source admin \
  --network testnet
```

This prints the **factory contract address** (starts with `C`). Save it:
```
# Example: CBXYZ123...  (this is your VAULT_FACTORY_ADDRESS)
```

### 3c. Deploy AgentRegistry

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/agent_registry.wasm \
  --source admin \
  --network testnet
```

Save the **registry contract address**:
```
# Example: CABC456...  (this is your AGENT_REGISTRY_ADDRESS)
```

### 3d. Deploy a test USDC token (SAC)

For testnet, we create a mock USDC asset:

```bash
# Create the USDC asset issuer
stellar keys generate usdc-issuer --network testnet --fund

# Get issuer address
stellar keys address usdc-issuer
# → GUSDC_ISSUER...

# Wrap as Soroban Asset Contract (SAC)
stellar contract asset deploy \
  --asset "USDC:$(stellar keys address usdc-issuer)" \
  --source admin \
  --network testnet
```

Save the **USDC SAC address**:
```
# Example: CUSDC789...  (this is your USDC_SAC_ADDRESS)
```

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

---

## Step 5: Write the .env files

Create `.env.contracts` in the project root:

```bash
cat > .env.contracts << 'EOF'
VAULT_FACTORY_ADDRESS=<paste factory address>
AGENT_REGISTRY_ADDRESS=<paste registry address>
USDC_SAC_ADDRESS=<paste USDC SAC address>
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
```

---

## Step 6: Test the Full On-Chain Flow

### 6a. Create a Vault

```bash
stellar contract invoke \
  --id <VAULT_FACTORY_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  create_vault \
  --owner $(stellar keys address admin)
```

This prints the **vault contract address**. Save it.

### 6b. Mint test USDC to your account

```bash
# Trustline (classic Stellar — needed before receiving asset)
stellar tx new \
  --source admin \
  --network testnet \
  change-trust \
  --asset "USDC:$(stellar keys address usdc-issuer)" \
  --limit 1000000 \
  | stellar tx sign --source admin \
  | stellar tx send --network testnet

# Mint 1000 USDC to admin
stellar contract invoke \
  --id <USDC_SAC_ADDRESS> \
  --source usdc-issuer \
  --network testnet \
  -- \
  mint \
  --to $(stellar keys address admin) \
  --amount 10000000000
```

(10000000000 = 1000 USDC in stroops, 7 decimals)

### 6c. Deposit USDC into Vault

```bash
stellar contract invoke \
  --id <VAULT_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  deposit \
  --from $(stellar keys address admin) \
  --amount 1000000000
```

(1000000000 = 100 USDC)

### 6d. Check Vault Balance

```bash
stellar contract invoke \
  --id <VAULT_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  balance
```

Should return `1000000000` (100 USDC).

### 6e. Add Agent to Vault

```bash
stellar contract invoke \
  --id <VAULT_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  add_agent \
  --owner $(stellar keys address admin) \
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
  --memo "test_payment"
```

(100000 = 0.01 USDC — the x402 query price)

### 6g. Verify the payment

```bash
# Check vault balance (should be 100 USDC - 0.01 = 99.99)
stellar contract invoke \
  --id <VAULT_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  balance

# Check remaining daily limit
stellar contract invoke \
  --id <VAULT_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  remaining_limit \
  --agent $(stellar keys address agent-signer)
```

---

## Step 7: Register an Agent in the Registry

```bash
stellar contract invoke \
  --id <AGENT_REGISTRY_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  register \
  --owner $(stellar keys address admin) \
  --name "Yield Optimizer v1" \
  --agent_uri '{"capabilities":["yield"],"pricing":{"protocol":"x402","amount":"100000","asset":"USDC"},"model":"claude-sonnet-4-5-20250929"}' \
  --vault_address <VAULT_ADDRESS> \
  --agent_signer $(stellar keys address agent-signer)
```

Returns the agent ID (should be `1`).

### Verify

```bash
stellar contract invoke \
  --id <AGENT_REGISTRY_ADDRESS> \
  --source admin \
  --network testnet \
  -- \
  get_agent \
  --agent_id 1
```

---

## Step 8: Test the Backend (Live)

### 8a. Start backend

```bash
cd apps/backend
pnpm dev
```

### 8b. Health check

```bash
curl http://localhost:3001/health | jq
# Should show your real contract addresses
```

### 8c. Test 402 flow

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

### 8d. Test rebalancer status

```bash
curl http://localhost:3001/api/rebalance/status | jq
```

---

## Step 9: Run Automated Tests

```bash
# From project root:

# Contract tests (mock environment)
cd contracts && cargo test --workspace && cd ..

# Unit tests (mock data, no network)
pnpm test:unit

# Integration tests (uses real contract addresses from .env.contracts)
pnpm test:integration
```

---

## Step 10: View on Stellar Expert

Every transaction you made is visible at:

```
https://stellar.expert/explorer/testnet/contract/<CONTRACT_ADDRESS>
```

Replace `<CONTRACT_ADDRESS>` with your vault, factory, or registry address.

You can also search by transaction hash to see the full operation details.

---

## Quick Reference — All Addresses to Track

| Item | Where to find it |
|------|-----------------|
| Admin pubkey | `stellar keys address admin` |
| Facilitator pubkey | `stellar keys address facilitator` |
| Agent Signer pubkey | `stellar keys address agent-signer` |
| VaultFactory address | Output of `stellar contract deploy` (step 3b) |
| AgentRegistry address | Output of `stellar contract deploy` (step 3c) |
| USDC SAC address | Output of `stellar contract asset deploy` (step 3d) |
| Your vault address | Output of `create_vault` (step 6a) |
| WASM hash | Output of `stellar contract install` (step 3a) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `stellar: command not found` | `brew install stellar-cli` or `cargo install stellar-cli --locked` |
| `Account not found` | Fund it: `stellar keys generate <name> --network testnet --fund` |
| `HostError: insufficient balance` | Mint more test USDC (step 6b) or get more XLM from friendbot |
| `Contract not found` | Double-check the contract address, make sure you deployed to testnet |
| `simulation failed` | Run with `--verbose` flag for detailed error output |
| WASM build fails | Make sure `wasm32-unknown-unknown` target is installed: `rustup target add wasm32-unknown-unknown` |
| `ExceedsDailyLimit` error | Wait 24h or re-add agent with higher limit |
| Backend won't start | Check `.env` has all required values, especially contract addresses |
