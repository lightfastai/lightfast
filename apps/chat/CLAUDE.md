# Chat App Development Guide

## Local Testing

When testing the chat app locally, password login is configured with the following test credentials:

- **Email**: `admin@lightfast.ai`
- **Password**: `ijXFdBJ3U2eMDFnKqngp`

Testing with new fresh accounts:

- **Email**: `some-email+clerk_test@lightfast.ai`
- **Verification Code**: `424242`

## Development Commands

```bash
# Start chat app development server
pnpm dev:chat

# Build chat app only
pnpm build:chat

# Type check chat app
pnpm --filter @lightfast/chat typecheck

# Lint chat app
pnpm --filter @lightfast/chat lint
```