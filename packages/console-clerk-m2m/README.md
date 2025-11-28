# @repo/console-clerk-m2m

Console-specific Clerk Machine-to-Machine (M2M) authentication package.

## Overview

This package provides M2M token management and verification for the Console application's internal service communication. It abstracts Clerk's M2M authentication system for server-to-server communication between:

- **tRPC API** (receiver) - Verifies all incoming M2M tokens
- **Webhook Handler** (sender) - Authenticates with tRPC using pre-created tokens
- **Inngest Workflows** (sender) - Authenticates with tRPC using pre-created tokens

## Why a Separate Package?

M2M authentication is **console-specific** functionality, not a general Clerk feature:

- Only the Console app uses M2M for internal service communication
- The Chat app uses different authentication patterns
- M2M configuration requires console-specific environment variables
- Keeping it separate maintains clear boundaries between general vendor abstractions and app-specific features

## Installation

This package is part of the monorepo workspace:

```json
{
  "dependencies": {
    "@repo/console-clerk-m2m": "workspace:*"
  }
}
```

## Environment Variables

Required environment variables (defined in `src/env.ts`):

```bash
# tRPC Machine - Secret key to VERIFY all incoming M2M tokens
CLERK_MACHINE_SECRET_KEY_TRPC=ak_xxx

# Webhook Machine - Pre-created long-lived token (365 days)
CLERK_M2M_TOKEN_WEBHOOK=mt_xxx
CLERK_M2M_MACHINE_ID_WEBHOOK=mch_xxx

# Inngest Machine - Pre-created long-lived token (365 days)
CLERK_M2M_TOKEN_INNGEST=mt_xxx
CLERK_M2M_MACHINE_ID_INNGEST=mch_xxx
```

See `docs/M2M_SETUP_GUIDE.md` for setup instructions.

## Usage

### Get Token for a Service

```typescript
import { getM2MToken } from "@repo/console-clerk-m2m";

// For webhook handlers
const token = getM2MToken("webhook");
headers.set("authorization", `Bearer ${token}`);

// For Inngest workflows
const token = getM2MToken("inngest");
headers.set("authorization", `Bearer ${token}`);
```

### Verify Incoming Token

```typescript
import { verifyM2MToken } from "@repo/console-clerk-m2m";

const authHeader = request.headers.get("authorization");
const token = authHeader?.replace("Bearer ", "");
const verified = await verifyM2MToken(token);

if (verified.expired || verified.revoked) {
  throw new Error("Invalid token");
}

// Check which machine sent the request
console.log("Request from machine:", verified.subject);
```

### Check if M2M is Configured

```typescript
import { isM2MConfigured } from "@repo/console-clerk-m2m";

if (isM2MConfigured("webhook")) {
  // Use M2M authentication
  const caller = await createWebhookCaller();
} else {
  // Fallback to legacy auth
  const caller = await createLegacyCaller();
}
```

### Validate Service-Specific Tokens

```typescript
import { getExpectedMachineId } from "@repo/console-clerk-m2m";

const verified = await verifyM2MToken(token);
const expectedId = getExpectedMachineId("webhook");

if (verified.subject !== expectedId) {
  throw new Error("Token from wrong machine");
}
```

## Architecture

### Token Creation (One-Time Setup)

1. Create 3 machines in Clerk Dashboard
2. Configure scopes (who can talk to who)
3. Run `scripts/setup-m2m-tokens.ts` to generate long-lived tokens
4. Store tokens in environment variables

### Token Usage (Runtime)

1. Sender service gets its token via `getM2MToken()`
2. Sender includes token in Authorization header
3. Receiver (tRPC) verifies token via `verifyM2MToken()`
4. Receiver checks `subject` field matches expected machine ID

## Security

- **Long-lived tokens**: 365-day expiration (set calendar reminder)
- **Token verification**: Uses Clerk's OAuth 2.0 verification
- **Machine isolation**: Each service has separate credentials
- **Audit trail**: `subject` field identifies which machine made the call
- **Revocation**: Tokens can be revoked in Clerk Dashboard

## Integration

This package is used by:

- **@repo/console-trpc** - Creates authenticated callers for webhook and Inngest
- **@api/console** - Verifies M2M tokens in tRPC context
- **scripts/setup-m2m-tokens.ts** - Token generation script

## Documentation

- Setup Guide: `docs/M2M_SETUP_GUIDE.md`
- Clerk M2M Docs: https://clerk.com/docs/machine-auth/m2m-tokens

## Development

```bash
# Build
pnpm --filter @repo/console-clerk-m2m build

# Typecheck
pnpm --filter @repo/console-clerk-m2m typecheck

# Clean
pnpm --filter @repo/console-clerk-m2m clean
```
