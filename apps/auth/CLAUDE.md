# Auth App Development Guide

## Test Accounts

Use Clerk test accounts for E2E testing (no real email required):

- **Email**: `some-email+clerk_test@lightfast.ai`
- **OTP Code**: `424242`

## Development Commands

```bash
# Start auth app development server
pnpm dev:auth

# Build auth app only
pnpm build:auth

# Type check auth app
pnpm --filter @lightfast/auth typecheck

# Lint auth app
pnpm --filter @lightfast/auth lint
```
