#!/usr/bin/env bash

# Script to generate a secure health check authentication token
# Usage: ./scripts/generate-health-token.sh

echo "Generating secure health check authentication token..."
echo ""

# Generate a 32-byte (64 character) hex token
TOKEN=$(openssl rand -hex 32)

echo "Generated token:"
echo "================"
echo "$TOKEN"
echo ""
echo "Add this to your .env file:"
echo "HEALTH_CHECK_AUTH_TOKEN=$TOKEN"
echo ""
echo "Configure in BetterStack:"
echo "1. Go to your uptime monitor settings"
echo "2. Set HTTP method to: GET"
echo "3. Add request header:"
echo "   Header name: Authorization"
echo "   Header value: Bearer $TOKEN"
echo ""
echo "Optional: Add a custom User-Agent header to identify BetterStack:"
echo "   Header name: User-Agent"
echo "   Header value: BetterStack-Monitor/1.0"