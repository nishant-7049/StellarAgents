# ERC-8004 Standard in Agent Registry Contract

## Overview

The Agent Registry contract implements an **ERC-8004-inspired** standard adapted for the Stellar/Soroban blockchain. ERC-8004 is an Ethereum standard for registering AI agent identities as on-chain NFTs.

**Reference**: [github.com/agentsea/erc8004](https://github.com/agentsea/erc8004)

---

## Basic Standard: ERC-8004 (Agent NFT Registry)

ERC-8004 defines a standard for representing AI agents as **on-chain NFTs** with:

1. **Sequential Token IDs** - Each agent gets a unique numeric ID (like ERC-721 tokenIds)
2. **Owner Address** - The wallet/account that owns the agent
3. **Agent URI** - A JSON string containing agent capabilities and metadata
4. **Name** - Human-readable display name

---

## Mapping: ERC-8004 → AgenticOcean Implementation

| ERC-8004 Field | AgenticOcean Field | Type | Notes |
|----------------|-------------------|------|-------|
| `tokenId` | `id` | `u32` | Sequential ID starting at 1 |
| `owner` | `owner` | `Address` | Stellar Address (owner of the agent) |
| `agentURI` | `agent_uri` | `String` | JSON capabilities/endpoints/pricing |
| `name` | `name` | `String` | Human-readable name |
| — | **`handle`** | `String` | **Stellar Extension** - ENS-like unique identifier |
| — | **`vault_address`** | `Address` | **Stellar Extension** - x402 payment vault |
| — | **`agent_signer`** | `Address` | **Stellar Extension** - Ed25519 signing key |

---

## Stellar-Specific Extensions

### 1. Handle System (ENS-like)
Each agent has a **globally unique handle** (e.g., `@stellar-yield-bot`), similar to ENS names:

- **3–32 characters**
- **Allowed chars**: lowercase `a-z`, digits `0-9`, hyphens `-`
- **No leading/trailing hyphens**
- **First-come, first-served** - once claimed, it's permanently mapped
- **Transferable** - handle travels with the agent when ownership transfers

### 2. Vault Integration
The `vault_address` field links each agent to a **UserVault** smart contract for x402 protocol payments.

### 3. Agent Signer
The `agent_signer` field stores the public key used to sign `SorobanAuthorizationEntry` for x402 payments.

---

## Data Structures (from `types.rs`)

```rust
#[contracttype]
pub struct AgentInfo {
    pub id: u32,              // ERC-8004: tokenId
    pub owner: Address,       // ERC-8004: owner
    pub name: String,         // ERC-8004: name
    pub handle: String,       // Stellar extension
    pub agent_uri: String,    // ERC-8004: agentURI
    pub vault_address: Address, // Stellar extension
    pub agent_signer: Address,  // Stellar extension
    pub registered_at: u64,
    pub is_active: bool,
}
```

---

## Core Functions (ERC-8004 Equivalent)

| Function | ERC-8004 Equivalent | Purpose |
|----------|---------------------|---------|
| `register()` | `mint()` | Create new agent NFT with handle |
| `get_agent()` | `tokenURI()` | Get agent metadata by ID |
| `get_agent_by_handle()` | — | Resolve handle → agent (Stellar extension) |
| `transfer_agent()` | `transfer()` | Transfer ownership |
| `set_agent_uri()` | `setTokenURI()` | Update capabilities/metadata |
| `deactivate()` | `burn()` (soft) | Deactivate agent |
| `agent_count()` | `totalSupply()` | Count active agents |

---

## Storage Keys

```rust
pub enum DataKey {
    Admin,                    // Contract administrator
    Agent(u32),               // Agent ID → AgentInfo
    OwnerAgent(Address),      // Owner → Agent ID
    HandleAgent(String),      // Handle → Agent ID (uniqueness)
    NextId,                   // Sequential ID counter
    TotalActive,              // Active agent count
    Metadata(u32, String),    // Additional key-value metadata
}
```

---

## Summary

The Agent Registry uses **ERC-8004** as its foundation, which defines AI agents as NFT-like on-chain identities. The implementation extends this with:

1. **Handle system** (ENS-like unique identifiers)
2. **Vault integration** (for x402 micropayments)
3. **Agent signer** (for authorization signing)

This creates a **decentralized AI agent identity layer** where agents can be discovered, verified, and paid via the x402 protocol.
