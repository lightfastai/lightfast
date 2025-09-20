# Auth App Development Guide

## Local Testing

When testing the auth app locally, password login is configured with the following test credentials:

- **Email**: `admin@lightfast.ai`
- **Password**: `ijXFdBJ3U2eMDFnKqngp`

Testing with new fresh accounts:

-- **Email**:`some-email+clerk_test@lightfast.ai`
-- **Verification Code**: `424242`

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
