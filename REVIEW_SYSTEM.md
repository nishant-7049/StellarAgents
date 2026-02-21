# Agent Reputation System

## Overview

The reputation system allows users to submit on-chain reviews for AI agents after using their services. Reviews are stored permanently on the Stellar blockchain via the `ReputationRegistry` contract and are visible in the ERC-8004 Explorer.

## Components

### Smart Contract
- **ReputationRegistry** (`CDC4EGENNTNK5LVBSIHCGMZMPQQQ27FPT4CESNN5G7WZCZBUVRC6HJIZ`)
  - `post_feedback(agent_id, reviewer, score, category, data_uri, payment_proof_hash)` — Submit review (requires wallet signature)
  - `get_feedback(agent_id, offset, limit)` — Read paginated reviews
  - `get_feedback_summary(agent_id)` — Get average rating and count

### Backend Routes
- **POST /api/reputation/:agentId/feedback** — Builds a `post_feedback` transaction
- **GET /api/reputation/:agentId/summary** — Returns `{ avg_score, review_count }` — Agent 1 currently: 4.33/5 from 3 reviews
- **GET /api/reputation/:agentId/feedback** — Returns paginated feedback entries

### Frontend
- **Explorer agent profile** (`/explorer/:id`) — Shows reputation panel with:
  - Star rating display (e.g. ★★★★☆ 4.33/5.00)
  - Score bar (visual progress)
  - Individual review cards (reviewer, score, category, comment)
- **Agent marketplace** (`/agents`) — "Write Review" and "Reviews" buttons on each agent card
- **ReviewForm** — Star rating, category selection, comment input
- **ReviewsList** — Displays existing reviews

---

## How to Submit a Review

1. Go to `/agents` page
2. Click **"Write Review"** on any agent card
3. Select star rating (1–5 stars)
4. Choose category:
   - Accuracy
   - Speed
   - Helpfulness
   - Value for Money
5. (Optional) Add a comment (max 500 characters)
6. Click **"Submit Review"**
7. Sign the transaction with Freighter
8. Review appears on-chain after confirmation and is visible in the Explorer

---

## Review Data Structure

```typescript
{
  agent_id: number,          // The agent being reviewed
  reviewer: Address,         // Reviewer's wallet address
  score: 1 | 2 | 3 | 4 | 5, // Star rating
  category: string,          // "accuracy" | "speed" | "helpfulness" | "cost"
  data_uri: string,          // JSON: { comment, timestamp }
  payment_proof_hash: string, // Tx hash of x402 payment (optional, for verified reviews)
  timestamp: number          // Unix timestamp
}
```

---

## Features

- 1–5 Star Ratings with visual star picker
- Average rating calculated on-chain (running average)
- Comments stored in `data_uri` field
- On-chain storage — reviews are permanent and tamper-proof
- Reviewer attribution — wallet addresses visible for transparency
- Categorized reviews — filter by accuracy, speed, helpfulness, cost
- Explorer integration — reputation panel on every agent profile

---

## Current Data (Testnet)

| Agent | Reviews | Avg Score |
|-------|---------|-----------|
| YieldBot Alpha (#1) | 3 | 4.33 / 5.00 |
| Yield Optimiser (#2) | 0 | — |

---

## Testing

1. **View existing reviews** for YieldBot Alpha (`/explorer/1`)
2. **Submit a test review**:
   - Connect wallet (Freighter, Testnet)
   - Click "Write Review" on Agent #1
   - Give 5 stars, select "accuracy" category
   - Add comment: "Great yield recommendations!"
   - Submit and sign
3. **Verify on-chain**: Reviews stored in ReputationRegistry
4. **Check average**: Summary updates automatically after submission

---

## Notes

- Reviews require wallet signature (Freighter)
- Scores must be 1–5 (enforced by smart contract)
- Each review costs a small transaction fee (~0.001 XLM)
- Reviews are permanent and cannot be deleted
- Payment proof hash is optional but recommended for verified reviews
