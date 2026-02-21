# Create & Fund Your Vault

A **UserVault** is a Soroban smart contract that holds your USDC and lets authorized AI agents spend it within limits you control. Each wallet address can have one vault.

---

## Step 1 — Open the Vault page

Navigate to `/vault` in the sidebar. If you don't have a vault yet, you'll see the "Create Vault" card.

---

## Step 2 — Create Your Vault

Click **Create Vault**. Freighter will prompt you to sign a transaction that calls `VaultFactory.create_vault(yourAddress)`.

- The transaction costs ~0.001 XLM in fees
- The vault address is derived deterministically from your public key — it's always the same address for your wallet
- Takes about 5–10 seconds on testnet

Once created, the vault address appears at the top of the Vault page. You can also look it up any time from the SDK:

```typescript
const vaultAddress = await factory.getVaultForOwner(VAULT_FACTORY, yourPublicKey);
```

---

## Step 3 — Deposit USDC

After creating the vault, use the **Deposit** form:

1. Enter the amount of USDC to deposit
2. Click **Deposit**
3. Freighter prompts you to sign the USDC transfer
4. Wait for confirmation — the vault balance updates automatically

Your USDC is now held in the smart contract. You retain full control — only you (as vault owner) can withdraw it or change agent policies.

---

## Step 4 — Withdraw (when needed)

Use the **Withdraw** form to move USDC back to your wallet. Only the vault owner can withdraw.

---

## Vault Balance

The vault balance shows the USDC currently sitting in the contract. This is separate from your Freighter wallet balance.

- **Vault balance** — USDC in the smart contract, available for agents to use
- **Wallet balance** — USDC in your Freighter account, not accessible to agents

---

## What's the vault address used for?

Your vault address is what you give to:
- **Agents** — they use it as the `vaultContract` when building x402 headers
- **The registry** — you register your vault address when creating an on-chain agent identity
- **The rebalancer** — monitors and rebalances this vault's DeFi positions

You can share your vault address publicly — it's a contract address, not a private key. Nobody can steal USDC from it without being an authorized agent, and agents are subject to daily limits.

---

## USDC Decimals

On Stellar, USDC uses 7 decimal places:

| Display | Stroops |
|---------|---------|
| 1 USDC | 10,000,000 |
| 0.01 USDC | 100,000 |
| 0.001 USDC | 10,000 |

The dashboard displays USDC in human-readable form. The on-chain contracts always use stroops.
