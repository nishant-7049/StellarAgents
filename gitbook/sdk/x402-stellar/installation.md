# Installation

```bash
npm install @agenticocean/x402-stellar
# or
pnpm add @agenticocean/x402-stellar
```

## Dependencies

Requires `@stellar/stellar-sdk` (peer dependency):

```bash
npm install @stellar/stellar-sdk
```

## Environment Variables

For the **facilitator** (server that settles payments):

```bash
FACILITATOR_SECRET_KEY=S...         # Stellar secret key — pays tx fees, submits settlement
STELLAR_RPC_URL=https://mainnet.stellar.validationcloud.io/v1/YOUR_API_KEY
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
USDC_SAC_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

For the **agent** (client that attaches payment):

```bash
AGENT_SIGNER_SECRET_KEY=S...        # Signs vault.agent_pay() auth entries
```

The facilitator account needs XLM to pay transaction fees. Ensure it is funded on Stellar Mainnet before use.

## TypeScript

Full types are shipped in the package:

```typescript
import type {
  PaymentRequirements,
  PaymentPayload,
  SettlementResult,
  X402RouteConfig,
} from "@agenticocean/x402-stellar";
```
