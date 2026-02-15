# Agent Review System

## Overview
The reputation system allows users to submit on-chain reviews for AI agents after using their services. Reviews are stored permanently on the Stellar blockchain.

## Components Created

### Backend
- **POST /api/reputation/:agentId/feedback** - Builds a `post_feedback` transaction
- **GET /api/reputation/:agentId/summary** - Gets aggregated rating summary
- **GET /api/reputation/:agentId/feedback** - Gets list of reviews

### Frontend
- **ReviewForm** - Star rating, category selection, and comment input
- **ReviewsList** - Displays existing reviews with ratings and comments
- **Updated AgentCard** - Added "Write Review" and "Reviews" buttons

### Smart Contract
- **ReputationRegistry** (`CDC4EGENNTNK5LVBSIHCGMZMPQQQ27FPT4CESNN5G7WZCZBUVRC6HJIZ`)
  - `post_feedback()` - Submit review (requires wallet signature)
  - `get_feedback()` - Read reviews
  - `get_feedback_summary()` - Get average rating

## How to Use

### 1. View Reviews
1. Go to `/agents` page
2. Click **"Reviews"** button on any agent card
3. See average rating and all reviews

### 2. Submit a Review
1. Go to `/agents` page
2. Click **"Write Review"** button on any agent card
3. Select star rating (1-5 stars)
4. Choose category:
   - Accuracy
   - Speed
   - Helpfulness
   - Value for Money
5. (Optional) Add a comment (max 500 characters)
6. Click **"Submit Review"**
7. Sign the transaction with Freighter
8. Review appears on-chain after confirmation

## Review Data Structure

```typescript
{
  agent_id: number,          // The agent being reviewed
  reviewer: Address,         // Your wallet address
  score: 1-5,               // Star rating
  category: string,          // "accuracy" | "speed" | "helpfulness" | "cost"
  data_uri: string,          // JSON: { comment, timestamp }
  payment_proof_hash: string, // Tx hash of payment (optional)
  timestamp: number          // Unix timestamp
}
```

## Features

- ⭐ **1-5 Star Ratings** with visual star picker
- 📊 **Average Rating** calculated on-chain
- 💬 **Comments** stored in data_uri field
- 🔐 **On-Chain Storage** - Reviews are permanent and tamper-proof
- 👤 **Reviewer Attribution** - Wallet addresses visible for transparency
- 📁 **Categorized Reviews** - Filter by accuracy, speed, helpfulness, cost

## Testing

1. **View existing reviews** for YieldBot Alpha (agent ID: 1)
2. **Submit a test review**:
   - Connect wallet
   - Give 5 stars
   - Select "accuracy" category
   - Add comment: "Great yield recommendations!"
   - Submit and sign
3. **Verify on-chain**: Reviews are stored in ReputationRegistry contract
4. **Check average**: Summary updates automatically

## Notes

- Reviews require wallet signature (you own your review)
- Scores must be 1-5 (enforced by smart contract)
- Each review costs a small transaction fee (~0.001 XLM)
- Reviews are permanent and cannot be deleted
- Payment proof hash is optional but recommended for verified reviews
