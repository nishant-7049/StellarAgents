# Phase 4: Frontend Testing Checklist

**Status**: Backend ✅ | Frontend ✅ | Ready for UI Testing

## System URLs
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **Stellar Testnet**: https://stellar.expert/explorer/testnet

---

## Test Plan

### 1. Landing Page Testing (/)

**Open**: http://localhost:3000

**Check**:
- [ ] Hero section: "Give Your AI Agents **a Wallet** on Stellar"
- [ ] Feature cards visible (Smart Vaults, Agent Identity, x402 Payments)
- [ ] "How It Works" section
- [ ] "Built for SDF Issue #633" badge
- [ ] "Launch App" button works → redirects to /app

**Expected Behavior**:
- Smooth animations on scroll
- Responsive layout
- All links working
- Dark mode styling

---

### 2. Dashboard Testing (/app)

**Open**: http://localhost:3000/app

**Check**:
- [ ] Sidebar navigation visible (Dashboard, Vault, Agents, Chat, Register, History)
- [ ] TopNav with wallet connect button
- [ ] Network indicator shows "Testnet"
- [ ] Dashboard stats cards load

**Without Wallet Connected**:
- [ ] Shows "Connect Wallet" prompt
- [ ] Clicking connect triggers Freighter

**With Wallet Connected** (requires Freighter browser extension):
- [ ] Shows wallet address
- [ ] Stats cards show data

---

### 3. Vault Page Testing (/app/vault)

**Open**: http://localhost:3000/app/vault

**Test Flow 1: No Wallet**:
- [ ] Shows "Connect Wallet" message

**Test Flow 2: Wallet Connected, No Vault**:
- [ ] Shows "Create Vault" card
- [ ] Click "Create Vault" → Freighter prompts for signature
- [ ] After signing → transaction submitted
- [ ] Poll for confirmation → vault created
- [ ] Page refreshes to show vault balance

**Test Flow 3: Wallet Connected, Has Vault**:
- [ ] Shows vault balance (999.9 XLM from Phase 2)
- [ ] Shows deposit form
- [ ] Shows withdraw form
- [ ] Shows authorized agents list
  - [ ] "YieldBot Alpha" appears
  - [ ] Shows remaining daily limit (9.99 XLM)
  - [ ] Shows total spent (0.01 XLM)

**Deposit Test**:
1. [ ] Enter amount (e.g. 10 XLM)
2. [ ] Click "Deposit"
3. [ ] Freighter prompts for approval
4. [ ] Transaction submitted
5. [ ] Balance updates after confirmation

**Withdraw Test**:
1. [ ] Enter amount (e.g. 5 XLM)
2. [ ] Click "Withdraw"
3. [ ] Freighter prompts for approval
4. [ ] Transaction submitted
5. [ ] Balance updates after confirmation

---

### 4. Agents Marketplace Testing (/app/agents)

**Open**: http://localhost:3000/app/agents

**Check**:
- [ ] Loads agent list from backend
- [ ] "YieldBot Alpha" card displays
- [ ] Shows agent details:
  - Name: YieldBot Alpha
  - Owner: GADZUB7K...
  - Vault: CADOUFR...
  - Status: Active
- [ ] Click agent → shows detail view
- [ ] Detail view shows:
  - Agent description
  - Pricing (0.01 USDC/query)
  - Capabilities
  - "Chat with Agent" button

**Expected Data** (from backend):
```json
{
  "id": 1,
  "name": "YieldBot Alpha",
  "owner": "GADZUB7K...",
  "vault_address": "CADOUFR...",
  "agent_signer": "GCULCDA...",
  "is_active": true
}
```

---

### 5. Agent Chat Testing (/app/chat)

**Open**: http://localhost:3000/app/chat

**Test Flow 1: Query Without Payment**:
1. [ ] Enter query: "What's the best yield strategy for 1000 USDC?"
2. [ ] Select risk: "moderate"
3. [ ] Click "Ask Agent"
4. [ ] Shows "Preparing payment..." message
5. [ ] **Expected**: Shows x402 payment banner "Paid 0.01 USDC" (if wallet has funds)
6. [ ] **OR**: Shows "402 Payment Required" if no funds

**Test Flow 2: With x402 Payment** (requires vault with USDC):
1. [ ] Enter query
2. [ ] Agent builds vault.agent_pay() invocation
3. [ ] Signs authorization entry
4. [ ] Sends X-PAYMENT header to backend
5. [ ] Backend processes payment via facilitator
6. [ ] Returns yield strategy
7. [ ] UI shows:
   - [ ] X402PaymentBanner with tx hash
   - [ ] Strategy cards grid
   - [ ] Each card shows: protocol, allocation %, APY, risk level

**Expected Strategy** (moderate risk):
```json
{
  "strategies": [
    {"protocol": "DeFindex Auto-Compound", "allocation_pct": 35, "estimated_apy": 9.1},
    {"protocol": "Blend Fixed V2", "allocation_pct": 30, "estimated_apy": 7.2},
    {"protocol": "Ondo USDY", "allocation_pct": 20, "estimated_apy": 4.8},
    {"protocol": "Soroswap USDC/XLM", "allocation_pct": 15, "estimated_apy": 12.5}
  ],
  "total_estimated_apy": 8.1
}
```

---

### 6. Register Agent Testing (/app/register)

**Open**: http://localhost:3000/app/register

**Check**:
- [ ] Form shows:
  - Agent Name input
  - Agent URI input
  - Vault Address input
  - Agent Signer input
- [ ] Validation works
- [ ] Submit → Freighter prompts
- [ ] Transaction submitted
- [ ] Agent registered
- [ ] Redirects to /app/agents

---

### 7. Transaction History Testing (/app/history)

**Open**: http://localhost:3000/app/history

**Check**:
- [ ] Shows list of transactions
- [ ] Each transaction shows:
  - Type (deposit, withdraw, agent_pay)
  - Amount
  - Timestamp
  - Tx hash (clickable link to Stellar Expert)

---

## API Testing (Backend)

All these should work from terminal:

```bash
# Health check
curl http://localhost:3001/health

# List agents
curl http://localhost:3001/api/agents

# Get specific agent
curl http://localhost:3001/api/agents/1

# Get vault for owner
curl "http://localhost:3001/api/vaults/GADZUB7KFGZH2YLH5RGF2B2ST3KUDMU6TFQ3YAGRXE3X7MQWUIMSWQME"

# Test x402 endpoint (should return 402)
curl http://localhost:3001/api/yield/query?q=test

# Stats
curl http://localhost:3001/api/stats
```

---

## Integration Testing

### Complete Demo Flow (5 minutes)

**Prerequisites**:
- Freighter wallet installed
- Connected to Stellar Testnet
- Wallet has testnet XLM (get from friendbot)

**Steps**:
1. **Landing** → Click "Launch App"
2. **Connect Wallet** → Approve in Freighter
3. **Create Vault** → Sign transaction, wait for confirmation
4. **Deposit** → Add 10 XLM to vault
5. **Authorize Agent** → Add YieldBot Alpha with 1 XLM daily limit
6. **Browse Agents** → View YieldBot Alpha details
7. **Chat** → Ask yield strategy question
8. **Payment** → Agent pays 0.01 XLM via vault.agent_pay()
9. **Strategy** → View recommended allocation
10. **History** → See all transactions

---

## Known Issues / Expected Behavior

✅ **Event poll errors**: Normal debug logs, will clear once contracts emit events
✅ **BigInt serialization**: Fixed with convertBigInts() helper
✅ **x402 requires vault funds**: User must deposit before agents can pay
✅ **Rebalancer "no target strategy"**: Normal until first yield query

---

## Success Criteria

Phase 4 is complete when:
- [ ] All pages load without errors
- [ ] Wallet connection works
- [ ] Vault creation works
- [ ] Deposit/withdraw works
- [ ] Agent registration works
- [ ] Agent chat loads
- [ ] x402 payment flow works (or shows proper 402 error)
- [ ] Transaction history displays

---

## Next Steps After Phase 4

- **Phase 5**: Full E2E testing with real wallet
- **Phase 6**: Polish UI/UX
- **Phase 7**: Demo preparation
- **Phase 8**: Deployment (Vercel + Railway)

---

## Troubleshooting

**Frontend not loading?**
```bash
cd StellarRiseInHackathon/apps/web
pnpm dev
```

**Backend not responding?**
```bash
cd StellarRiseInHackathon/apps/backend
pnpm dev
```

**Contract addresses wrong?**
- Check `.env.local` in apps/web
- Check `.env` in apps/backend
- Verify against DEPLOYMENT.md

**Freighter not detected?**
- Install from: https://www.freighter.app/
- Switch to Testnet in Freighter settings
- Refresh page

