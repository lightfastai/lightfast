# Auth App Development Guide

## Local Testing

When testing the auth app locally, password login is configured with the following test credentials:

- **Email**: `admin@lightfast.ai`
- **Password**: `ijXFdBJ3U2eMDFnKqngp`

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