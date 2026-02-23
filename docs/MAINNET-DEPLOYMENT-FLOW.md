# AgentNet Mainnet Deployment Flow

## Scope
This runbook deploys AgentNet contracts on Stellar mainnet using:
- Circle native USDC asset (`USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`)
- single operational key mode (same key for admin, facilitator, and agent signer)

## Prerequisites
1. Audit sign-off completed.
2. Mainnet key imported into Stellar CLI (default alias: `agentnet-admin`).
3. Key funded with enough XLM for uploads/deploy/init.
4. Optional but recommended: set audited hash in env:
   - `AUDITED_VAULT_WASM_HASH=<sha256 of audited user_vault.wasm>`

## Commands
### 1) Build contracts
```bash
pnpm build:contracts
```

### 2) Deploy to mainnet
```bash
pnpm deploy:contracts:mainnet
```

Optional overrides:
- custom alias: `AGENTNET_DEPLOYER_ALIAS=<alias>`
- disable single key mode: `MAINNET_SINGLE_KEY=false`

## What the deploy script does
1. Verifies stellar CLI.
2. Builds/validates WASM artifacts.
3. On mainnet, validates existing key alias (no auto-generate/fund).
4. Resolves/deploys Circle USDC SAC from the USDC asset.
5. Uploads all WASMs.
6. Deploys:
   - VaultFactory
   - AgentRegistry
   - ReputationRegistry
   - ValidationRegistry
7. Initializes contracts.
8. Writes `.env.contracts` and `apps/web/.env.local`.

## Generated env values
- `VAULT_FACTORY_ADDRESS`
- `AGENT_REGISTRY_ADDRESS`
- `REPUTATION_REGISTRY_ADDRESS`
- `VALIDATION_REGISTRY_ADDRESS`
- `USDC_SAC_ADDRESS`
- `VAULT_WASM_HASH`
- key aliases/secrets/public keys for runtime wiring

## Runtime wiring (backend)
Ensure production env includes:
- `STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"`
- all 4 contract addresses
- `USDC_SAC_ADDRESS`

`apps/backend/src/config.ts` now enforces:
- mainnet passphrase in production (unless `ALLOW_TESTNET_IN_PRODUCTION=true`)
- required contract addresses in production

## Notes
- You do **not** deploy a custom USDC token for production flow.
- Payments continue to execute from user vault balances via `agent_pay`.
- Registry stores identity + signer/vault linkage metadata.
