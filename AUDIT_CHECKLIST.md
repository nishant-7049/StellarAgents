# AgenticOcean — Pre-Mainnet Security Audit Checklist

> Complete all items before mainnet deployment.
> Use `pnpm deploy:contracts:mainnet` only after audit sign-off.

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

### AgentRegistry (`agent-registry/`) — includes handle system
- [ ] `register()` — Verify no duplicate registrations per owner
- [ ] `register()` — Verify handle uniqueness (HandleAlreadyTaken error)
- [ ] `register()` — Verify handle length bounds (3–32 chars)
- [ ] `register()` — Verify handle character whitelist (a-z, 0-9, hyphen only)
- [ ] `register()` — Verify no leading/trailing hyphens in handle
- [ ] `get_agent_by_handle()` — Verify returns correct agent for handle
- [ ] `is_handle_available()` — Verify returns false for taken handles
- [ ] `transfer_agent()` — Verify handle travels with agent on transfer
- [ ] `transfer_agent()` — Verify old owner cannot retain control after transfer
- [ ] `deactivate()` — Verify only agent owner can deactivate
- [ ] `set_agent_uri()` — Verify only owner can update metadata
- [ ] NFT-like semantics: verify IDs are sequential and immutable
- [ ] Handle error codes: 5=HandleAlreadyTaken, 6=HandleTooShort, 7=HandleTooLong, 8=HandleInvalidChars

### ReputationRegistry (`reputation-registry/`)
- [ ] `post_feedback()` — Verify score range enforcement (1-5)
- [ ] `post_feedback()` — Verify reviewer address is authenticated
- [ ] `get_feedback_summary()` — Verify average calculation is correct
- [ ] Running averages: verify they cannot be manipulated by self-review spam

### ValidationRegistry (`validation-registry/`)
- [ ] `initialize()` — Verify double-init protection
- [ ] Access control: verify only authorized validators can submit

---

## x402 Payment Flow

- [ ] Header builder: verify signed auth entry cannot be replayed
- [ ] Facilitator: verify payment amount matches route config minimum
- [ ] Facilitator: verify agent's signed auth entry is injected correctly
- [ ] Facilitator: verify fee-bump uses facilitator as source (not user)
- [ ] Middleware: verify 402 response does not leak secrets
- [ ] Middleware: verify `paymentHeader` is validated before trusting
- [ ] Nonce: verify each `SorobanAuthorizationEntry` nonce is used at most once
- [ ] Expiry: verify `signatureExpirationLedger` is enforced on-chain

---

## Backend API

- [ ] No secret keys returned in any API response
- [ ] Input validation on all routes (`wallet`, `amount`, `agentId`, `handle`)
- [ ] Explorer stats endpoint: verify `isMock` flag is set correctly
- [ ] Handle lookup (`/api/agents/handle/:handle`): verify returns 404 for unknown handles
- [ ] Reputation endpoints: verify agent ID bounds checking
- [ ] No admin/facilitator keys exposed in error responses
- [ ] MongoDB: verify no injection vectors in query parameters
- [ ] Credits: verify credit deductions are atomic

---

## Frontend

- [ ] Freighter only requested for signing — no private key access
- [ ] `signTransaction()` uses correct network passphrase
- [ ] No secrets in `NEXT_PUBLIC_*` env vars
- [ ] Payment header never logged or exposed in client console
- [ ] Handle input: client-side validation matches contract rules
- [ ] Handle availability check: debounced to avoid rate limiting
- [ ] Explorer stats: "Demo data" badge shown when `isMock: true`

---

## Infrastructure

- [ ] `.env` with secrets is not committed to git
- [ ] Railway/Fly.io env vars set via secrets manager (not inline)
- [ ] CORS restricted to production domain only
- [ ] Backend does not expose Soroban RPC URL in error responses
- [ ] MongoDB connection string not logged

---

## Mainnet Pre-Deployment Steps

1. Complete all items above
2. Deploy to Testnet and run full integration test suite (`cargo test --workspace`)
3. Get third-party audit report sign-off
4. Deploy USDC SAC using mainnet USDC issuer (`GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`)
5. Fund admin/facilitator wallets with XLM for fees
6. Deploy all 5 contracts: `pnpm deploy:contracts:mainnet`
7. Initialize factory with audited UserVault WASM hash
8. Initialize AgentRegistry, ReputationRegistry, ValidationRegistry
9. Verify via Stellar Expert: all contracts initialized correctly
10. Regenerate all keypairs with hardware wallet backing
11. Register initial agents with unique `@handle` values
12. Enable mainnet in frontend: `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`

---

## Audit Contacts

- Security audit: TBD
- Contract review: TBD
- Penetration test: TBD

---

*Last updated: February 2026*
