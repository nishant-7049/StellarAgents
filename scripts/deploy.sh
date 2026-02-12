#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.cargo/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== AgentNet Full Deployment Pipeline ==="
echo ""

echo "Step 1: Building contracts..."
bash "$ROOT/scripts/build-contracts.sh"
echo ""

echo "Step 2: Deploying contracts to testnet..."
cd "$ROOT"
pnpm deploy:contracts
echo ""

echo "Step 3: Setting up testnet (mint USDC, create vault, add agent)..."
pnpm --filter @agentnet/backend exec tsx src/scripts/setup-testnet.ts
echo ""

echo "Step 4: Seeding demo agents..."
pnpm --filter @agentnet/backend exec tsx src/scripts/seed-agents.ts
echo ""

echo "Step 5: Writing .env from .env.contracts..."
if [ -f "$ROOT/.env.contracts" ]; then
  # Merge .env.contracts values into .env
  if [ -f "$ROOT/.env" ]; then
    echo "  .env already exists, skipping."
  else
    cp "$ROOT/.env.example" "$ROOT/.env"
    # Append contract values
    cat "$ROOT/.env.contracts" >> "$ROOT/.env"
    echo "  Created .env with contract values."
  fi
fi

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Next steps:"
echo "  pnpm dev:backend   # Start backend (port 3001)"
echo "  pnpm dev:web       # Start frontend (port 3000)"
