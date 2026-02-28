# StellarAgent402 — Complete Test Flow

This document provides a step-by-step testing strategy for the entire StellarAgent402 platform, from contract deployment to full end-to-end demo.

---

## Prerequisites Checklist

- [ ] Stellar CLI installed (`stellar --version` should show v25.1.0+)
- [ ] Rust 1.89.0+ installed (`rustc --version`)
- [ ] Node.js 20+ installed (`node --version`)
- [ ] pnpm installed (`pnpm --version`)
- [ ] All dependencies installed (`pnpm install` at root)
- [ ] All contracts built (`cd contracts && cargo build --release --target wasm32-unknown-unknown`)
- [ ] All SDK packages built (`pnpm build:sdk`)

---

## Phase 1: Contract Deployment

### 1.1 Generate Testnet Keypairs

```bash
# Generate and fund keypairs
stellar keys generate admin --network testnet --fund
stellar keys generate facilitator --network testnet --fund
stellar keys generate agent-signer --network testnet --fund
stellar keys generate user1 --network testnet --fund

# Verify balances (should have 10,000 XLM each)
stellar keys address admin | xargs -I {} stellar account {}
stellar keys address facilitator | xargs -I {} stellar account {}
stellar keys address agent-signer | xargs -I {} stellar account {}
stellar keys address user1 | xargs -I {} stellar account {}
```

**Expected Output:**
- 4 keypairs created in `~/.config/soroban/identity/`
- Each account funded with 10,000 XLM (testnet)

---

### 1.2 Deploy UserVault WASM

```bash
cd contracts

# Install the UserVault WASM (returns a WASM hash)
stellar contract install \
  --wasm target/wasm32-unknown-unknown/release/user_vault.wasm \
  --source admin \
  --network testnet

# Save the hash to .env.contracts
echo "VAULT_WASM_HASH=<hash from above>" >> ../.env.contracts
```

**Expected Output:**
```
CA3D5KRYM6CB7OUW2S66ZG2XVXNMUSCXXUHHFD3VXCMYV2BHN6HNABC...
```

**Test:** Verify hash is 64 hex characters starting with 'C'

---

### 1.3 Deploy VaultFactory

```bash
# Get USDC testnet address (we'll use the official Stellar Asset Contract)
# For testnet, USDC SAC is: CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
echo "USDC_SAC_ADDRESS=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA" >> ../.env.contracts

# Deploy VaultFactory
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/vault_factory.wasm \
  --source admin \
  --network testnet

# Save the address
echo "VAULT_FACTORY_ADDRESS=<address from above>" >> ../.env.contracts
```

**Expected Output:**
```
CDQR3JWMJ4XVYZ7PXMQWK3NDBO5UIFHB6EJR7FX2YZKGVWLT4KNABC...
```

**Test:** Address should be 56 characters starting with 'C'

---

### 1.4 Initialize VaultFactory

```bash
# Read the addresses from .env.contracts
source ../.env.contracts

stellar contract invoke \
  --id $VAULT_FACTORY_ADDRESS \
  --source admin \
  --network testnet \
  -- \
  initialize \
  --admin $(stellar keys address admin) \
  --vault_wasm_hash $VAULT_WASM_HASH \
  --usdc_token $USDC_SAC_ADDRESS
```

**Expected Output:**
```
Success
```

**Test:** Verify initialization
```bash
stellar contract invoke \
  --id $VAULT_FACTORY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  vault_count
```
Should return: `0` (no vaults created yet)

---

### 1.5 Deploy AgentRegistry

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/agent_registry.wasm \
  --source admin \
  --network testnet

# Save the address
echo "AGENT_REGISTRY_ADDRESS=<address from above>" >> ../.env.contracts
```

**Test:** Initialize AgentRegistry
```bash
source ../.env.contracts

stellar contract invoke \
  --id $AGENT_REGISTRY_ADDRESS \
  --source admin \
  --network testnet \
  -- \
  initialize \
  --admin $(stellar keys address admin)
```

**Verify:**
```bash
stellar contract invoke \
  --id $AGENT_REGISTRY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  agent_count
```
Should return: `0`

---

### 1.6 Deploy ReputationRegistry

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/reputation_registry.wasm \
  --source admin \
  --network testnet

echo "REPUTATION_REGISTRY_ADDRESS=<address from above>" >> ../.env.contracts

# Initialize
source ../.env.contracts
stellar contract invoke \
  --id $REPUTATION_REGISTRY_ADDRESS \
  --source admin \
  --network testnet \
  -- \
  initialize \
  --admin $(stellar keys address admin)
```

---

### 1.7 Deploy ValidationRegistry

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/validation_registry.wasm \
  --source admin \
  --network testnet

echo "VALIDATION_REGISTRY_ADDRESS=<address from above>" >> ../.env.contracts

# Initialize
source ../.env.contracts
stellar contract invoke \
  --id $VALIDATION_REGISTRY_ADDRESS \
  --source admin \
  --network testnet \
  -- \
  initialize \
  --admin $(stellar keys address admin)
```

---

### 1.8 Create Root .env File

```bash
cd /home/nishant/Work/StellarAgent402/StellarRiseInHackathon

# Create .env from .env.example
cp .env.example .env

# Add the secret keys
echo "" >> .env
echo "# Generated Keys" >> .env
echo "ADMIN_SECRET_KEY=$(stellar keys show admin)" >> .env
echo "FACILITATOR_SECRET_KEY=$(stellar keys show facilitator)" >> .env
echo "AGENT_SIGNER_SECRET_KEY=$(stellar keys show agent-signer)" >> .env

# Append contract addresses from .env.contracts
cat .env.contracts >> .env
```

**Verify .env has all required values:**
```bash
grep -E "^(VAULT_FACTORY|AGENT_REGISTRY|REPUTATION_REGISTRY|VALIDATION_REGISTRY|USDC_SAC|VAULT_WASM|ADMIN_SECRET|FACILITATOR_SECRET|AGENT_SIGNER_SECRET)" .env
```

---

## Phase 2: Contract Interaction Tests

### 2.1 Test: Create UserVault

```bash
source .env

# User1 creates a vault
stellar contract invoke \
  --id $VAULT_FACTORY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  create_vault \
  --owner $(stellar keys address user1)
```

**Expected Output:**
```
<vault_address>  # 56-char contract address
```

**Save vault address:**
```bash
VAULT_ADDRESS=<address from above>
echo "USER1_VAULT_ADDRESS=$VAULT_ADDRESS" >> .env
```

**Verify vault was created:**
```bash
stellar contract invoke \
  --id $VAULT_FACTORY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  get_vault \
  --owner $(stellar keys address user1)
```
Should return the same vault address.

**Verify vault count increased:**
```bash
stellar contract invoke \
  --id $VAULT_FACTORY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  vault_count
```
Should return: `1`

---

### 2.2 Test: Deposit USDC to Vault

**First, get some testnet USDC:**
```bash
# Mint testnet USDC to user1 (this requires USDC admin rights)
# For testnet, use the Stellar Asset Contract faucet or mint function
# (Actual command depends on testnet USDC setup)

# Check user1 USDC balance
stellar contract invoke \
  --id $USDC_SAC_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  balance \
  --id $(stellar keys address user1)
```

**Deposit 100 USDC to vault:**
```bash
source .env

stellar contract invoke \
  --id $USER1_VAULT_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  deposit \
  --from $(stellar keys address user1) \
  --amount 100_0000000
```

**Expected Output:** `Success`

**Verify vault balance:**
```bash
stellar contract invoke \
  --id $USER1_VAULT_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  balance
```
Should return: `1000000000` (100 USDC in stroops)

---

### 2.3 Test: Authorize Agent

```bash
source .env

stellar contract invoke \
  --id $USER1_VAULT_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  add_agent \
  --owner $(stellar keys address user1) \
  --agent $(stellar keys address agent-signer) \
  --daily_limit 10_0000000 \
  --allowed_destinations '[]'
```

**Expected Output:** `Success`

**Verify agent policy:**
```bash
stellar contract invoke \
  --id $USER1_VAULT_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  get_agent_policy \
  --agent $(stellar keys address agent-signer)
```

**Expected Output:**
```json
{
  "agent_address": "G...",
  "daily_limit": "100000000",
  "spent_today": "0",
  "last_reset": 1234567890,
  "allowed_destinations": [],
  "is_active": true
}
```

**Check remaining limit:**
```bash
stellar contract invoke \
  --id $USER1_VAULT_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  remaining_limit \
  --agent $(stellar keys address agent-signer)
```
Should return: `100000000` (10 USDC)

---

### 2.4 Test: Agent Payment (x402 Core Function)

```bash
source .env

# Agent pays 0.01 USDC (100,000 stroops) to facilitator
stellar contract invoke \
  --id $USER1_VAULT_ADDRESS \
  --source agent-signer \
  --network testnet \
  -- \
  agent_pay \
  --agent $(stellar keys address agent-signer) \
  --pay_to $(stellar keys address facilitator) \
  --amount 100000 \
  --memo "test_payment_001"
```

**Expected Output:** `Success`

**Verify:**
1. **Vault balance decreased:**
```bash
stellar contract invoke \
  --id $USER1_VAULT_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  balance
```
Should be: `999900000` (100 USDC - 0.01 USDC)

2. **Agent's remaining limit decreased:**
```bash
stellar contract invoke \
  --id $USER1_VAULT_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  remaining_limit \
  --agent $(stellar keys address agent-signer)
```
Should be: `99900000` (10 USDC - 0.01 USDC)

3. **Total spent increased:**
```bash
stellar contract invoke \
  --id $USER1_VAULT_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  total_spent
```
Should be: `100000` (0.01 USDC)

---

### 2.5 Test: Register Agent Identity

```bash
source .env

stellar contract invoke \
  --id $AGENT_REGISTRY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  register \
  --owner $(stellar keys address user1) \
  --name "YieldBot Alpha" \
  --agent_uri '{"capabilities":["yield-optimization"],"endpoints":{"query":"http://localhost:3001/api/yield/query"},"pricing":{"protocol":"x402","amount":"100000","asset":"USDC"}}' \
  --vault_address $USER1_VAULT_ADDRESS \
  --agent_signer $(stellar keys address agent-signer)
```

**Expected Output:**
```
1  # Agent ID
```

**Verify registration:**
```bash
stellar contract invoke \
  --id $AGENT_REGISTRY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  get_agent \
  --agent_id 1
```

**Expected Output:**
```json
{
  "id": 1,
  "owner": "G...",
  "name": "YieldBot Alpha",
  "agent_uri": "{...}",
  "vault_address": "C...",
  "agent_signer": "G...",
  "registered_at": 1234567890,
  "is_active": true
}
```

---

### 2.6 Test: Post Feedback

```bash
source .env

stellar contract invoke \
  --id $REPUTATION_REGISTRY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  post_feedback \
  --agent_id 1 \
  --reviewer $(stellar keys address user1) \
  --score 5 \
  --category "yield-strategy" \
  --data_uri "ipfs://Qm..." \
  --payment_proof_hash "abc123"
```

**Expected Output:** `Success`

**Verify feedback summary:**
```bash
stellar contract invoke \
  --id $REPUTATION_REGISTRY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  get_feedback_summary \
  --agent_id 1
```

**Expected Output:**
```json
{
  "total_reviews": 1,
  "total_score": 5,
  "avg_score_x100": 500
}
```

**Get feedback list:**
```bash
stellar contract invoke \
  --id $REPUTATION_REGISTRY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  get_feedback \
  --agent_id 1 \
  --offset 0 \
  --limit 10
```

---

### 2.7 Test: Request Validation

```bash
source .env

stellar contract invoke \
  --id $VALIDATION_REGISTRY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  request_validation \
  --agent_id 1 \
  --validator $(stellar keys address facilitator) \
  --request_uri "https://validator.example.com/check" \
  --data_hash "sha256:abc123..."
```

**Expected Output:**
```
0  # Request ID
```

**Submit validation result:**
```bash
stellar contract invoke \
  --id $VALIDATION_REGISTRY_ADDRESS \
  --source facilitator \
  --network testnet \
  -- \
  submit_validation \
  --request_id 0 \
  --success true \
  --evidence_uri "ipfs://Qm..."
```

**Get validation:**
```bash
stellar contract invoke \
  --id $VALIDATION_REGISTRY_ADDRESS \
  --source user1 \
  --network testnet \
  -- \
  get_validation \
  --request_id 0
```

---

## Phase 3: Backend Tests

### 3.1 Start Backend Server

```bash
cd apps/backend
pnpm dev
```

**Expected Output:**
```
AgenticOcean backend on port 3001
Vault Factory: C...
Agent Registry: C...
Starting rebalancer (every 5 min)
```

**Test health endpoint:**
```bash
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "network": "testnet",
  "contracts": {
    "factory": "C...",
    "registry": "C..."
  }
}
```

---

### 3.2 Test Vault API

```bash
# Get vault for owner
curl "http://localhost:3001/api/vaults/$(stellar keys address user1)"
```

**Expected Response:**
```json
{
  "owner": "G...",
  "vault_address": "C...",
  "balance": "999900000",
  "total_spent": "100000",
  "agent_count": 1
}
```

---

### 3.3 Test Agent API

```bash
# List agents
curl http://localhost:3001/api/agents

# Get specific agent
curl http://localhost:3001/api/agents/1
```

---

### 3.4 Test x402 Gated Endpoint (Without Payment)

```bash
curl http://localhost:3001/api/yield/query?q=best+yield+for+100+USDC
```

**Expected Response (402):**
```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "stellar-vault",
    "network": "stellar:testnet",
    "asset": "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    "amount": "100000",
    "payTo": "G...",
    "maxTimeoutSeconds": 60,
    "description": "AI-powered DeFi yield optimization query"
  }]
}
```

---

### 3.5 Test x402 Gated Endpoint (With Payment)

This requires building an x402 payment header. For now, we can test the AI endpoint directly by bypassing x402 (or implement the full x402 client).

**Alternative: Test AI directly (for development):**

Temporarily disable x402 middleware in `apps/backend/src/routes/yield.routes.ts` and test:

```bash
curl "http://localhost:3001/api/yield/query?q=best+yield+strategy+for+conservative+investor&risk=low&amount=1000"
```

**Expected Response:**
```json
{
  "query": "best yield strategy for conservative investor",
  "risk_tolerance": "low",
  "amount_usdc": 1000,
  "strategies": [
    {
      "protocol": "Ondo USDY",
      "action": "Hold USDY",
      "allocation_pct": 40,
      "estimated_apy": 4.8,
      "risk_level": "low",
      "details": "US Treasury-backed"
    },
    // ... more strategies
  ],
  "total_estimated_apy": 5.6,
  "summary": "Conservative strategy: Treasury yields + lending + stable LP.",
  "data_sources": {
    "blend_pools": 2,
    "soroswap_pools": 1,
    "rwa_sources": 2
  },
  "disclaimer": "APY estimates based on current rates. Not financial advice. DYOR."
}
```

---

## Phase 4: Frontend Tests

### 4.1 Start Frontend

```bash
cd apps/web
pnpm dev
```

**Expected:** Server starts at http://localhost:3000

---

### 4.2 Manual UI Tests

**Landing Page (/):**
- [ ] Hero section loads
- [ ] Features section displays 3 cards
- [ ] "How It Works" section visible
- [ ] "Launch App" button navigates to /app

**Dashboard (/app):**
- [ ] Wallet connect button appears
- [ ] Click connects to Freighter wallet
- [ ] After connect, shows wallet address
- [ ] Sidebar navigation works

**Vault Page (/app/vault):**
- [ ] Shows "Create Vault" if none exists
- [ ] Click creates vault (signs with Freighter)
- [ ] After creation, shows vault balance
- [ ] Deposit form works (approve USDC + deposit)
- [ ] Withdraw form works
- [ ] Agent list shows authorized agents

**Agents Page (/app/agents):**
- [ ] Shows grid of registered agents
- [ ] Click agent shows detail modal
- [ ] Displays agent metadata correctly

**Chat Page (/app/chat):**
- [ ] Query input accepts text
- [ ] Risk selector works
- [ ] Submit shows "Querying agent..." spinner
- [ ] Shows x402 payment banner (if payment made)
- [ ] Displays strategy cards
- [ ] Strategy cards show: protocol, allocation %, APY, risk level

**Register Page (/app/register):**
- [ ] Form accepts agent name, capabilities
- [ ] Submit registers agent on-chain
- [ ] Shows transaction hash link

---

## Phase 5: End-to-End Demo Flow

This is the **5-minute demo** for the hackathon presentation.

### Setup (Do before demo)

1. ✅ All contracts deployed to testnet
2. ✅ Backend running at localhost:3001
3. ✅ Frontend running at localhost:3000
4. ✅ User1 wallet has USDC and vault created
5. ✅ Agent registered with ID=1
6. ✅ Screen recording software ready (OBS Studio)

---

### Demo Script

**[SLIDE 1: Title]**
"Hi, I'm presenting StellarAgent402 — a platform where AI agents can autonomously pay for services using the x402 payment protocol on Stellar."

**[SLIDE 2: Problem]**
"AI agents need to pay for API calls, data, compute. But they can't hold credit cards. x402 solves this with crypto micropayments. We're bringing x402 to Stellar."

**[SLIDE 3: Architecture]**
(Show architecture diagram from `docs/architecture.mermaid`)
"Here's how it works: Users create vaults, agents get spending policies, vendors gate APIs with x402 middleware."

**[BROWSER: Open localhost:3000]**

**Step 1: Create Vault (30 seconds)**
- Navigate to /app/vault
- Click "Connect Wallet" → approve Freighter
- Click "Create Vault" → sign transaction
- *While tx pending:* "This vault is a Soroban smart contract that holds my USDC"
- *After confirmation:* "Now I'll deposit 100 USDC"
- Enter 100 → Click Deposit → sign
- *Show balance updated*

**Step 2: Authorize Agent (30 seconds)**
- Click "Add Agent"
- Enter agent public key (copy from terminal)
- Set daily limit: 10 USDC
- Click "Authorize" → sign
- *Show agent appears in list with 10 USDC remaining*
- "This agent can now spend up to 10 USDC per day from my vault"

**Step 3: Register Agent Identity (30 seconds)**
- Navigate to /app/register
- Fill form:
  - Name: "YieldBot Alpha"
  - Capabilities: "yield-optimization"
  - Endpoint: http://localhost:3001/api/yield/query
- Click "Register" → sign
- *Show success + agent ID*
- Navigate to /app/agents → show agent card

**Step 4: Query AI Agent (90 seconds)**
- Navigate to /app/chat
- Type: "What's the best yield strategy for 1000 USDC with moderate risk?"
- Select risk: Moderate
- Enter amount: 1000
- Click "Ask Agent"
- *Show x402 payment banner:* "Paid 0.01 USDC via x402"
- *Show strategy cards loading*
- *Explain strategies:* "The AI analyzed real Blend pools, Soroswap liquidity, and RWA yields"
- *Point to APY numbers:* "Total estimated APY: 8.1%"
- Click tx hash link → opens Stellar Expert
- *Show actual on-chain payment*

**Step 5: Show Agent Activity (30 seconds)**
- Navigate to /app/agents/1
- Show activity feed with the payment
- Show reputation score
- "Every interaction builds the agent's on-chain reputation"

**Step 6: Show Contract Explorer (30 seconds)**
- Open Stellar Expert
- Navigate to vault contract
- Show Events tab → recent agent_pay event
- Show AgentRegistry contract
- Show registered agents

**[SLIDE: Technical Achievement]**
"What we built:
- 5 production Soroban contracts (21/21 tests passing)
- 3 TypeScript SDK packages
- x402 middleware for Express
- AI yield optimizer powered by Claude
- Real integrations: Blend Protocol, Soroswap
- SRC-8004 compliant agent identity system"

**[SLIDE: Future]**
"Next steps:
- Mainnet deployment
- MCP server for agent integration
- Cross-chain x402 (Stellar ↔ EVM)
- Marketplace of x402-gated services"

**[SLIDE: Thank You]**
"Thank you! Live demo at stellaragent402.vercel.app
GitHub: github.com/yourusername/stellaragent402"

---

## Phase 6: Automated Test Suite

### 6.1 Contract Tests

```bash
cd contracts
cargo test --workspace -- --nocapture
```

**Expected:** All 21 tests pass

---

### 6.2 SDK Unit Tests

```bash
cd packages/x402-stellar
pnpm test

cd ../vault
pnpm test

cd ../agent-ai
pnpm test
```

---

### 6.3 Integration Tests

```bash
cd tests
pnpm test:integration
```

**Test Coverage:**
- Vault creation flow
- Agent payment flow
- x402 settlement flow
- Reputation posting flow
- Validation request/submit flow

---

## Success Criteria Checklist

### Contracts
- [ ] All 5 contracts deployed to testnet
- [ ] All contracts initialized
- [ ] VaultFactory can create vaults
- [ ] UserVault can deposit/withdraw
- [ ] UserVault agent_pay works with auth
- [ ] AgentRegistry can register agents
- [ ] ReputationRegistry can post feedback
- [ ] ValidationRegistry can request/submit validations

### Backend
- [ ] Health endpoint returns 200
- [ ] Vault API returns correct data
- [ ] Agent API lists registered agents
- [ ] x402 middleware returns 402 without payment
- [ ] AI yield optimizer returns strategies
- [ ] Blend client loads real pool data
- [ ] Soroswap client returns quotes

### Frontend
- [ ] Landing page loads
- [ ] Wallet connection works
- [ ] Vault creation works
- [ ] Agent authorization works
- [ ] Agent registration works
- [ ] Chat interface queries backend
- [ ] Payment visualization shows tx hash
- [ ] Strategy cards display correctly

### End-to-End
- [ ] User can create vault → deposit → authorize agent
- [ ] Agent can make payment via agent_pay
- [ ] Payment verified on Stellar Explorer
- [ ] Agent identity visible in registry
- [ ] Reputation accumulates over time
- [ ] Full demo runs in <5 minutes

---

## Troubleshooting

### Common Issues

**Issue:** "Contract not found"
- **Fix:** Ensure contract is deployed: `stellar contract id <wasm-path>`

**Issue:** "Insufficient balance"
- **Fix:** Fund account: `stellar keys generate <name> --network testnet --fund`

**Issue:** "Auth failed"
- **Fix:** Ensure correct signer: `--source <correct-identity>`

**Issue:** "Simulation failed"
- **Fix:** Check contract state, verify all init functions called

**Issue:** "USDC not found"
- **Fix:** Use correct testnet USDC SAC address in .env

**Issue:** "x402 middleware returns 402 even with payment"
- **Fix:** Check payment header format, verify signature

**Issue:** "AI returns mock data"
- **Fix:** Set ANTHROPIC_API_KEY in .env

**Issue:** "Blend data unavailable"
- **Fix:** Check testnet pool addresses, may need to use mock data

---

## Performance Benchmarks

Track these metrics during testing:

| Metric | Target | Notes |
|--------|--------|-------|
| Contract deployment | <30s per contract | Testnet variability |
| Vault creation | <10s | Including tx confirmation |
| Agent payment | <5s | Core x402 flow |
| AI query response | <3s | Without payment verification |
| Full x402 flow | <10s | 402 → pay → settle → 200 |
| Frontend page load | <2s | Dashboard |
| Backend API response | <500ms | Cached contract reads |

---

## Next Steps After Testing

1. **Fix any failing tests** — prioritize contract tests, then integration
2. **Record demo video** — 5-minute walkthrough following demo script
3. **Create presentation deck** — architecture diagrams, screenshots, metrics
4. **Deploy to production** — Vercel (frontend) + Railway (backend)
5. **Write documentation** — README, API docs, integration guide
6. **Publish SDK packages** — npm publish for @agenticocean/* packages
7. **Submit to hackathon** — GitHub repo + demo video + live URL

---

**This test flow ensures every component works before the demo. Follow it sequentially for best results.** 🚀
