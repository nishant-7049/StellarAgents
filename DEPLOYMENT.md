# AgenticOcean — Testnet Deployment Record

**Network:** Stellar Testnet
**Status:** ✅ All contracts deployed and live
**Last updated:** February 2026

---

## Deployed Contracts

### VaultFactory
- **Address:** `CASU6R7UN2ZOO46WQA6T7TNKIUJK75MNJB2KJFRVMI6FAZHQKUN6CDTW`
- **Status:** ✅ Initialized
- **Vault count:** 2
- **Explorer:** https://stellar.expert/explorer/testnet/contract/CASU6R7UN2ZOO46WQA6T7TNKIUJK75MNJB2KJFRVMI6FAZHQKUN6CDTW

### UserVault WASM
- **Hash:** `27b91b68f5c58464a69efd4ffb4e0a0761ba22da65a774e41fba3fdc7bdaf361`
- **Status:** ✅ Installed (11 KB optimized)
- **Deployed vaults:**
  - User1: `CADOUFRZCSM4GS6DMQLEIJVT6DS3W4N4ZFATVU3AYFMRE6A45ZBSRG3J`
  - User2: `CBUAGWLFKHMVXOOLI32D4HWYCDFKA5LYWHB5XJDC52XMI2YI5PPJZPKZ`

### AgentRegistry (SRC-8004 Identity)
- **Address:** `CC7CSOZE2KA2WVSFIQPJKGNHCETOKK4UCEHT66CGXLNA5ECA4HHPHH7V`
- **Status:** ✅ Initialized
- **Agent count:** 2
- **Explorer:** https://stellar.expert/explorer/testnet/contract/CC7CSOZE2KA2WVSFIQPJKGNHCETOKK4UCEHT66CGXLNA5ECA4HHPHH7V
- **Registered agents:**
  | ID | Name | Handle | Owner |
  |----|------|--------|-------|
  | 1 | YieldBot Alpha | *(pre-handle, null)* | User1 |
  | 2 | Yield Optimiser | *(pre-handle, null)* | User2 |

> **Note:** Agents registered before the handle system was added show `handle: null`. New registrations require a unique `@handle` (3–32 chars, lowercase a-z/0-9/hyphen).

### ReputationRegistry (SRC-8004 Feedback)
- **Address:** `CDC4EGENNTNK5LVBSIHCGMZMPQQQ27FPT4CESNN5G7WZCZBUVRC6HJIZ`
- **Status:** ✅ Initialized
- **Explorer:** https://stellar.expert/explorer/testnet/contract/CDC4EGENNTNK5LVBSIHCGMZMPQQQ27FPT4CESNN5G7WZCZBUVRC6HJIZ
- **Agent 1 reputation:** 3 reviews, avg 4.33/5.00
- **Agent 2 reputation:** 0 reviews

### ValidationRegistry (SRC-8004 Validation)
- **Address:** `CC66BNPZXYYZQFPQHEEHHYLCWA7CWAKSNVJ5UDLTX32URXCOCVUADY3P`
- **Status:** ✅ Initialized
- **Explorer:** https://stellar.expert/explorer/testnet/contract/CC66BNPZXYYZQFPQHEEHHYLCWA7CWAKSNVJ5UDLTX32URXCOCVUADY3P

---

## Test Accounts (Testnet)

| Account | Public Key | Role |
|---------|-----------|------|
| Admin | `GDNHKRDPI3C6QTM4ZQMMH3G4PWMUUSESTCYVOI5G6VOAL5MIPJNYYC27` | Contract deployer |
| Facilitator | `GAKYQJEEG7IPJWGZAESS3YT35RTOAMF6FZ2LVTWDFB7S6RXXHTLC7ZTP` | x402 payment receiver |
| Agent-Signer | `GCULCDARDBS5OV5XLP2APEVZVJMQ6SP6L6EA3AEQ4NOBI2TYJBU64YNI` | AI agent keypair |
| User1 | `GADZUB7KFGZH2YLH5RGF2B2ST3KUDMU6TFQ3YAGRXE3X7MQWUIMSWQME` | Test user (vault owner) |
| User2 | `GDLCSUDUCBLY5Z727TAZ4ZLUTKYM2CC74FM77M3GJ7IA2BYEQRD6CRZ6` | Test user 2 |

Secret keys stored locally in `~/.config/stellar/identity/` — never commit.

---

## Token Configuration

**USDC (Testnet SAC):**
- **Address:** `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
- **Asset:** `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- **Decimals:** 7 (1 USDC = 10,000,000 stroops)

**x402 price:** 0.01 USDC = 100,000 stroops per yield query

---

## Contract Sizes (Optimized WASM)

| Contract | Size |
|----------|------|
| vault-factory.wasm | 3.2 KB |
| user-vault.wasm | 11 KB |
| agent-registry.wasm | 6.8 KB |
| reputation-registry.wasm | 4.9 KB |
| validation-registry.wasm | 5.5 KB |
| **Total** | **~32 KB** |

---

## Phase Test Results

### Phase 2: Contract Tests ✅

| Test | Result |
|------|--------|
| 2.1 Create UserVault via factory | ✅ vault_created event emitted |
| 2.2 Deposit USDC to vault | ✅ transfer + deposit events |
| 2.3 Authorize agent with daily limit | ✅ agent_added event |
| 2.4 `agent_pay()` — x402 core | ✅ 0.01 USDC paid, policy enforced |
| 2.5 Register agent in AgentRegistry | ✅ Agent #1 "YieldBot Alpha" |
| 2.6 Post feedback to ReputationRegistry | ✅ 5/5 score, avg updated |
| 2.7 ValidationRegistry initialized | ✅ Deployed and live |

**x402 payment test (2.4) detail:**
- Agent: `GCULCDAR...`
- Pay to: Facilitator
- Amount: 0.01 USDC (100,000 stroops)
- Memo: `test_x402_001`
- Vault balance after: 999.9 USDC ✅
- Agent remaining limit: 9.99 USDC/day ✅
- Total spent tracking: 100,000 stroops ✅

### Phase 3: Backend Integration ✅

**Status:** Complete — all endpoints live on port 3001

| Endpoint | Status |
|----------|--------|
| `GET /health` | ✅ 200 OK |
| `GET /api/agents` | ✅ Returns 2 agents |
| `GET /api/agents/:id` | ✅ Full agent details |
| `GET /api/vaults/:owner` | ✅ USDC balance + agent policies |
| `GET /api/yield/query` | ✅ 402 → pay → 200 (x402 working) |
| `GET /api/explorer/agents` | ✅ Registry list with parsed agentUri |
| `GET /api/explorer/agents/:id/stats` | ✅ 30-day stats + action breakdown |
| `GET /api/explorer/activity` | ✅ Decoded global activity |
| `GET /api/portfolio` | ✅ Blend positions + APY |
| `GET /api/reputation/:id/summary` | ✅ Avg score + review count |
| `GET /api/stats` | ✅ Platform-wide metrics |

Services running:
- ✅ Express 5 on port 3001
- ✅ Event indexer (30s polling)
- ✅ Rebalancer cron (5 min)
- ✅ MongoDB connection (Mongoose)
- ✅ All 3 @agenticocean SDKs loaded

### Phase 4: Frontend Integration ✅

**Status:** All pages live on port 3000

| Page | Route | Status |
|------|-------|--------|
| Landing | `/` | ✅ |
| Dashboard | `/app` | ✅ |
| Vault | `/vault` | ✅ |
| Agents marketplace | `/agents` | ✅ |
| Chat (x402 gated) | `/chat` | ✅ |
| Portfolio | `/portfolio` | ✅ |
| Register agent | `/register` | ✅ |
| Transaction history | `/history` | ✅ |
| ERC-8004 Explorer | `/explorer` | ✅ |
| Agent profile | `/explorer/:id` | ✅ |
| Credits | `/credits` | ✅ |

Build: `pnpm --filter @agentnet/web build` → clean (all 11 routes compile, no errors)

### Phase 5: Feature Additions ✅

| Feature | Status |
|---------|--------|
| Multi-LLM provider support (Claude / Gemini / Groq / xAI, auto-detected from key prefix) | ✅ |
| Agent handle system — ENS-like unique `@handle` per agent | ✅ |
| `get_agent_by_handle()` + `is_handle_available()` on-chain | ✅ |
| `transfer_agent()` — handle travels with agent on ownership transfer | ✅ |
| Explorer agent profile — recharts bar + area charts, 30-day stats | ✅ |
| Explorer action breakdown — animated bars by x402 memo type | ✅ |
| `GET /api/explorer/agents/:id/stats` backend endpoint | ✅ |
| Gitbook docs site deployed → agenticoceandocs.vercel.app | ✅ |

---

## Agent Registry Contract — Handle System

The `AgentRegistry` contract was updated to add ENS-like unique handles:

```rust
pub fn register(
    env: Env,
    owner: Address,
    name: String,
    handle: String,        // NEW — globally unique, first-come-first-served
    agent_uri: String,
    vault_address: Address,
    agent_signer: Address,
) -> Result<u32, RegistryError>
```

**Handle rules:** 3–32 chars, lowercase `a-z`, `0-9`, hyphens only. No leading/trailing hyphens.

**New error codes:**

| Code | Name | Meaning |
|------|------|---------|
| 5 | `HandleAlreadyTaken` | Another agent owns this handle |
| 6 | `HandleTooShort` | Fewer than 3 characters |
| 7 | `HandleTooLong` | More than 32 characters |
| 8 | `HandleInvalidChars` | Uppercase, spaces, or special chars |

**New read functions:**
- `get_agent_by_handle(handle)` → `AgentInfo`
- `is_handle_available(handle)` → `bool`
- `transfer_agent(owner, agentId, newOwner)` — handle stays with agent

---

## Known Issues / Notes

- Agents registered before the handle system (IDs 1 and 2) have `handle: null` — this is expected
- When Horizon is unavailable, `/api/explorer/agents/:id/stats` returns seeded mock data (`isMock: true`), shown in the UI with a "Demo data" badge
- The USDC SAC address changed from the native XLM SAC used in initial tests — all production config uses the USDC address above

---

## Security Notes

⚠️ All keypairs are Stellar Testnet only — do not reuse on mainnet.

🔐 For production:
- Regenerate all keypairs with hardware wallet backing
- Audit all 5 contracts before mainnet deployment
- Set up Horizon + RPC monitoring and alerts
- Implement key rotation for the facilitator

---

## Resources

- [Stellar Expert (Testnet)](https://stellar.expert/explorer/testnet)
- [Stellar Laboratory](https://lab.stellar.org/)
- [Soroban Docs](https://docs.stellar.org/build/smart-contracts)
- [AgenticOcean Docs](https://agenticoceandocs.vercel.app)
- [TEST_FLOW.md](./TEST_FLOW.md)
