# Portfolio & Rebalancing

The **Portfolio** page (`/app/portfolio`) shows your deployed DeFi positions, earnings, and lets you trigger or monitor automatic rebalancing.

---

## Summary Stats

At the top of the page, four stat cards give you a quick overview:

| Card | Shows |
|------|-------|
| **Vault Balance** | Total USDC in your vault (idle + deployed) |
| **Weighted APY** | Weighted average APY across all deployed positions |
| **Earned so far** | USDC earned since strategy deployment |
| **Monthly return** | Projected monthly earnings at current APY |

---

## Deployed Positions

The **Deployed Positions** panel shows your current allocation across protocols:

- A color-coded allocation bar (indigo = Blend, purple = Soroswap, green = Ondo, amber = DeFindex)
- Each protocol's USDC amount, allocation percentage, and current APY
- Any idle USDC remaining in the vault (not yet deployed)

If no strategy has been set yet, the panel shows a prompt to [ask the AI agent](chat.md) for a strategy.

---

## Autonomous Agent

The **Autonomous Agent** card shows your rebalancer's status:

- **Running autonomously every 5 min** — the backend rebalancer checks your portfolio on a schedule
- **x402 payments (strategy queries)** — when running in autonomous mode, the agent can pay `0.01 USDC` via x402 to purchase an AI strategy (deducted from your vault)
- **Force check now** — manually trigger a rebalance check without waiting for the next cron tick
- **Rebalance count** — total number of rebalancing actions taken

### What triggers a rebalance?

The rebalancer uses two gates before it will move funds:
1. **Minimum hold time** — positions must be at least **6 hours old** before rebalancing is allowed
2. **Minimum improvement** — the new strategy must improve expected APY by at least **0.25 percentage points**

If both gates pass, the backend will attempt on-chain execution for **Blend** positions. Soroswap positions are currently **tracked-only** (shown in the UI and included in the strategy, but not moved on-chain by the autonomous executor yet).

### On-chain reconciliation (safety)

Before making a rebalance decision, the backend may reconcile tracked positions against on-chain Blend reality. If tracked Blend value drifts significantly from on-chain, the system updates the tracked state to match before proceeding. This reduces “phantom positions” caused by manual user actions or partial failures.

---

## Rebalance History

Below the main panels, the **Rebalance History** table shows every rebalancing event:

| Column | Shows |
|--------|-------|
| Type | Auto (scheduled) or Manual (force-triggered) |
| x402 badge | Whether the rebalance paid via the x402 protocol |
| Reason | Why the rebalance happened (e.g., "APY drift: Blend 8.1% → 7.2%") |
| Date | When it happened |
| APY change | Net APY improvement (green = better, red = worse due to market shift) |

---

## Live Market Rates

The **Live Market Rates** card shows current APYs for all supported protocols:

- Blend USDC lending
- Soroswap LP
- Ondo USDY
- DeFindex vault

These are fetched live from Blend SDK and Soroswap on each page load — not cached.

---

## Emergency Monitoring (TVL drop alerts)

The backend can monitor Blend TVL and record an emergency event if a large drop is detected. In emergencies, the system records state and alerts that **manual on-chain withdrawal is required** (it does not attempt autonomous withdrawals).

---

## Quick Actions

At the bottom of the Portfolio page:
- **Ask Agent** — opens Chat to get a new strategy recommendation
- **Manage Vault** — goes to Vault page to deposit/withdraw or change agent policies
