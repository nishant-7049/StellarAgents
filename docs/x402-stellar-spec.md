# x402 Protocol Specification for Stellar

## Overview

x402 is an HTTP-based payment protocol that enables AI agents to pay for API services using the standard HTTP 402 (Payment Required) status code. This specification extends x402 for the Stellar network using Soroban smart contracts.

## Protocol Flow

### 1. Discovery (402 Response)

When a client requests a paid resource without payment:

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
    "payTo": "GFACILITATOR...",
    "maxTimeoutSeconds": 60,
    "description": "AI-powered DeFi yield optimization query"
  }]
}
```

### 2. Payment (X-PAYMENT Header)

The client constructs a payment and retries with:

```http
GET /api/yield/query?q=best+yield HTTP/1.1
X-PAYMENT: <base64-encoded-payload>
```

The payload structure:

```json
{
  "x402Version": 1,
  "scheme": "stellar-vault",
  "network": "stellar:testnet",
  "payload": {
    "vaultContract": "CVAULT...",
    "agentId": 1,
    "agentSigner": "GAGENT...",
    "payTo": "GFACILITATOR...",
    "amount": "100000",
    "asset": "CUSDC...",
    "memo": "yield_query_abc123",
    "signedAuthEntry": "<base64-xdr>",
    "expirationLedger": 12345678
  }
}
```

### 3. Settlement

The facilitator:
1. Builds a `vault.agent_pay(agent, payTo, amount, memo)` transaction
2. Simulates it via Soroban RPC
3. Injects the agent's signed `SorobanAuthorizationEntry`
4. Signs as source account (facilitator pays XLM fees)
5. Submits to the network
6. Returns the transaction hash

### 4. Response

```http
HTTP/1.1 200 OK
X-PAYMENT-RESPONSE: {"txHash":"abc123...","network":"stellar:testnet"}
Content-Type: application/json

{
  "strategies": [...],
  "total_estimated_apy": 8.1,
  "x402": {
    "txHash": "abc123...",
    "payer": "CVAULT...",
    "agentId": 1
  }
}
```

## Stellar-Specific Details

### UserVault Contract Authorization

The `agent_pay()` function in the UserVault contract enforces:
- **Agent authentication**: `agent.require_auth()` verifies the signed auth entry
- **Policy check**: Agent must be active, within daily limit, destination allowed
- **USDC transfer**: Contract-invoker auth allows vault to transfer its own USDC

### Amount Format

All amounts are in **stroops** (7 decimal places):
- 1 USDC = 10,000,000 stroops
- 0.01 USDC = 100,000 stroops

### Supported Assets

Currently supports USDC (Stellar Asset Contract) on testnet. The protocol is extensible to any SAC token.

## Security Considerations

1. **Agent spending limits**: 24-hour rolling window enforced on-chain
2. **Destination whitelisting**: Agents can be restricted to specific payees
3. **Auth entry expiration**: Signed entries have a ledger-based expiration
4. **Facilitator separation**: Facilitator only submits transactions, cannot modify vault policies
5. **Owner override**: Vault owner can deactivate any agent at any time

## Relation to ERC-8004

The AgentRegistry contract implements an ERC-8004-equivalent on Stellar:
- Sequential `u32` token IDs (NFTs)
- Each agent has: owner, name, agentURI (JSON capabilities), vault address, signer address
- Metadata key-value store per agent
- Built for SDF Issue #633 (AI Agent Wallets)
