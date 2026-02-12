# x402 Protocol Specification for Stellar — AgentNet

> **Verified on Stellar Testnet** — 2026-02-12
> All addresses, flows, and transaction hashes are real testnet data.
> Soroban SDK: v25.0.2 | Stellar SDK: v13.3.0

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Testnet Deployment Addresses](#testnet-deployment-addresses)
3. [x402 Protocol Flow](#x402-protocol-flow)
4. [SorobanAuthorizationEntry Signing](#sorobanauthorizationentry-signing)
5. [Smart Contract Architecture](#smart-contract-architecture)
6. [Facilitator Settlement](#facilitator-settlement)
7. [Rebalancing Engine](#rebalancing-engine)
8. [ERC-8004 Agent Registry](#erc-8004-agent-registry)
9. [Security Model](#security-model)
10. [Verified Test Results](#verified-test-results)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AgentNet System Architecture                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    HTTP 402     ┌──────────────┐                 │
│  │ AI Agent │ ──────────────> │   Backend    │                 │
│  │ (Browser │ <────────────── │  (Express)   │                 │
│  │  or Bot) │   X-PAYMENT     │  port 3001   │                 │
│  └──────────┘    header       └──────┬───────┘                 │
│       │                              │                          │
│       │ Freighter                    │ REST API                 │
│       │ sign                         │                          │
│       v                              v                          │
│  ┌──────────┐              ┌──────────────────┐                │
│  │ NextJS   │              │   x402 Middleware │                │
│  │ Frontend │              │  + Facilitator   │                │
│  │ :3000    │              └────────┬─────────┘                │
│  └──────────┘                       │                          │
│                                     │ Soroban RPC              │
│                                     v                          │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              Stellar Testnet (Soroban)               │       │
│  │                                                      │       │
│  │  ┌──────────────┐  ┌─────────────┐  ┌───────────┐  │       │
│  │  │ VaultFactory │  │  UserVault  │  │  Agent    │  │       │
│  │  │  (deployer)  │──│ (C-account) │  │ Registry  │  │       │
│  │  └──────────────┘  └──────┬──────┘  │ (ERC-8004)│  │       │
│  │                           │         └───────────┘  │       │
│  │                    USDC transfer                    │       │
│  │                           │                         │       │
│  │                    ┌──────v──────┐                  │       │
│  │                    │  USDC SAC   │                  │       │
│  │                    │ (7 decimals)│                  │       │
│  │                    └─────────────┘                  │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────┐                   │
│  │          DeFi Integration Layer          │                   │
│  │  Blend Protocol (lending) + Soroswap    │                   │
│  │  (AMM) + Ondo USDY + DeFindex vaults   │                   │
│  └─────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testnet Deployment Addresses

| Component | Address | Type |
|-----------|---------|------|
| **VaultFactory** | `CBFBPLK7HP2UKIRFH26E4II2I3DWSW77SK6JRHAQ7CF3KDJEMIW56BTC` | Soroban Contract |
| **AgentRegistry** | `CCL3IXVENKKLSBMPSZLT5JQXXSY6S7WAG2RBWVN4RHZOM3ZCP6SIIKA5` | Soroban Contract |
| **USDC SAC** | `CAHZHQLO2Q2RBGC6RQGPVPASWUB4RJKKRYRTHBC2G6GINWJJUDADZWA2` | Stellar Asset Contract |
| **Demo Vault** | `CBIT2CL7N32AXFS66S3E5J3O3E33GIBSS4UX3VCOHB7YZKDLDHU52RKR` | UserVault Instance |
| **Vault WASM Hash** | `9ffd0b845f91444c7e7186de67646c323241b62c77533a81b26832e10f32ddfa` | WASM Install Hash |

### Keypairs (Testnet Only)

| Role | Public Key | Purpose |
|------|-----------|---------|
| **Admin** | `GBT3KXP3VYIUDRJEEVL3BKMD7T5U2UQVGAAIADMDKPTIIP5TWYH6TAOB` | Contract deployer & vault owner |
| **Facilitator** | `GB4WBZZRI3RWJI7IUBOMO4R7SILFN2IWNXRWTLIGM7E7ZF3YV6N5HNME` | x402 settlement (pays XLM fees) |
| **Agent Signer** | `GBJCC5E3IK7EI6PAVQ5LZ2L3CU2G4EKGJBULIM776LS5DBVPVHXBQBYE` | AI agent identity |
| **USDC Issuer** | `GCBI6DP6BI4PDQHDVP5N2KKM2MOEUDT7MGV4PYOQYGIKKWFS7MCBDAKZ` | Test USDC asset issuer |

### Stellar Expert Links

- [VaultFactory](https://stellar.expert/explorer/testnet/contract/CBFBPLK7HP2UKIRFH26E4II2I3DWSW77SK6JRHAQ7CF3KDJEMIW56BTC)
- [AgentRegistry](https://stellar.expert/explorer/testnet/contract/CCL3IXVENKKLSBMPSZLT5JQXXSY6S7WAG2RBWVN4RHZOM3ZCP6SIIKA5)
- [Demo Vault](https://stellar.expert/explorer/testnet/contract/CBIT2CL7N32AXFS66S3E5J3O3E33GIBSS4UX3VCOHB7YZKDLDHU52RKR)
- [Verified x402 Payment Tx](https://stellar.expert/explorer/testnet/tx/4ddcba3d8565a661a88bf9dff6daf2977770cce8d3d69c694de966320fc30dc1)

---

## x402 Protocol Flow

### Sequence Diagram

```
  AI Agent              Backend (x402 MW)        Facilitator         Soroban RPC          UserVault
     │                       │                       │                    │                    │
     │  GET /api/yield/query │                       │                    │                    │
     │  (no X-PAYMENT)       │                       │                    │                    │
     │──────────────────────>│                       │                    │                    │
     │                       │                       │                    │                    │
     │  402 Payment Required │                       │                    │                    │
     │  {scheme, amount,     │                       │                    │                    │
     │   payTo, asset}       │                       │                    │                    │
     │<──────────────────────│                       │                    │                    │
     │                       │                       │                    │                    │
     │ [Build agent_pay()    │                       │                    │                    │
     │  invocation]          │                       │                    │                    │
     │──────────────────────────────────────────────────────────────────>│                    │
     │                       │                       │    simulateTx      │                    │
     │<──────────────────────────────────────────────────────────────────│                    │
     │ [Get auth entries +   │                       │                    │                    │
     │  footprint from sim]  │                       │                    │                    │
     │                       │                       │                    │                    │
     │ [authorizeEntry()     │                       │                    │                    │
     │  sign with agent key] │                       │                    │                    │
     │                       │                       │                    │                    │
     │ [assembleTransaction  │                       │                    │                    │
     │  with signed auth]    │                       │                    │                    │
     │                       │                       │                    │                    │
     │  GET /api/yield/query │                       │                    │                    │
     │  X-PAYMENT: <base64>  │                       │                    │                    │
     │  {signedAuthEntry,    │                       │                    │                    │
     │   assembledTxXdr}     │                       │                    │                    │
     │──────────────────────>│                       │                    │                    │
     │                       │  settlePayment()      │                    │                    │
     │                       │──────────────────────>│                    │                    │
     │                       │                       │ fromXDR(txXdr)     │                    │
     │                       │                       │ sign(facilitator)  │                    │
     │                       │                       │──────────────────>│                    │
     │                       │                       │  sendTransaction   │                    │
     │                       │                       │                    │ agent_pay()        │
     │                       │                       │                    │───────────────────>│
     │                       │                       │                    │ require_auth(agent)│
     │                       │                       │                    │ check policy       │
     │                       │                       │                    │ transfer USDC      │
     │                       │                       │                    │<───────────────────│
     │                       │                       │<──────────────────│                    │
     │                       │                       │  txHash            │                    │
     │                       │<──────────────────────│                    │                    │
     │                       │  {success, txHash}    │                    │                    │
     │  200 OK               │                       │                    │                    │
     │  X-PAYMENT-RESPONSE   │                       │                    │                    │
     │  {strategies, x402}   │                       │                    │                    │
     │<──────────────────────│                       │                    │                    │
```

### Step 1: Discovery (402 Response)

When a client requests a paid resource without an `X-PAYMENT` header:

```http
GET /api/yield/query?q=best+yield HTTP/1.1
Host: localhost:3001
```

Response with real testnet addresses:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "accepts": [{
    "scheme": "stellar-vault",
    "network": "stellar:testnet",
    "asset": "CAHZHQLO2Q2RBGC6RQGPVPASWUB4RJKKRYRTHBC2G6GINWJJUDADZWA2",
    "amount": "100000",
    "payTo": "GB4WBZZRI3RWJI7IUBOMO4R7SILFN2IWNXRWTLIGM7E7ZF3YV6N5HNME",
    "maxTimeoutSeconds": 60,
    "description": "AI-powered DeFi yield optimization query"
  }]
}
```

### Step 2: Agent Builds Payment

The agent (client):
1. Simulates `vault.agent_pay()` via Soroban RPC to get the `SorobanAuthorizationEntry`
2. Signs the auth entry with `authorizeEntry(entry, agentKeypair, validUntilLedger, networkPassphrase)`
3. Replaces the unsigned auth in the simulation result with the signed one
4. Assembles the full transaction (capturing the correct footprint)
5. Encodes as `X-PAYMENT` header

```http
GET /api/yield/query?q=best+yield&risk=moderate HTTP/1.1
Host: localhost:3001
X-PAYMENT: eyJ4NDAyVmVyc2lvbiI6MSwic2NoZW1lIjoic3RlbGxhci12YXVsdCIs...
```

The decoded `X-PAYMENT` payload:

```json
{
  "x402Version": 1,
  "scheme": "stellar-vault",
  "network": "stellar:testnet",
  "payload": {
    "vaultContract": "CBIT2CL7N32AXFS66S3E5J3O3E33GIBSS4UX3VCOHB7YZKDLDHU52RKR",
    "agentId": 1,
    "agentSigner": "GBJCC5E3IK7EI6PAVQ5LZ2L3CU2G4EKGJBULIM776LS5DBVPVHXBQBYE",
    "payTo": "GB4WBZZRI3RWJI7IUBOMO4R7SILFN2IWNXRWTLIGM7E7ZF3YV6N5HNME",
    "amount": "100000",
    "asset": "CAHZHQLO2Q2RBGC6RQGPVPASWUB4RJKKRYRTHBC2G6GINWJJUDADZWA2",
    "memo": "x402_m4abc123",
    "signedAuthEntry": "<base64-encoded SorobanAuthorizationEntry XDR>",
    "assembledTxXdr": "<base64-encoded assembled Transaction XDR>",
    "expirationLedger": 978497
  }
}
```

### Step 3: Settlement

The facilitator:
1. Deserializes the pre-assembled transaction from `assembledTxXdr`
2. Signs as source account (pays XLM network fees)
3. Submits to Soroban RPC
4. Polls for confirmation (with Horizon fallback for XDR parse errors)

### Step 4: Response

```http
HTTP/1.1 200 OK
X-PAYMENT-RESPONSE: {"txHash":"4ddcba3d...","network":"stellar:testnet"}
Content-Type: application/json

{
  "query": "best yield",
  "risk_tolerance": "moderate",
  "strategies": [
    {
      "protocol": "DeFindex Auto-Compound",
      "action": "Deposit vault",
      "allocation_pct": 35,
      "estimated_apy": 9.1,
      "risk_level": "moderate",
      "details": "Auto-compounds Blend yields"
    },
    ...
  ],
  "total_estimated_apy": 8.1,
  "summary": "Balanced: lending core + vault optimization + small LP kicker.",
  "x402": {
    "txHash": "4ddcba3d8565a661a88bf9dff6daf2977770cce8d3d69c694de966320fc30dc1",
    "payer": "CBIT2CL7N32AXFS66S3E5J3O3E33GIBSS4UX3VCOHB7YZKDLDHU52RKR",
    "agentId": 1
  }
}
```

---

## SorobanAuthorizationEntry Signing

### Critical Implementation Detail

The agent MUST sign the `SorobanAuthorizationEntry` using `authorizeEntry()` from `@stellar/stellar-sdk`. The unsigned entries from simulation have `sorobanCredentialsSourceAccount` credentials; signing converts them to `sorobanCredentialsAddress` with the agent's Ed25519 signature.

```typescript
import { authorizeEntry, Keypair, Networks } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";

// 1. Simulate to get auth entries
const sim = await rpc.simulateTransaction(tx);
const authEntries = sim.result?.auth || [];

// 2. Sign the auth entry with agent's key
const signedAuth = await authorizeEntry(
  authEntries[0],
  agentKeypair,              // Keypair
  sim.latestLedger + 1000,   // Valid for ~83 minutes
  Networks.TESTNET,
);

// 3. CRITICAL: Replace auth in sim BEFORE assembling
sim.result.auth = [signedAuth];

// 4. Assemble — this captures the footprint matching the signed nonce
const assembled = assembleTransaction(tx, sim).build();
```

### Why assembledTxXdr is Required

Each `SorobanAuthorizationEntry` contains a **nonce** for anti-replay protection. The simulation includes this nonce's storage key in the transaction footprint. If the facilitator re-simulates, it gets a **different** nonce, causing a footprint mismatch and `INVOKE_HOST_FUNCTION_TRAPPED` on-chain.

By including the pre-assembled transaction in the header, the facilitator uses the exact footprint that matches the signed auth entry's nonce.

### SorobanAuthorizationEntry Structure

```
SorobanAuthorizationEntry
├── credentials: SorobanCredentials (union)
│   └── sorobanCredentialsAddress
│       ├── address: agent's Stellar address
│       ├── nonce: i64 (random, for anti-replay)
│       ├── signatureExpirationLedger: u32
│       └── signature: ScVal (Ed25519 signature)
└── rootInvocation: SorobanAuthorizedInvocation
    ├── function: sorobanAuthorizedFunctionTypeContractFn
    │   ├── contractAddress: vault contract
    │   ├── functionName: "agent_pay"
    │   └── args: [agent, payTo, amount, memo]
    └── subInvocations: [
        └── token.transfer(vault → payTo, amount)
    ]
```

---

## Smart Contract Architecture

### UserVault (C-Account Pattern)

The UserVault is a **per-user smart account** that holds USDC and enforces agent spending policies on-chain.

```
UserVault Storage Layout
├── instance()
│   ├── Owner: Address (vault owner)
│   ├── UsdcToken: Address (USDC SAC)
│   ├── Factory: Address (VaultFactory)
│   ├── AgentCount: u32
│   ├── AgentList: Vec<Address>
│   ├── Initialized: bool
│   ├── TotalSpent: i128 (lifetime USDC)
│   └── TxNonce: u64
└── persistent()
    └── AgentPolicy(Address): AgentPolicy
        ├── agent_address: Address
        ├── daily_limit: i128 (max per 24h)
        ├── spent_today: i128
        ├── last_reset: u64 (ledger timestamp)
        ├── allowed_destinations: Vec<Address>
        └── is_active: bool
```

**Key Functions:**

| Function | Auth | Description |
|----------|------|-------------|
| `__constructor(owner, usdc, factory)` | VaultFactory | Called during deploy_v2 |
| `deposit(from, amount)` | from | Anyone can deposit USDC |
| `withdraw(owner, amount)` | owner | Owner-only withdrawal |
| `add_agent(owner, agent, limit, dests)` | owner | Authorize an agent |
| `remove_agent(owner, agent)` | owner | Deactivate agent |
| `agent_pay(agent, pay_to, amount, memo)` | **agent** | x402 payment entry point |
| `balance()` | none | View: USDC balance |
| `remaining_limit(agent)` | none | View: agent's daily limit remaining |

### VaultFactory

Deploys UserVault instances using `deploy_v2()` with deterministic addressing.

| Function | Description |
|----------|-------------|
| `initialize(admin, wasm_hash, usdc)` | One-time setup |
| `create_vault(owner)` | Deploy new vault for owner (one per user) |
| `get_vault(owner)` | Get vault address for owner |
| `vault_count()` | Total vaults deployed |

### Contract Authorization Model

```
Transaction Source: Facilitator (pays XLM fees)
    │
    └── invokeHostFunction: vault.agent_pay(agent, payTo, amount, memo)
        │
        ├── SorobanAuthorizationEntry #1 (agent's signed entry):
        │   credentials: sorobanCredentialsAddress(agent)
        │   rootInvocation: agent_pay(...)
        │       └── subInvocation: token.transfer(vault, payTo, amount)
        │
        └── Contract-Invoker Auth (automatic):
            vault calls token.transfer() as contract invoker
            → Soroban auto-authorizes because vault IS the caller
```

The vault does NOT need `CustomAccountInterface`. When `agent_pay()` calls `token.transfer(vault_address, payTo, amount)`, the vault is the contract invoker — Soroban auto-authorizes this. Only the agent needs explicit auth via `SorobanAuthorizationEntry`.

---

## Facilitator Settlement

### Settlement Algorithm

```
settlePayment(payload):
  1. IF payload.assembledTxXdr exists:
       tx = TransactionBuilder.fromXDR(assembledTxXdr)  // Pre-assembled by agent
     ELSE:
       tx = buildAndSimulate(agent_pay args)             // Legacy fallback

  2. tx.sign(facilitatorKeypair)    // Facilitator pays XLM fees

  3. result = rpc.sendTransaction(tx)
     IF result.status != "PENDING": return error

  4. TRY:
       poll rpc.getTransaction(hash) until SUCCESS/FAILED
     CATCH xdrParseError:
       fallback to Horizon API: GET /transactions/{hash}

  5. Return { success: true, txHash: hash }
```

### Fee Structure

| Fee | Paid By | Amount |
|-----|---------|--------|
| XLM network fee | Facilitator | ~0.003 XLM (25,566 stroops) |
| USDC service fee | Agent's vault | 0.01 USDC (100,000 stroops) per query |

---

## Rebalancing Engine

```
┌──────────────────────────────────────────────────┐
│              Rebalancer (cron: */5 min)           │
│                                                   │
│  1. Fetch pool data from Blend + Soroswap        │
│  2. Compare current allocation vs target          │
│  3. If drift > 5% threshold:                      │
│     a. Withdraw from over-allocated pools          │
│     b. Supply to under-allocated pools             │
│     c. Swap via Soroswap if cross-asset           │
│  4. Log rebalance event                           │
│                                                   │
│  Target allocation set by AI yield optimizer      │
│  after each x402-paid query                       │
└──────────────────────────────────────────────────┘
```

### DeFi Integration

| Protocol | SDK | Integration | Status |
|----------|-----|-------------|--------|
| **Blend Protocol** | `@blend-capital/blend-sdk@2.2.0` | Pool data, supply/withdraw | Mock data (our testnet USDC differs from Blend's) |
| **Soroswap** | `@soroswap/sdk@0.3.8` | Swap quotes, LP data | Mock data (requires API key) |
| **Ondo USDY** | — | APY reference | Hardcoded rates |
| **DeFindex** | — | Vault strategies | Hardcoded rates |

> **Note**: Custom testnet USDC cannot be used with existing Blend/Soroswap pools, as they have fixed reserve lists. The integration architecture is fully built with graceful mock data fallbacks. Production deployment would use the same USDC address as the DeFi protocols.

---

## ERC-8004 Agent Registry

The AgentRegistry implements an **ERC-8004-equivalent on Stellar** — a registry of AI agent identities as on-chain NFTs.

### Registry Structure

```
AgentInfo (per registered agent):
├── id: u32 (sequential token ID)
├── owner: Address
├── name: String ("Yield Optimizer v1")
├── agent_uri: String (JSON capabilities)
├── vault_address: Address
├── agent_signer: Address
├── registered_at: u64 (ledger timestamp)
└── is_active: bool
```

### ERC-8004 Mapping

| ERC-8004 Field | Our Field | Notes |
|----------------|-----------|-------|
| tokenId | id | Sequential u32 |
| owner | owner | Stellar Address |
| agentURI | agent_uri | JSON capabilities string |
| name | name | Human-readable |
| — | vault_address | Stellar extension |
| — | agent_signer | Stellar extension |

### Registered Agents (Testnet)

| ID | Name | Agent URI | Status |
|----|------|-----------|--------|
| 1 | Yield Optimizer v1 | `yield-optimizer-v1-x402` | Active |

---

## Security Model

### On-Chain Enforcement

1. **Agent spending limits**: 24-hour rolling window (`daily_limit`, `spent_today`, `last_reset`) enforced in every `agent_pay()` call. Resets automatically after 86,400 seconds.

2. **Destination whitelisting**: Each agent has an `allowed_destinations: Vec<Address>`. Empty = any destination allowed. Non-empty = strict whitelist.

3. **Auth entry expiration**: `signatureExpirationLedger` prevents replay of stale entries. Set to `latestLedger + 1000` (~83 minutes).

4. **Nonce anti-replay**: Each signed auth entry has a unique random nonce. Used nonces are tracked on-chain.

5. **Owner override**: Vault owner can call `remove_agent()` at any time to instantly revoke an agent's access.

### Facilitator Trust Model

The facilitator is a **semi-trusted intermediary** that:
- Receives pre-assembled transactions from agents
- Signs as source account (pays XLM fees)
- Submits to the network
- **Cannot modify** the agent's signed auth entry
- **Cannot change** the payment destination or amount
- **Cannot access** vault funds without a valid agent auth entry

### Amount Format

All USDC amounts are in **stroops** (7 decimal places on Stellar):

| Human | Stroops |
|-------|---------|
| 1 USDC | 10,000,000 |
| 0.01 USDC | 100,000 |
| 0.001 USDC | 10,000 |

---

## Verified Test Results

### x402 End-to-End Test (2026-02-12)

```
  PASS  402 without payment: Status 402
  PASS  200 with payment: Status 200
  PASS  Has strategies: 4 strategies returned
  PASS  Has x402 proof: 4ddcba3d8565a661a88bf9dff6daf2977770cce8d3d69c694de966320fc30dc1
  PASS  Vault balance decreased: Delta: 100000 (expected: 100000)
  PASS  Facilitator received USDC: Delta: 100000 (expected: 100000)
  PASS  X-PAYMENT-RESPONSE header present: present

  ALL TESTS PASSED — x402 payment flow verified end-to-end!
```

### On-Chain Verification

After all tests:
- Vault USDC balance: 99.97 USDC (started at 100, three x402 payments of 0.01 each)
- Facilitator USDC balance: 1000.03 USDC (received three payments)
- Total spent (vault counter): 300,000 stroops (0.03 USDC)
- Transactions visible on [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBIT2CL7N32AXFS66S3E5J3O3E33GIBSS4UX3VCOHB7YZKDLDHU52RKR)

### Test Suites

| Suite | Framework | Tests | Status |
|-------|-----------|-------|--------|
| Soroban Contracts | `cargo test` | 14 | PASS |
| Backend Unit | Vitest | 15 | PASS |
| Backend Integration | Vitest | 14 | PASS |
| x402 E2E | Custom script | 7 | PASS |
| **Total** | | **50** | **ALL PASS** |

---

## Running the Tests

```bash
# Contract tests
cd contracts && cargo test --workspace

# Backend unit tests
pnpm test:unit

# Backend integration tests
pnpm test:integration

# x402 end-to-end test (requires backend running)
pnpm dev:backend  # terminal 1
npx tsx scripts/test-x402-e2e.ts  # terminal 2 (from apps/backend/)
```

---

## File Reference

| File | Purpose |
|------|---------|
| `apps/backend/src/x402/header-builder.ts` | Agent-side: build X-PAYMENT header |
| `apps/backend/src/x402/facilitator.ts` | Facilitator: settle x402 payments |
| `apps/backend/src/middleware/x402.middleware.ts` | Express middleware: 402/settle gate |
| `apps/backend/src/ai/yield-optimizer.ts` | AI engine: Claude-powered yield strategies |
| `apps/backend/src/defi/blend-client.ts` | Blend Protocol SDK integration |
| `apps/backend/src/defi/soroswap-client.ts` | Soroswap DEX SDK integration |
| `apps/backend/src/defi/rebalancer.ts` | Cron-based portfolio rebalancer |
| `contracts/user-vault/src/` | UserVault smart contract (Rust) |
| `contracts/vault-factory/src/` | VaultFactory smart contract (Rust) |
| `contracts/agent-registry/src/` | AgentRegistry smart contract (Rust) |
| `scripts/test-x402-e2e.ts` | x402 end-to-end test script |

---

*Built for Stellar Development Foundation Issue #633: AI Agent Wallets*
*Hackathon: February 20, 2026*
