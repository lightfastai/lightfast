# Clerk M2M Authentication Setup Guide

Complete guide for setting up Machine-to-Machine (M2M) authentication for internal service communication.

## Overview

Our M2M architecture has **3 machines**:
- **tRPC API** (receiver) - Verifies all incoming M2M tokens
- **Webhook Handler** (sender) - Calls tRPC with pre-created token
- **Inngest Workflows** (sender) - Calls tRPC with pre-created token

## Prerequisites

- Clerk account with M2M feature enabled
- Access to Clerk Dashboard
- Environment variable access for all services

## Step 1: Create Machines in Clerk Dashboard

### 1.1 Create tRPC API Machine

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Machines** in sidebar
3. Click **Add machine**
4. Enter name: `tRPC API`
5. Click **Create**
6. Click `...` menu → **View machine secret**
7. Copy the secret key (starts with `ak_`)
8. Save as: `CLERK_MACHINE_SECRET_KEY_TRPC=ak_xxx`

### 1.2 Create Webhook Handler Machine

1. Click **Add machine**
2. Enter name: `Webhook Handler`
3. Click **Create**
4. Click `...` menu → **View machine secret**
5. Copy the secret key (starts with `ak_`)
6. Save temporarily as: `CLERK_MACHINE_SECRET_KEY_WEBHOOK=ak_xxx`
   (Only needed for token generation, not in production)

### 1.3 Create Inngest Workflows Machine

1. Click **Add machine**
2. Enter name: `Inngest Workflows`
3. Click **Create**
4. Click `...` menu → **View machine secret**
5. Copy the secret key (starts with `ak_`)
6. Save temporarily as: `CLERK_MACHINE_SECRET_KEY_INNGEST=ak_xxx`
   (Only needed for token generation, not in production)

## Step 2: Configure Machine Scopes

Scopes determine which machines can communicate with each other.

### 2.1 Configure Webhook Handler Scopes

1. Click **Webhook Handler** machine
2. Click **Edit**
3. In **Scopes** section, select **tRPC API**
4. Click **Update**

### 2.2 Configure Inngest Workflows Scopes

1. Click **Inngest Workflows** machine
2. Click **Edit**
3. In **Scopes** section, select **tRPC API**
4. Click **Update**

### 2.3 Configure tRPC API Scopes

1. Click **tRPC API** machine
2. Click **Edit**
3. In **Scopes** section, select:
   - **Webhook Handler**
   - **Inngest Workflows**
4. Click **Update**

⚠️ **Important**: Scope changes only apply to newly created M2M tokens!

## Step 3: Generate Long-Lived Tokens

Run the setup script to generate 365-day tokens:

```bash
# Set temporary environment variables
export CLERK_SECRET_KEY=sk_xxx
export CLERK_MACHINE_SECRET_KEY_WEBHOOK=ak_xxx
export CLERK_MACHINE_SECRET_KEY_INNGEST=ak_xxx

# Run setup script
pnpm tsx scripts/setup-m2m-tokens.ts
```

The script will output:
```
CLERK_M2M_TOKEN_WEBHOOK=mt_xxx
CLERK_M2M_MACHINE_ID_WEBHOOK=mch_xxx

CLERK_M2M_TOKEN_INNGEST=mt_xxx
CLERK_M2M_MACHINE_ID_INNGEST=mch_xxx
```

## Step 4: Set Production Environment Variables

Add these to your `.env` files:

```bash
# tRPC Machine (receiver)
CLERK_MACHINE_SECRET_KEY_TRPC=ak_xxx_from_step_1.1

# Webhook Machine (sender)
CLERK_M2M_TOKEN_WEBHOOK=mt_xxx_from_step_3
CLERK_M2M_MACHINE_ID_WEBHOOK=mch_xxx_from_step_3

# Inngest Machine (sender)
CLERK_M2M_TOKEN_INNGEST=mt_xxx_from_step_3
CLERK_M2M_MACHINE_ID_INNGEST=mch_xxx_from_step_3
```

## Step 5: Verify Setup

### 5.1 Test Webhook Authentication

```typescript
// In webhook handler
import { createCaller } from "@repo/console-trpc/server";

const caller = await createCaller();
const repo = await caller.sources.findByGithubRepoId({
  githubRepoId: "123"
});
```

Should see in logs:
```
[Webhook Context] Using M2M token
>>> tRPC Request from webhook-service - M2M token (machine: mch_xxx_webhook)
```

### 5.2 Test Inngest Authentication

```typescript
// In Inngest workflow
import { createInngestCaller } from "@repo/console-trpc/server";

const caller = await createInngestCaller();
const repo = await caller.sources.findByGithubRepoId({
  githubRepoId: "123"
});
```

Should see in logs:
```
>>> tRPC Request from inngest-workflow - M2M token (machine: mch_xxx_inngest)
```

## Troubleshooting

### Error: "Token verification failed"

**Cause**: Token was created before scopes were configured
**Solution**: Regenerate tokens using setup script after configuring scopes

### Error: "This endpoint requires webhook machine token"

**Cause**: Machine ID doesn't match expected ID
**Solution**: Verify `CLERK_M2M_MACHINE_ID_WEBHOOK` matches the subject field in token

### Error: "M2M not configured"

**Cause**: Missing environment variables
**Solution**: Check all 5 required env vars are set correctly

## Token Maintenance

### Token Expiration

Tokens expire after 365 days. Set calendar reminder for renewal:

1. Run setup script again 30 days before expiration
2. Update environment variables with new tokens
3. Deploy updated configuration
4. Old tokens continue working until expiration

### Token Revocation

To revoke a compromised token:

1. Go to Clerk Dashboard → **Machines**
2. Click machine → **View tokens**
3. Find token → Click **Revoke**
4. Generate new token using setup script
5. Update environment variables
6. Deploy immediately

## Security Best Practices

1. **Never commit tokens to git**
   - Use `.env` files (already in `.gitignore`)
   - Use secret management in production (Vercel, AWS Secrets Manager, etc.)

2. **Rotate tokens regularly**
   - Set up quarterly rotation schedule
   - Use setup script to generate new tokens
   - Update all environments

3. **Monitor token usage**
   - Review Clerk Dashboard for unexpected usage
   - Set up alerts for failed authentication attempts

4. **Principle of least privilege**
   - Each machine only has scopes it needs
   - Webhook can only call tRPC (not Inngest)
   - Inngest can only call tRPC (not Webhook)

## Cost Considerations

Clerk M2M pricing (as of 2025):
- Token creation: $0.001 per token
- Token verification: $0.0001 per verification

With 365-day tokens:
- **Token creation cost**: ~$0.002/year (2 tokens)
- **Token verification cost**: Based on request volume
  - 1M requests/month = $100/month
  - 100K requests/month = $10/month

## Migration from Legacy Auth

The system supports **gradual migration** from legacy webhook auth:

1. Set up M2M tokens (this guide)
2. Deploy with M2M environment variables
3. Services automatically use M2M when configured
4. Falls back to legacy auth if M2M not configured
5. Monitor logs for "Using legacy webhook auth" warnings
6. Once stable, remove legacy auth support

## Additional Resources

- [Clerk M2M Documentation](https://clerk.com/docs/machine-auth/m2m-tokens)
- [Clerk M2M API Reference](https://clerk.com/docs/reference/backend/m2m-tokens)
- [Example Implementation](https://github.com/clerk/m2m-example)
