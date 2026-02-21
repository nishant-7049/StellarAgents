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
- **x402 payments** — each rebalance check costs `0.01 USDC` (paid from your vault via the agent)
- **Force check now** — manually trigger a rebalance check without waiting for the next cron tick
- **Rebalance count** — total number of rebalancing actions taken

### What triggers a rebalance?

The rebalancer compares your actual on-chain positions (read from Blend and Soroswap) against your target allocation. If any protocol drifts more than **5%** from its target, the rebalancer:
1. Withdraws from over-allocated protocols
2. Supplies to under-allocated protocols

Example: target is 60% Blend / 40% Soroswap. If Blend drifts to 67% (due to Soroswap LP value change), the rebalancer withdraws 7% from Blend and adds it to Soroswap.

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

## Quick Actions

At the bottom of the Portfolio page:
- **Ask Agent** — opens Chat to get a new strategy recommendation
- **Manage Vault** — goes to Vault page to deposit/withdraw or change agent policies
