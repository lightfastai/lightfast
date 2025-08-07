#!/usr/bin/env bash

# Test script for health endpoints
# Usage: ./scripts/test-health-endpoints.sh [token]

TOKEN=$1
BASE_URL="http://localhost"

echo "Testing health endpoints..."
echo "=========================="
echo ""

# Test each app's health endpoint
declare -a apps=("www:4101" "app:3000" "playground:3001" "auth:3002" "experimental:3003")

for app_port in "${apps[@]}"; do
    IFS=':' read -r app port <<< "$app_port"
    URL="$BASE_URL:$port/api/health"
    
    echo "Testing $app app at $URL"
    echo "----------------------------"
    
    # Test without token (should work if token not configured)
    echo -n "Without auth: "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null || echo "Failed")
    
    if [ "$response" = "200" ]; then
        echo "✅ Success (200)"
        # Get the response body
        curl -s "$URL" | jq '.' 2>/dev/null || curl -s "$URL"
    elif [ "$response" = "401" ]; then
        echo "🔒 Requires auth (401)"
    else
        echo "❌ Error or not running ($response)"
    fi
    
    # Test with token if provided
    if [ ! -z "$TOKEN" ]; then
        echo -n "With auth: "
        response=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$URL" 2>/dev/null || echo "Failed")
        
        if [ "$response" = "200" ]; then
            echo "✅ Success (200)"
            # Get the response body
            curl -s -H "Authorization: Bearer $TOKEN" "$URL" | jq '.' 2>/dev/null || curl -s -H "Authorization: Bearer $TOKEN" "$URL"
        elif [ "$response" = "401" ]; then
            echo "❌ Unauthorized (401) - Invalid token"
        else
            echo "❌ Error or not running ($response)"
        fi
    fi
    
    echo ""
done

echo "Testing complete!"
echo ""
echo "Note: Make sure the apps are running with 'pnpm dev' before testing."
echo "If auth is required (401), set HEALTH_CHECK_AUTH_TOKEN in your .env file."