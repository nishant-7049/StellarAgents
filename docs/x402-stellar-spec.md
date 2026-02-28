# x402 Protocol Specification for Stellar — AgenticOcean

> **Verified on Stellar Testnet** — February 2026
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
│                  AgenticOcean System Architecture                │
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
│  │ NextJS   │              │  x402 Middleware  │                │
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
│  │                                                      │       │
│  │  ┌─────────────────────────────────────────┐         │       │
│  │  │  ReputationRegistry · ValidationRegistry │         │       │
│  │  └─────────────────────────────────────────┘         │       │
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
| **VaultFactory** | `CASU6R7UN2ZOO46WQA6T7TNKIUJK75MNJB2KJFRVMI6FAZHQKUN6CDTW` | Soroban Contract |
| **AgentRegistry** | `CC7CSOZE2KA2WVSFIQPJKGNHCETOKK4UCEHT66CGXLNA5ECA4HHPHH7V` | Soroban Contract |
| **ReputationRegistry** | `CDC4EGENNTNK5LVBSIHCGMZMPQQQ27FPT4CESNN5G7WZCZBUVRC6HJIZ` | Soroban Contract |
| **ValidationRegistry** | `CC66BNPZXYYZQFPQHEEHHYLCWA7CWAKSNVJ5UDLTX32URXCOCVUADY3P` | Soroban Contract |
| **USDC SAC** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | Stellar Asset Contract |
| **User1 Vault** | `CADOUFRZCSM4GS6DMQLEIJVT6DS3W4N4ZFATVU3AYFMRE6A45ZBSRG3J` | UserVault Instance |
| **User2 Vault** | `CBUAGWLFKHMVXOOLI32D4HWYCDFKA5LYWHB5XJDC52XMI2YI5PPJZPKZ` | UserVault Instance |
| **UserVault WASM Hash** | `27b91b68f5c58464a69efd4ffb4e0a0761ba22da65a774e41fba3fdc7bdaf361` | WASM Install Hash |

### Keypairs (Testnet Only)

| Role | Public Key | Purpose |
|------|-----------|---------|
| **Admin** | `GDNHKRDPI3C6QTM4ZQMMH3G4PWMUUSESTCYVOI5G6VOAL5MIPJNYYC27` | Contract deployer |
| **Facilitator** | `GAKYQJEEG7IPJWGZAESS3YT35RTOAMF6FZ2LVTWDFB7S6RXXHTLC7ZTP` | x402 payment receiver |
| **Agent Signer** | `GCULCDARDBS5OV5XLP2APEVZVJMQ6SP6L6EA3AEQ4NOBI2TYJBU64YNI` | AI agent keypair |
| **User1** | `GADZUB7KFGZH2YLH5RGF2B2ST3KUDMU6TFQ3YAGRXE3X7MQWUIMSWQME` | Test user (vault owner) |
| **User2** | `GDLCSUDUCBLY5Z727TAZ4ZLUTKYM2CC74FM77M3GJ7IA2BYEQRD6CRZ6` | Test user 2 |

### Stellar Expert Links

- [VaultFactory](https://stellar.expert/explorer/testnet/contract/CASU6R7UN2ZOO46WQA6T7TNKIUJK75MNJB2KJFRVMI6FAZHQKUN6CDTW)
- [AgentRegistry](https://stellar.expert/explorer/testnet/contract/CC7CSOZE2KA2WVSFIQPJKGNHCETOKK4UCEHT66CGXLNA5ECA4HHPHH7V)
- [ReputationRegistry](https://stellar.expert/explorer/testnet/contract/CDC4EGENNTNK5LVBSIHCGMZMPQQQ27FPT4CESNN5G7WZCZBUVRC6HJIZ)
- [ValidationRegistry](https://stellar.expert/explorer/testnet/contract/CC66BNPZXYYZQFPQHEEHHYLCWA7CWAKSNVJ5UDLTX32URXCOCVUADY3P)
- [User1 Vault](https://stellar.expert/explorer/testnet/contract/CADOUFRZCSM4GS6DMQLEIJVT6DS3W4N4ZFATVU3AYFMRE6A45ZBSRG3J)

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

Response:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "accepts": [{
    "scheme": "stellar-vault",
    "network": "stellar:testnet",
    "asset": "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    "amount": "100000",
    "payTo": "GAKYQJEEG7IPJWGZAESS3YT35RTOAMF6FZ2LVTWDFB7S6RXXHTLC7ZTP",
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

The decoded `X-PAYMENT` payload:

```json
{
  "x402Version": 1,
  "scheme": "stellar-vault",
  "network": "stellar:testnet",
  "payload": {
    "vaultContract": "CADOUFRZCSM4GS6DMQLEIJVT6DS3W4N4ZFATVU3AYFMRE6A45ZBSRG3J",
    "agentId": 1,
    "agentSigner": "GCULCDARDBS5OV5XLP2APEVZVJMQ6SP6L6EA3AEQ4NOBI2TYJBU64YNI",
    "payTo": "GAKYQJEEG7IPJWGZAESS3YT35RTOAMF6FZ2LVTWDFB7S6RXXHTLC7ZTP",
    "amount": "100000",
    "asset": "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
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
    }
  ],
  "total_estimated_apy": 8.1,
  "x402": {
    "txHash": "4ddcba3d...",
    "payer": "CADOUFRZCSM4GS6DMQLEIJVT6DS3W4N4ZFATVU3AYFMRE6A45ZBSRG3J",
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
│   ├── TotalSpent: i128 (lifetime USDC in stroops)
│   └── TxNonce: u64
└── persistent()
    └── AgentPolicy(Address): AgentPolicy
        ├── agent_address: Address
        ├── daily_limit: i128 (max per 24h in stroops)
        ├── spent_today: i128
        ├── last_reset: u64 (ledger timestamp)
        ├── allowed_destinations: Vec<Address>
        └── is_active: bool
```

**Key Functions:**

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(owner, usdc, factory)` | VaultFactory | One-time setup |
| `deposit(from, amount)` | from | Anyone can deposit USDC |
| `withdraw(owner, amount)` | owner | Owner-only withdrawal |
| `add_agent(owner, agent, limit, dests)` | owner | Authorize an agent |
| `remove_agent(owner, agent)` | owner | Deactivate agent |
| `agent_pay(agent, pay_to, amount, memo)` | **agent** | x402 payment entry point |
| `balance()` | none | View: USDC balance |
| `remaining_limit(agent)` | none | View: agent's daily limit remaining |
| `total_spent()` | none | View: lifetime USDC spent |

### VaultFactory

Deploys UserVault instances using `deploy_v2()` with deterministic addressing.

| Function | Description |
|----------|-------------|
| `initialize(admin, wasm_hash, usdc)` | One-time setup |
| `create_vault(owner)` | Deploy new vault for owner (one per user) |
| `get_vault(owner)` | Get vault address for owner |
| `vault_count()` | Total vaults deployed |

### AgentRegistry (ERC-8004 + Handle System)

| Function | Description |
|----------|-------------|
| `register(owner, name, handle, agent_uri, vault, signer)` | Register agent with unique `@handle` |
| `get_agent(agent_id)` | Get agent by sequential ID |
| `get_agent_by_handle(handle)` | Resolve agent by `@handle` |
| `is_handle_available(handle)` | Check handle availability |
| `transfer_agent(owner, agent_id, new_owner)` | Transfer ownership (handle travels with agent) |
| `deactivate(owner, agent_id)` | Deactivate agent |
| `agent_count()` | Total active agents |

**Handle error codes:** 5=HandleAlreadyTaken, 6=HandleTooShort, 7=HandleTooLong, 8=HandleInvalidChars

### ReputationRegistry

| Function | Description |
|----------|-------------|
| `post_feedback(agent_id, reviewer, score, category, data_uri, proof)` | Submit review |
| `get_feedback(agent_id, offset, limit)` | Paginated feedback list |
| `get_feedback_summary(agent_id)` | `{ avg_score, review_count }` |

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
| XLM network fee | Facilitator | ~0.003 XLM per transaction |
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
| **Blend Protocol** | `@blend-capital/blend-sdk` | Pool data, supply/withdraw | Mock fallback (custom testnet USDC) |
| **Soroswap** | `@soroswap/sdk@0.3.8` | Swap quotes, LP data | Mock fallback (requires API key) |
| **Ondo USDY** | — | APY reference | Hardcoded rates |
| **DeFindex** | — | Vault strategies | Hardcoded rates |

> **Note**: Custom testnet USDC cannot be used with existing Blend/Soroswap pools on testnet (they have fixed reserve lists). The integration architecture is fully built with graceful mock data fallbacks. Production deployment would use the same USDC address as the DeFi protocols.

---

## ERC-8004 Agent Registry

The AgentRegistry implements an **ERC-8004-equivalent on Stellar** — a registry of AI agent identities as on-chain NFTs with unique ENS-like handles.

### Registry Structure

```
AgentInfo (per registered agent):
├── id: u32 (sequential token ID)
├── owner: Address
├── name: String ("YieldBot Alpha")
├── handle: String | null ("yield-bot-alpha" or null for pre-handle agents)
├── agent_uri: String (JSON capabilities)
├── vault_address: Address
├── agent_signer: Address
├── registered_at: u64 (ledger timestamp)
└── is_active: bool
```

### Handle System

Each agent can claim a globally unique `@handle` at registration time (first-come, first-served):

```
register(owner, name, "stellar-yield-bot", agentUri, vault, signer)
                        ↑ handle — 3-32 chars, a-z/0-9/hyphen, unique
```

Handles are resolvable on-chain: `get_agent_by_handle("stellar-yield-bot")` → `AgentInfo`.

### ERC-8004 Mapping

| ERC-8004 Field | Our Field | Notes |
|----------------|-----------|-------|
| tokenId | id | Sequential u32 |
| owner | owner | Stellar Address |
| agentURI | agent_uri | JSON capabilities string |
| name | name | Human-readable |
| — | handle | ENS-like unique identifier (Stellar extension) |
| — | vault_address | Stellar extension |
| — | agent_signer | Stellar extension |

### Registered Agents (Testnet)

| ID | Name | Handle | Owner |
|----|------|--------|-------|
| 1 | YieldBot Alpha | *(pre-handle, null)* | User1 |
| 2 | Yield Optimiser | *(pre-handle, null)* | User2 |

> Agents registered before the handle system show `handle: null`. New registrations require a unique `@handle`.

---

## Security Model

### On-Chain Enforcement

1. **Agent spending limits**: 24-hour rolling window (`daily_limit`, `spent_today`, `last_reset`) enforced in every `agent_pay()` call. Resets automatically after 86,400 seconds.

2. **Destination whitelisting**: Each agent has an `allowed_destinations: Vec<Address>`. Empty = any destination allowed. Non-empty = strict whitelist.

3. **Auth entry expiration**: `signatureExpirationLedger` prevents replay of stale entries. Set to `latestLedger + 1000` (~83 minutes).

4. **Nonce anti-replay**: Each signed auth entry has a unique random nonce. Used nonces are tracked on-chain.

5. **Owner override**: Vault owner can call `remove_agent()` at any time to instantly revoke an agent's access.

6. **Handle uniqueness**: `HandleAgent(String)` storage key ensures no two agents can claim the same handle. Enforced atomically in `register()`.

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

### x402 End-to-End Test (Phase 2, February 2026)

```
  PASS  402 without payment: Status 402
  PASS  200 with payment: Status 200
  PASS  Has strategies: 4 strategies returned
  PASS  Has x402 proof: txHash present
  PASS  Vault balance decreased: Delta 100000 stroops (0.01 USDC)
  PASS  Facilitator received USDC: Delta 100000 stroops
  PASS  X-PAYMENT-RESPONSE header present

  ALL TESTS PASSED — x402 payment flow verified end-to-end!
```

### On-Chain Verification

After Phase 2 tests:
- User1 vault USDC balance: 999.9 USDC (started at 1000, one x402 payment of 0.01 USDC)
- Facilitator received the 0.01 USDC payment
- Agent remaining limit: 9.99 USDC/day
- Total spent (vault counter): 100,000 stroops

### Test Suites

| Suite | Framework | Tests | Status |
|-------|-----------|-------|--------|
| Soroban Contracts | `cargo test` | 21+ | PASS |
| Backend Unit | Vitest | 15+ | PASS |
| Backend Integration | Vitest | 14+ | PASS |
| x402 E2E | Custom script | 7 | PASS |
| **Total** | | **57+** | **ALL PASS** |

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
npx tsx src/scripts/test-x402-e2e.ts  # terminal 2 (from apps/backend/)
```

---

## File Reference

| File | Purpose |
|------|---------|
| `packages/x402-stellar/src/header-builder.ts` | Agent-side: build X-PAYMENT header |
| `packages/x402-stellar/src/facilitator.ts` | Facilitator: settle x402 payments |
| `packages/x402-stellar/src/middleware.ts` | Express middleware: 402/settle gate |
| `packages/agent-ai/src/yield-optimizer.ts` | AI engine: multi-LLM yield strategies |
| `packages/agent-ai/src/blend-client.ts` | Blend Protocol SDK integration |
| `packages/agent-ai/src/soroswap-client.ts` | Soroswap DEX SDK integration |
| `packages/agent-ai/src/rebalancer.ts` | Cron-based portfolio rebalancer |
| `contracts/user-vault/src/` | UserVault smart contract (Rust) |
| `contracts/vault-factory/src/` | VaultFactory smart contract (Rust) |
| `contracts/agent-registry/src/` | AgentRegistry smart contract (Rust) |
| `contracts/reputation-registry/src/` | ReputationRegistry smart contract (Rust) |
| `contracts/validation-registry/src/` | ValidationRegistry smart contract (Rust) |
| `apps/backend/src/routes/explorer.routes.ts` | Explorer API with agent stats |

---

*Built for Stellar Development Foundation Issue #633: AI Agent Wallets*
*Hackathon: February 2026*
