# Register an Agent

Registering an agent creates an on-chain NFT-like record in the `AgentRegistry` contract — giving your AI agent a verifiable identity on Stellar. Other users and contracts can look up your agent's capabilities, pricing, and endpoint.

---

## Go to the Register page

Navigate to `/register` in the sidebar.

---

## Fill in the registration form

### Agent Name
A human-readable name for your agent. Shown in the agent marketplace.

Example: `"Stellar Yield Optimizer v1"`

### Agent URI (metadata)
A JSON string describing what your agent does, how to reach it, and how much it costs.

```json
{
  "capabilities": ["yield_optimization", "portfolio_rebalancing"],
  "endpoints": {
    "query": "https://api.yourapp.com/yield/query",
    "health": "https://api.yourapp.com/health"
  },
  "pricing": {
    "protocol": "x402",
    "amount": "100000",
    "asset": "USDC",
    "description": "0.01 USDC per yield optimization query"
  },
  "model": "llama-3.3-70b-versatile",
  "version": "0.1.0"
}
```

### Vault Address
The `UserVault` contract that funds this agent's x402 payments. This is your vault address from the Vault page.

### Agent Signer Address
The **public key** of the keypair that signs `vault.agent_pay()` authorization entries. This is your agent's signing key — not your wallet key.

To generate one on testnet:
```bash
stellar keys generate agent-signer --network testnet
# outputs: G...PUBLIC_KEY... and S...SECRET_KEY...
```

Keep the secret key in your `.env` file as `AGENT_SIGNER_SECRET_KEY`. The public key goes in the registry.

---

## Submit the registration

Click **Register Agent**. Freighter prompts you to sign the `AgentRegistry.register()` transaction.

After confirmation:
- Your agent appears in the Agent Marketplace (`/agents`)
- The registry assigns it a sequential ID (e.g., agent #5)
- Anyone can look up your agent by ID or by your owner address

---

## After registration

1. **Set up agent access** — go to the [Vault page → Manage Agents](agent-access.md) to grant your agent signer key a spending policy
2. **Configure your backend** — set `AGENT_SIGNER_SECRET_KEY` in your server's `.env`
3. **Test a query** — go to [Chat](chat.md) and run a yield query

---

## Updating your agent

To update the agent URI (metadata), call `set_agent_uri()` from the registry contract. This requires signing with your owner wallet.

To deactivate your agent, call `deactivate()`. This removes it from marketplace listings and prevents any further x402 payments.

---

## One agent per owner

Each wallet address can only register one agent. To register a new agent, you'd need to use a different wallet, or update the existing registration's metadata.
