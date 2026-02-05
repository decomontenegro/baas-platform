#!/bin/bash
# =============================================================================
# Generate Secure Webhook Secret
# =============================================================================
# Usage: ./scripts/generate-webhook-secret.sh
#
# Generates a cryptographically secure random string suitable for use as
# a webhook signing secret for Clawdbot webhook verification.
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Generate 32 bytes of random data and encode as hex (64 characters)
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    elif command -v head &> /dev/null && [ -r /dev/urandom ]; then
        head -c 32 /dev/urandom | xxd -p | tr -d '\n'
    else
        echo "Error: Neither openssl nor /dev/urandom available" >&2
        exit 1
    fi
}

# Main
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Clawdbot Webhook Secret Generator    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

SECRET=$(generate_secret)

echo -e "${GREEN}✓ Generated secure webhook secret:${NC}"
echo ""
echo -e "  ${YELLOW}${SECRET}${NC}"
echo ""
echo -e "${BLUE}Add this to your .env file:${NC}"
echo ""
echo -e "  CLAWDBOT_WEBHOOK_SECRET=\"${SECRET}\""
echo ""
echo -e "${BLUE}Configure the same secret in your Clawdbot Gateway:${NC}"
echo ""
echo -e "  1. Edit your Clawdbot config (e.g., ~/.config/clawdbot/config.yaml)"
echo -e "  2. Add under webhooks section:"
echo -e "     webhooks:"
echo -e "       - url: https://your-baas-app.com/api/clawdbot/webhook"
echo -e "         secret: ${SECRET}"
echo -e "         events: ['*']"
echo ""
echo -e "${RED}⚠ IMPORTANT: Keep this secret safe! Do not commit it to version control.${NC}"
echo ""
