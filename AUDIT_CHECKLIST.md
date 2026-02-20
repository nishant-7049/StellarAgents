# StellarAgent402 — Pre-Mainnet Security Audit Checklist

> Complete all items before mainnet deployment.
> Use `pnpm deploy:contracts --network mainnet` only after audit sign-off.

---

## Smart Contracts

### UserVault (`user-vault/`)
- [ ] `agent_pay()` — Verify daily limit reset logic (86400s window)
- [ ] `agent_pay()` — Verify destination allowlist enforcement (empty = any)
- [ ] `agent_pay()` — Verify `require_auth()` cannot be bypassed
- [ ] `agent_pay()` — Verify `InsufficientBalance` check occurs before transfer
- [ ] `withdraw()` — Verify only owner can call
- [ ] `add_agent()` — Verify duplicate agent detection
- [ ] `remove_agent()` — Verify deactivated agents cannot re-spend
- [ ] Overflow: verify `spent_today.saturating_add()` cannot overflow
- [ ] Storage: verify `persistent` vs `instance` storage used correctly
- [ ] Storage: verify TTL extensions needed for `persistent` entries
- [ ] Emergency: no admin backdoor — owner is the only privileged role
- [ ] Token: verify USDC SAC address cannot be changed post-init

### VaultFactory (`vault-factory/`)
- [ ] `create_vault()` — Verify one vault per owner (deterministic salt)
- [ ] `initialize()` — Verify double-init protection
- [ ] WASM hash: verify vault WASM hash matches audited binary
- [ ] Storage: verify factory admin cannot steal funds from vaults

### AgentRegistry (`agent-registry/`)
- [ ] `register()` — Verify no duplicate registrations per owner
- [ ] `deactivate()` — Verify only agent owner can deactivate
- [ ] `set_agent_uri()` — Verify only owner can update metadata
- [ ] NFT-like semantics: verify IDs are sequential and immutable

---

## x402 Payment Flow

- [ ] Header builder: verify signed auth entry cannot be replayed
- [ ] Facilitator: verify payment amount matches route config minimum
- [ ] Facilitator: verify agent's signed auth entry is injected correctly
- [ ] Facilitator: verify fee-bump uses facilitator as source (not user)
- [ ] Middleware: verify 402 response does not leak secrets
- [ ] Middleware: verify `paymentHeader` is validated before trusting

---

## Backend API

- [ ] No secret keys returned in any API response
- [ ] Input validation on all routes (`wallet`, `amount`, `agentId`)
- [ ] Horizon transaction verification in `/api/credits/purchase` is robust
- [ ] Platform fee (0.2%) applied correctly on all execute paths
- [ ] Credit deductions are non-blocking (no critical path dependencies)
- [ ] Credits store: verify JSON file write is atomic (race condition)

---

## Frontend

- [ ] Freighter only requested for signing — no private key access
- [ ] `signTransaction()` uses correct network passphrase
- [ ] No secrets in `NEXT_PUBLIC_*` env vars
- [ ] Payment header never logged or exposed in client console
- [ ] XDR assembled server-side (not in browser) to avoid bundling issues

---

## Infrastructure

- [ ] `.env` with secrets is not committed to git
- [ ] `.env.contracts` contains no funds private keys in prod
- [ ] Railway/Fly.io env vars set via secrets manager (not inline)
- [ ] CORS restricted to production domain only
- [ ] Backend does not expose Soroban RPC URL in error responses

---

## Mainnet Pre-Deployment Steps

1. Complete all items above
2. Deploy to Testnet and run full integration test suite
3. Get third-party audit report sign-off
4. Deploy USDC SAC using mainnet USDC issuer (`GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`)
5. Fund admin/facilitator wallets with XLM for fees
6. Deploy contracts: `pnpm deploy:contracts --network mainnet`
7. Initialize factory with audited UserVault WASM hash
8. Verify via Stellar Expert: all contracts initialized correctly
9. Register initial agents and set credit plan parameters
10. Enable mainnet in frontend: `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`

---

## Audit Contacts

- Security audit: TBD
- Contract review: TBD
- Penetration test: TBD

---

*Last updated: 2026-02-20*
