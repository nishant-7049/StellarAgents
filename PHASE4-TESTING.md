# AgenticOcean — Frontend Testing Checklist

**Status**: Backend ✅ | Frontend ✅ | All 11 pages live

## System URLs
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **Stellar Testnet**: https://stellar.expert/explorer/testnet
- **Docs**: https://agenticoceandocs.vercel.app

---

## Test Plan

### 1. Landing Page (/)

**Open**: http://localhost:3000

**Check**:
- [ ] Hero section with headline and CTA
- [ ] Feature cards (Smart Vaults, Agent Identity, x402 Payments)
- [ ] Architecture section
- [ ] "Launch App" button → redirects to /app
- [ ] "Built for SDF Issue #633" badge
- [ ] Pricing section (0.01 USDC/query)

---

### 2. Dashboard (/app)

**Open**: http://localhost:3000/app

**Check**:
- [ ] Sidebar navigation visible (Dashboard, Vault, Agents, Chat, Portfolio, Register, History, Explorer, Credits)
- [ ] TopNav with wallet connect button
- [ ] Network indicator shows "Testnet"
- [ ] Stats cards load

**Without Wallet Connected**:
- [ ] Shows "Connect Wallet" prompt
- [ ] Clicking connect triggers Freighter

**With Wallet Connected** (requires Freighter browser extension):
- [ ] Shows wallet address
- [ ] Stats cards show data

---

### 3. Vault Page (/vault)

**Open**: http://localhost:3000/vault

**Test Flow 1: No Wallet**:
- [ ] Shows "Connect Wallet" message

**Test Flow 2: Wallet Connected, Has Vault**:
- [ ] Shows vault USDC balance (999.9 USDC for User1)
- [ ] Shows deposit form
- [ ] Shows withdraw form
- [ ] Shows authorized agents list
  - [ ] "YieldBot Alpha" appears with `handle: null` badge
  - [ ] Shows remaining daily limit (9.99 USDC)
  - [ ] Shows total spent (0.01 USDC = 100,000 stroops)

**Deposit Test** (amounts in USDC, 7 decimal stroops):
1. [ ] Enter amount (e.g. 10 USDC)
2. [ ] Click "Deposit"
3. [ ] Freighter prompts for approval
4. [ ] Transaction submitted, balance updates

**Withdraw Test**:
1. [ ] Enter amount (e.g. 5 USDC)
2. [ ] Click "Withdraw"
3. [ ] Balance updates after confirmation

---

### 4. Agents Marketplace (/agents)

**Open**: http://localhost:3000/agents

**Check**:
- [ ] Loads 2 agents from backend
- [ ] "YieldBot Alpha" card displays (Agent #1)
- [ ] "Yield Optimiser" card displays (Agent #2)
- [ ] Each card shows:
  - ID + name
  - `handle: null` (pre-handle agents) or `@handle` badge
  - Owner address (truncated)
  - Status: Active
- [ ] Click agent → shows detail view
- [ ] Detail: pricing (0.01 USDC/query), capabilities, "Write Review" / "Reviews" buttons

---

### 5. Agent Chat (/chat) — x402 Gated

**Open**: http://localhost:3000/chat

**Test Flow 1: No Payment**:
1. [ ] Enter query: "What's the best yield strategy for 1000 USDC?"
2. [ ] Select risk: "moderate"
3. [ ] Click "Ask Agent"
4. [ ] Shows "Preparing payment..." message
5. [ ] Receives 402 response if no vault/funds

**Test Flow 2: With x402 Payment** (requires vault with USDC):
1. [ ] Agent builds vault.agent_pay() invocation
2. [ ] Sends X-PAYMENT header to backend
3. [ ] Backend processes payment via facilitator
4. [ ] Returns yield strategy
5. [ ] UI shows:
   - X402PaymentBanner with tx hash (link to Stellar Expert)
   - Strategy cards grid (4 strategies, moderate risk)
   - Each card: protocol, allocation %, APY, risk badge

**Expected Strategy** (moderate risk, AI-generated):
```json
{
  "strategies": [
    {"protocol": "DeFindex Auto-Compound", "allocation_pct": 35, "estimated_apy": 9.1},
    {"protocol": "Blend Fixed V2",         "allocation_pct": 30, "estimated_apy": 7.2},
    {"protocol": "Ondo USDY",              "allocation_pct": 20, "estimated_apy": 4.8},
    {"protocol": "Soroswap USDC/XLM",     "allocation_pct": 15, "estimated_apy": 12.5}
  ],
  "total_estimated_apy": 8.1
}
```

---

### 6. Portfolio (/portfolio)

**Open**: http://localhost:3000/portfolio

**Check**:
- [ ] Portfolio overview loads
- [ ] Blend positions and APY data visible
- [ ] Rebalance history (if any)
- [ ] "Trigger Rebalance" button available

---

### 7. Register Agent (/register)

**Open**: http://localhost:3000/register

**Check**:
- [ ] Form shows:
  - Agent Name input
  - **Handle input** (3–32 chars, `a-z`/`0-9`/hyphen, unique) ← NEW
  - Agent URI input
  - Vault Address input
  - Agent Signer input
- [ ] Handle availability check (debounced)
- [ ] Handle validation: rejects uppercase, spaces, too short/long
- [ ] Submit → Freighter prompts for signature
- [ ] Agent registered with handle → redirects to /agents
- [ ] New agent appears with `@handle` badge in explorer

---

### 8. Transaction History (/history)

**Open**: http://localhost:3000/history

**Check**:
- [ ] Shows list of transactions for connected wallet
- [ ] Each transaction shows:
  - Type (deposit, withdraw, agent_pay)
  - Amount (in USDC)
  - Timestamp
  - Tx hash (clickable link to Stellar Expert)
- [ ] Filter by type works

---

### 9. ERC-8004 Explorer (/explorer)

**Open**: http://localhost:3000/explorer

**Check**:
- [ ] All registered agents listed
- [ ] Each agent card shows:
  - Sequential ID (#1, #2)
  - `@handle` or `null` badge
  - Owner address
  - Status (Active)
- [ ] Global activity feed (decoded on-chain events)
- [ ] Click agent → goes to /explorer/:id

---

### 10. Agent Profile (/explorer/:id)

**Open**: http://localhost:3000/explorer/1

**Check**:
- [ ] 4 stats cards: Total Queries, USDC Paid, Days Active, Avg/Day
- [ ] Bar chart — Daily query volume (last 30 days, recharts)
- [ ] Area chart — USDC spent via x402 (last 30 days, recharts)
- [ ] Action breakdown — animated bars by payment memo type
- [ ] Transaction history — decoded human-readable descriptions
- [ ] Reputation panel — star rating, score bar, review cards
- [ ] "Demo data" badge if Horizon unavailable (mock data mode)

---

### 11. Credits (/credits)

**Open**: http://localhost:3000/credits

**Check**:
- [ ] Credit balance displayed
- [ ] Top-up / purchase flow

---

## API Testing (Backend)

```bash
# Health check
curl http://localhost:3001/health

# List agents (2 registered)
curl http://localhost:3001/api/agents

# Get specific agent
curl http://localhost:3001/api/agents/1

# Get vault for User1
curl "http://localhost:3001/api/vaults/GADZUB7KFGZH2YLH5RGF2B2ST3KUDMU6TFQ3YAGRXE3X7MQWUIMSWQME"

# Test x402 endpoint (should return 402)
curl http://localhost:3001/api/yield/query?q=test

# Explorer endpoints
curl http://localhost:3001/api/explorer/agents
curl http://localhost:3001/api/explorer/agents/1
curl http://localhost:3001/api/explorer/agents/1/stats
curl http://localhost:3001/api/explorer/activity

# Reputation
curl http://localhost:3001/api/reputation/1/summary

# Stats
curl http://localhost:3001/api/stats
```

---

## Integration Testing — Complete Demo Flow

**Prerequisites**:
- Freighter wallet installed and switched to Stellar Testnet
- Wallet has testnet XLM (from friendbot)

**Steps**:
1. **Landing** → Click "Launch App"
2. **Connect Wallet** → Approve in Freighter
3. **Create Vault** → Sign transaction, wait for confirmation
4. **Deposit** → Add 10 USDC to vault
5. **Authorize Agent** → Add YieldBot Alpha with 1 USDC daily limit
6. **Browse Agents** → View YieldBot Alpha details, check reputation
7. **Chat** → Ask "best yield strategy for 1000 USDC?" (moderate risk)
8. **Payment** → Agent pays 0.01 USDC via vault.agent_pay()
9. **Strategy** → View recommended allocation (4 strategies, ~8.1% APY)
10. **Explorer** → View agent profile, stats charts, tx history
11. **History** → See all transactions with Stellar Expert links
12. **Register** → Register a new agent with unique `@handle`
13. **Explorer** → Verify new agent appears with `@handle` badge

---

## Known Issues / Expected Behavior

- Agents 1 and 2 have `handle: null` — registered before handle system was added
- When Horizon is unavailable, `/explorer/:id/stats` returns seeded mock data (`isMock: true`), shown with "Demo data" badge
- Event poll errors in backend logs — normal until contracts emit events
- Rebalancer "no target strategy" — normal until first yield query runs
- x402 requires vault with USDC balance — user must deposit before agents can pay

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

**Handle validation failing?**
- Must be 3–32 chars, lowercase `a-z`, `0-9`, hyphens only
- No leading/trailing hyphens
- Must be globally unique (call `is_handle_available()` to check)
