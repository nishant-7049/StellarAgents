#!/usr/bin/env bash
set -euo pipefail
echo "=== AgentNet Demo Runner ==="
cd "$(dirname "$0")/.."
pnpm dev:backend &
BACKEND_PID=$!
echo "Waiting for backend..."
for i in {1..30}; do
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "Backend ready!"
    break
  fi
  sleep 1
done
echo ""
echo "=== Health Check ==="
curl -s http://localhost:3001/health | python3 -m json.tool
echo ""
echo "=== Yield Query (expects 402) ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/yield/query?q=best+yield")
echo "Status: $HTTP_CODE"
kill $BACKEND_PID 2>/dev/null
echo "Demo complete!"
