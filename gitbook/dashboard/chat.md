# Chat with the AI Agent

The **Chat** page (`/app/chat`) is where you interact with the AI yield optimizer. Every query is paid for via the x402 protocol — `0.01 USDC` deducted from your vault per question.

---

## What you can ask

The AI agent knows about live Stellar DeFi rates and can help you:

- **Find yield strategies** — "What's the best yield for 1000 USDC with low risk?"
- **Compare protocols** — "What's the difference between Blend and Soroswap?"
- **Learn DeFi concepts** — "What is impermanent loss?"
- **Check current rates** — "What are today's Blend APYs?"
- **Portfolio advice** — "Should I rebalance my current allocation?"

---

## Making a Query

1. Type your question in the input box at the bottom
2. (Optional) Set your **risk tolerance** — Low, Moderate, or High
3. (Optional) Enter your **USDC amount** for projected return calculations
4. Hit Enter or click **Send**

---

## What happens under the hood

1. The frontend calls the backend `POST /api/x402/build-header` endpoint (which uses `buildX402Header()` under the hood)
2. It sends the query to the backend with the `X-PAYMENT` header
3. The backend's x402 middleware calls `settlePayment()` — your vault pays `0.01 USDC`
4. The AI engine reads live Blend and Soroswap rates
5. The LLM (Groq/Claude/Gemini) generates a strategy based on live data
6. The strategy is returned — you see the `X-PAYMENT-RESPONSE` txHash

---

## Reading the Response

Successful queries return a **strategy card** showing:

**Allocation breakdown:**
```
Ondo USDY:            60%  @ 4.8% APY  [Low risk]   US Treasury-backed
Blend Fixed V2:       20%  @ 7.2% APY  [Low risk]   Backstop protected
DeFindex Auto-Comp:   20%  @ 9.1% APY  [Moderate]   Auto-compounds Blend
──────────────────────────────────────────────────────
Weighted APY: 6.1%   │  Projected monthly: $5.08 on $1,000
```

**Payment proof:**
```
Paid 0.01 USDC via x402
txHash: 3b2f4a... (click to view on Stellar Expert)
```

---

## Protocol Knowledge

| Protocol | Type | Risk | APY range |
|----------|------|------|-----------|
| Blend Fixed V2 | Lending | Low | 6–9% |
| Ondo USDY | RWA | Low | ~4.8% |
| Centrifuge deJTRSY | RWA | Low | ~4.5% |
| DeFindex Auto-Compound | Vault | Moderate | ~9% |
| DeFindex Multi-Strategy | Vault | High | ~11% |
| Soroswap USDC/XLM | AMM LP | High | ~12% |

APYs are fetched live from Blend and Soroswap before each response — not hardcoded values.

---

## No vault? Demo mode

If you don't have a vault set up yet, the chat page shows a demo response using our testnet vault. The payment still happens (from the demo vault), but you can't see your own portfolio.

To use your own vault:
1. [Create a vault](create-vault.md)
2. Deposit some USDC
3. [Authorize the agent signer](agent-access.md) — set a daily limit for the chat agent

---

## Tips

- Ask follow-up questions — the chat remembers context within a session
- Mention a specific amount for more useful projections: "What's the best strategy for $500 USDC?"
- Specify risk explicitly: "I'm very risk-averse" or "I want maximum yield"
- Ask about specific protocols: "How does Blend work?" or "What is impermanent loss?"
