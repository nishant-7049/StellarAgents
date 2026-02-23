# Mainnet Guide

AgenticOcean supports **Stellar mainnet**, but the operational model is very different from testnet:

- No Friendbot (you need real XLM for fees)
- Real USDC (mainnet USDC SAC) and real value at risk
- Contracts should be audited and deployment keys handled securely

---

## Network Constants

Mainnet endpoints (these match the `MAINNET` config in `@agenticocean/x402-stellar`):

- Soroban RPC: `https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY` (or any Soroban RPC provider)
- Horizon: `https://horizon.stellar.org`
- Passphrase: `Public Global Stellar Network ; September 2015`

---

## Mainnet USDC (SAC)

AgenticOcean uses USDC via the Stellar Asset Contract (SAC). On mainnet, derive the contract ID from the known USDC issuer:

```bash
# USDC issuer (mainnet)
USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN

# Derive the USDC SAC contract address
stellar contract id asset --asset "USDC:${USDC_ISSUER}" --network mainnet
```

Set the result as `USDC_SAC_ADDRESS` (backend) / `NEXT_PUBLIC_USDC_SAC_ADDRESS` (frontend).

---

## Deploy to Mainnet

The repo includes a deployment script that supports `--network mainnet`:

```bash
pnpm deploy:contracts --network mainnet
```

Before you run it:

- Complete `AUDIT_CHECKLIST.md`
- Use dedicated mainnet keys (never reuse testnet keys)
- Ensure the facilitator account is funded with enough XLM for fees

---

## Environment Variables

Backend (`StellarRiseInHackathon/.env`):

```bash
STELLAR_RPC_URL=https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"

FACILITATOR_SECRET_KEY=S...
AGENT_SIGNER_SECRET_KEY=S...

USDC_SAC_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
VAULT_FACTORY_ADDRESS=CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM
AGENT_REGISTRY_ADDRESS=CDKHR3UUKCKXJ6CRKWKUZI3SKWAAKJMU6TGHRBM2VJJBCKEO6ETH55AU
REPUTATION_REGISTRY_ADDRESS=CB6B4EBQ3JXLGUWF5WGMQV63PL3K2WQP5LMEL2BZDIDTEPCIC5BDH6ZB
VALIDATION_REGISTRY_ADDRESS=CDX65CKW2NZQZK5U7DQRK6KVOBI4PTLQVGHYAEQ7OPPY2KRCDUAS2AL5
```

Frontend (`apps/web/.env.local`):

```bash
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_BACKEND_URL=https://your-backend.example

NEXT_PUBLIC_VAULT_FACTORY_ADDRESS=CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=CDKHR3UUKCKXJ6CRKWKUZI3SKWAAKJMU6TGHRBM2VJJBCKEO6ETH55AU
NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS=CB6B4EBQ3JXLGUWF5WGMQV63PL3K2WQP5LMEL2BZDIDTEPCIC5BDH6ZB
NEXT_PUBLIC_VALIDATION_REGISTRY_ADDRESS=CDX65CKW2NZQZK5U7DQRK6KVOBI4PTLQVGHYAEQ7OPPY2KRCDUAS2AL5
NEXT_PUBLIC_USDC_SAC_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

---

## Dashboard Notes

The dashboard pages work the same way on mainnet, but you must:

- Switch your wallet (Freighter) to **Public** network
- Ensure you have XLM for fees
- Deposit real USDC into your vault before testing x402 flows
