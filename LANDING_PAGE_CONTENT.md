# AgenticOcean — Landing Page Content Spec
> For UI/UX Designer Reference
> Every section is listed in order top → bottom.
> Copy marked **[BOLD]** is the primary text. Supporting copy is below it.

---

## SECTION 1 — Navigation Bar (Top, sticky)

**Logo:** AgenticOcean logo image (left side)

**Nav Links (center or right):**
- Features
- How It Works
- Developer SDK
- Explorer
- Docs

**CTA Button (right, filled):**
- "Launch App" → goes to /app

**Secondary pill (optional, right of logo):**
- `Built on Stellar` badge with Stellar logo icon

---

## SECTION 2 — Hero

> Full-width, dark background, centered layout. This is the first thing the user sees.

**Eyebrow tag (small pill above headline):**
> `🌊 AI Agent Infrastructure for Stellar DeFi`

**Headline (large, bold):**
> **Give Your AI Agents**
> **a Wallet, an Identity,**
> **and the Power to Pay.**

**Sub-headline (lighter, below headline):**
> AgenticOcean is the infrastructure layer that lets AI agents autonomously hold USDC, pay for services via HTTP micropayments, manage DeFi positions — and prove who they are on-chain.

**Two CTA buttons (side by side):**
- Primary filled: `Launch App →`
- Secondary outlined: `Read the Docs`

**Trust badges below buttons (small icons + text in a row):**
- `✅ Live on Stellar Testnet`
- `✅ 5 Soroban Contracts Deployed`
- `✅ Open Source`

**Hero Visual (right side or below on mobile):**
> Animated illustration or diagram showing:
> - An AI agent node
> - A smart vault holding USDC
> - An arrow labeled "0.01 USDC" flowing to a DeFi service
> - A green checkmark: "Payment verified on-chain"

---

## SECTION 3 — Problem Statement (The "Why")

> 2-column layout or centered card. Short and punchy.

**Section label (small, muted):**
> THE PROBLEM

**Headline:**
> **AI agents are getting smarter. But they can't pay.**

**Body:**
> Today's AI agents can write code, browse the web, and manage your calendar — but the moment they need to pay for a service, buy an API call, or invest in DeFi, they hit a wall. They don't have wallets. They don't have identity. They have no way to transact.
>
> AgenticOcean fixes that.

**3 pain point cards (icon + title + one line):**

| Icon | Title | Description |
|------|-------|-------------|
| 🔒 | No Wallet | Agents can't hold or spend funds autonomously |
| 👤 | No Identity | No verifiable on-chain record of who an agent is |
| 💸 | No Payments | Can't pay for APIs, data, or DeFi services inline |

---

## SECTION 4 — How It Works

> Numbered steps. Left-right alternating layout or vertical timeline.

**Section label:**
> HOW IT WORKS

**Headline:**
> **From zero to autonomous in 4 steps.**

---

**Step 1 — Create a Smart Vault**
> Deploy a personal USDC vault on Stellar in one click. Your vault is a Soroban smart contract that holds funds and enforces per-agent spending rules.
>
> `VaultFactory.create_vault()` → Your vault is live on-chain.

---

**Step 2 — Register Your Agent**
> Give your AI agent an on-chain identity. Every agent gets a sequential ID and a unique `@handle` — like an ENS name for your bot.
>
> `AgentRegistry.register("my-yield-bot")` → Agent identity minted.

---

**Step 3 — Set Spending Rules**
> Authorize your agent with a daily USDC limit and optional destination whitelist. The vault enforces these rules on every payment — no admin key needed.
>
> `vault.add_agent(agent, dailyLimit: 10 USDC)` → Policy set.

---

**Step 4 — Agent Pays via x402**
> Your agent hits a paid API endpoint, receives a `402 Payment Required` response, builds the payment, and settles 0.01 USDC on-chain — all without you lifting a finger.
>
> `GET /api/yield/query` → `402` → `X-PAYMENT: ...` → `200 OK + strategy`

---

## SECTION 5 — Core Features

> Card grid layout, 3 across. Each card has an icon, title, and 2-3 lines of description.

**Section label:**
> WHAT'S INSIDE

**Headline:**
> **Everything your AI agent needs to operate autonomously.**

---

**Card 1 — Smart Vaults**
Icon: 🔐
> Per-user Soroban smart contracts holding USDC. Fine-grained per-agent daily spending limits enforced entirely on-chain. Deposit, withdraw, and manage agent access without ever giving up your keys.

---

**Card 2 — Agent Identity (SRC-8004)**
Icon: 🪪
> Every agent gets a sequential on-chain ID and a unique `@handle` — first-come, first-served. Resolve any agent by name. Transfer ownership. Build reputation. Think ENS, but for your AI bot.

---

**Card 3 — x402 Micropayments**
Icon: ⚡
> The HTTP 402 payment protocol for Stellar. An agent sends a single signed header, the facilitator settles USDC on-chain atomically. Sub-second, trustless, no subscription needed.

---

**Card 4 — AI Yield Optimizer**
Icon: 🤖
> Multi-LLM yield strategy engine (Claude, Gemini, Groq, xAI — auto-detected from your key). Reads live rates from Blend Protocol + Soroswap. Returns a risk-adjusted allocation in seconds.

---

**Card 5 — Autonomous Rebalancer**
Icon: ♻️
> A cron-based rebalancer that runs every 5 minutes. Compares current DeFi positions against the AI's target allocation. Executes supply/withdraw operations automatically when drift exceeds 5%.

---

**Card 6 — Reputation + Validation**
Icon: ⭐
> On-chain feedback registry for every agent. Users rate agents 1–5 stars with category tags. Scores are computed as running averages on-chain — tamper-proof, permanent, transparent.

---

## SECTION 6 — x402 Payment Flow (Technical Deep Dive)

> Aimed at developers. Horizontal sequence diagram / animated flow.

**Section label:**
> THE x402 PROTOCOL

**Headline:**
> **Pay-per-use APIs for AI agents. No subscription. No API key sharing.**

**Sub:**
> x402 is an open HTTP payment protocol. A 402 response tells the agent exactly how much to pay and where. The agent pays, the server delivers. Settled on Stellar in under 5 seconds.

**Flow diagram (5 steps, left → right with arrows):**

```
Agent requests API          Server returns 402           Agent signs payment
GET /api/yield/query   →    { amount: 0.01 USDC,    →   SorobanAuthEntry signed
(no payment)                  payTo: facilitator }        with agent key

           ↓
Facilitator submits on-chain        →      Server delivers response
vault.agent_pay() → USDC transfer          200 OK + yield strategy + txHash
```

**Callout box:**
> 💡 The vault enforces the agent's daily spending limit on-chain. The facilitator cannot change the amount or destination. You stay in control — always.

---

## SECTION 7 — Explorer Preview

> Screenshot or mockup of the /explorer page. Visual section.

**Section label:**
> ERC-8004 EXPLORER

**Headline:**
> **See every agent, every payment, every review. On-chain. In real time.**

**Body:**
> The AgenticOcean Explorer is a live dashboard showing all registered agents, their 30-day activity charts, USDC payment history, action breakdown, and reputation scores — decoded from raw Stellar transactions into human-readable timelines.

**Feature list (3 columns, checkmarks):**
- ✅ Agent profiles with `@handle`
- ✅ Daily query + USDC spend charts
- ✅ Decoded transaction history
- ✅ Action breakdown by memo type
- ✅ On-chain reputation panel
- ✅ Global activity feed

**Visual:** Full-width screenshot or mockup of the Explorer page.

---

## SECTION 8 — Developer SDK

> Dark background card or code-block section. Targets developers.

**Section label:**
> DEVELOPER SDK

**Headline:**
> **Three packages. Drop-in ready.**

**Sub:**
> AgenticOcean ships as three TypeScript SDKs on npm. Integrate AI agent payments into your own app in under 30 lines of code.

---

**SDK Card 1 — `@agenticocean/vault`**
> TypeScript client for all 5 Soroban contracts — VaultFactory, UserVault, AgentRegistry, ReputationRegistry, ValidationRegistry.
```typescript
const registry = new AgentRegistry(REGISTRY_ADDRESS, config);
const agent = await registry.getAgentByHandle("yield-bot");
```

---

**SDK Card 2 — `@agenticocean/x402-stellar`**
> Build payment headers agent-side, gate your API server-side, settle payments on-chain.
```typescript
// Gate your route
app.use("/api/data", createX402Middleware({ price: "100000" }));

// Agent pays
const header = await buildX402Header({ vaultContract, agentSecret, payTo, amount });
```

---

**SDK Card 3 — `@agenticocean/defi-agent`**
> Multi-LLM yield optimizer + Blend SDK + Soroswap client + autonomous rebalancer.
```typescript
const strategy = await optimizer.optimize(
  "Best yield for 1000 USDC",
  "moderate"
);
// → 8.1% APY, 4-protocol allocation
```

---

**CTA below SDK cards:**
> "Read the full SDK docs →" (links to agenticoceandocs.vercel.app)

---

## SECTION 9 — Live Stats Bar

> Full-width strip. 4 numbers in a row. Dark or accent background.

**Headline (optional, centered above):**
> Live on Stellar Testnet

**Stats (4 columns):**

| Stat | Value | Label |
|------|-------|-------|
| 🔐 | 5 | Smart Contracts Deployed |
| 🤖 | 2 | Agents Registered |
| ⚡ | 0.01 USDC | Per x402 Query |
| 📦 | 3 | SDK Packages |

---

## SECTION 10 — Supported AI Providers

> Small logos / pill badges in a row. Light section.

**Headline:**
> **Works with your AI provider of choice.**

**Sub:**
> Provider is auto-detected from your API key — no config needed.

**Logo row (4 providers):**
- Anthropic Claude (`sk-ant-`)
- Google Gemini (`AIza`)
- Groq (`gsk_`)
- xAI Grok (`xai-`)

---

## SECTION 11 — Final CTA (Bottom of page)

> High-contrast, full-width section. Dark or gradient background.

**Headline:**
> **Your agents are ready to work.**
> **Give them a wallet.**

**Sub:**
> Start building on Stellar Testnet — free, instant, no credit card.

**Two buttons:**
- Primary filled: `Launch the App →`
- Secondary ghost: `Read the Docs`

**Small trust line below buttons:**
> Built for SDF Issue #633 · Stellar Testnet · Open Source · February 2026

---

## SECTION 12 — Footer

**Left — Logo + tagline:**
> AgenticOcean logo
> "Give your AI agents a wallet, an identity, and the power to pay."

**Middle — Links:**

*Product*
- Launch App
- Explorer
- Register Agent
- Chat

*Developers*
- Docs
- SDK Reference
- x402 Spec
- GitHub

*Contracts*
- VaultFactory
- AgentRegistry
- ReputationRegistry

**Right — Social / Links:**
- GitHub (repo link)
- Stellar Expert (testnet explorer)
- Docs (agenticoceandocs.vercel.app)

**Bottom bar (thin line above):**
> © 2026 AgenticOcean · Built on Stellar · MIT License

---

## Design Notes for the Designer

| Element | Guidance |
|---------|----------|
| **Primary color** | Electric indigo `#6366f1` |
| **Background** | Deep navy `#0f0f1a` (dark mode first) |
| **Surface / cards** | `#13131f` |
| **Accent / glow** | Cyan-blue `#38bdf8` for highlights |
| **Success green** | `#22c55e` for checkmarks / "live" badges |
| **Font feel** | Modern sans-serif (Inter, Geist, or similar) |
| **Tone** | Premium developer tool — think Stripe, Linear, Vercel |
| **Animations** | Subtle: fade-in on scroll, pulsing dots on live stats, payment flow animation in hero |
| **Mobile** | All sections must stack cleanly. CTA buttons full-width on mobile. |
| **Logo usage** | Use provided `logo.png` (blue rounded rectangle with "AgenticOcean" wordmark) |
