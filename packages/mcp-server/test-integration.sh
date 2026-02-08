#!/usr/bin/env bash
set -e

echo "=== Clawtown MCP Server Integration Test ==="
echo ""

# Configuration
BASE_URL="http://localhost:3100"
PLAYER_ID="test-player-$(date +%s)"

echo "1. Creating join code for test player..."
JOIN_CODE=$(curl -s -X POST "$BASE_URL/api/join/code" \
  -H 'Content-Type: application/json' \
  -d "{\"playerId\":\"$PLAYER_ID\"}" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)

if [ -z "$JOIN_CODE" ]; then
  echo "❌ Failed to create join code"
  exit 1
fi

echo "✅ Join code created: $JOIN_CODE"

JOIN_TOKEN="CT1|$BASE_URL|$JOIN_CODE"
echo "✅ Join token: $JOIN_TOKEN"
echo ""

echo "2. Testing MCP server with join token..."
export TEST_BASE_URL="$BASE_URL"
export TEST_JOIN_TOKEN="$JOIN_TOKEN"

node ./test.mjs

echo ""
echo "=== Integration Test Complete ==="
