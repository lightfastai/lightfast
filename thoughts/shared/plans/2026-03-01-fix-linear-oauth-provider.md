# Fix Linear OAuth Provider Implementation Plan

## Overview

The Linear provider (`apps/connections/src/providers/impl/linear.ts`) was incorrectly scaffolded with programmatic webhook registration via GraphQL mutations. Linear OAuth apps configure webhooks at the app level (like GitHub/Vercel) — Linear automatically creates webhooks in each org that authorizes the app. The provider also lacks refresh token support, which is now required for post-October 2025 Linear apps.

## Current State Analysis

The Linear provider has 6 issues:

1. **Wrong webhook model** — `requiresWebhookRegistration = true` with manual `registerWebhook()`/`deregisterWebhook()` GraphQL mutations. Should be `false` since webhooks are configured in the Linear OAuth app settings panel and auto-created per org on authorization.
2. **Missing `refresh_token` in schema** — `linearOAuthResponseSchema` doesn't parse `refresh_token` from token exchange response.
3. **`exchangeCode()` drops refresh token** — Even if parsed, `refreshToken` is not included in the returned `OAuthTokens`.
4. **`refreshToken()` throws** — Returns `Promise.reject()` instead of implementing the actual refresh flow.
5. **`resolveToken()` can't refresh expired tokens** — Throws `"token_expired"` instead of checking for a refresh token and refreshing (as Sentry does).
6. **`handleCallback()` has dead webhook registration code** — Lines 342-381 attempt to register webhooks programmatically and store per-installation `webhookSecret` / `metadata.webhookId`, which is unnecessary.

### Key Discoveries:
- Linear OAuth app webhook config in `integration-specs.json:120-135` — URL, resource types, and signing secret are set at app level
- `LINEAR_WEBHOOK_SIGNING_SECRET` env var exists for shared app-level secret (`apps/connections/src/env.ts`)
- Sentry provider at `apps/connections/src/providers/impl/sentry.ts:244-280` is the reference pattern for token refresh in `resolveToken()`
- `updateTokenRecord()` in `apps/connections/src/lib/token-store.ts:76-107` handles rotating refresh tokens correctly
- Linear refresh endpoint: `POST https://api.linear.app/oauth/token` with `grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`

## Desired End State

A Linear provider that:
- Uses app-level webhook registration (no programmatic webhook creation)
- Parses and stores refresh tokens from token exchange
- Refreshes expired access tokens automatically in `resolveToken()`
- Has a clean `handleCallback()` without dead webhook code

### Verification:
- `pnpm typecheck` passes
- `pnpm lint` passes
- Provider correctly handles the OAuth callback flow (manual test)
- Token resolution refreshes expired tokens (verified via code review against Sentry pattern)

## What We're NOT Doing

- Implementing PKCE flow (not needed for server-side OAuth)
- Adding `actor=app` support (agent/service-account mode — future feature)
- Changing the `events` array content (keeping existing resource types from integration-specs)
- Modifying any other providers
- Changing the database schema

## Implementation Approach

Single phase — the file is small (~415 lines) and all changes are tightly coupled. We'll fix the schema, rewrite the provider methods, and remove dead code.

## Phase 1: Fix Linear Provider

### Overview
Fix the Zod schema, implement refresh token flow, remove programmatic webhook registration, and update `resolveToken()` to handle token refresh.

### Changes Required:

#### 1. Update Zod Schema
**File**: `apps/connections/src/providers/schemas.ts`
**Changes**: Add `refresh_token` to `linearOAuthResponseSchema`

```typescript
export const linearOAuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
});
```

#### 2. Rewrite Linear Provider
**File**: `apps/connections/src/providers/impl/linear.ts`
**Changes**:

**a) Change `requiresWebhookRegistration` to `false`:**
```typescript
readonly requiresWebhookRegistration = false as const;
```

**b) Update `exchangeCode()` to pass through refresh token:**
```typescript
return {
  accessToken: data.access_token,
  refreshToken: data.refresh_token,
  tokenType: data.token_type,
  scope: data.scope,
  expiresIn: data.expires_in,
  raw: rawData as Record<string, unknown>,
};
```

**c) Implement `refreshToken()` — follow Linear docs:**
```typescript
async refreshToken(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Linear token refresh failed: ${response.status}`);
  }

  const rawData: unknown = await response.json();
  const data = linearOAuthResponseSchema.parse(rawData);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type,
    scope: data.scope,
    expiresIn: data.expires_in,
    raw: rawData as Record<string, unknown>,
  };
}
```

**d) Remove `registerWebhook()` and `deregisterWebhook()` methods entirely.**

**e) Simplify `handleCallback()` — remove webhook registration block and reactivation check:**
- Remove the `existing` query + `reactivated` flag (was only used to conditionally register webhooks)
- Remove lines 342-381 (webhook registration try/catch)
- Set `events` statically from app config: `["Issue", "Comment", "IssueLabel", "Project", "Cycle"]`
- Remove `metadata` and `webhookSecret` fields from the installation

```typescript
async handleCallback(
  c: Context,
  stateData: CallbackStateData,
): Promise<CallbackResult> {
  const code = c.req.query("code");
  if (!code) { throw new Error("missing code"); }

  const redirectUri = `${connectionsBaseUrl}/connections/${this.name}/callback`;
  const oauthTokens = await this.exchangeCode(code, redirectUri);

  const linearContext = await this.fetchLinearContext(oauthTokens.accessToken);
  const externalId = linearContext.externalId;
  const now = new Date().toISOString();

  const accountInfo: LinearAccountInfo = {
    version: 1,
    sourceType: "linear",
    events: ["Issue", "Comment", "IssueLabel", "Project", "Cycle"],
    installedAt: now,
    lastValidatedAt: now,
    raw: {
      token_type: oauthTokens.tokenType,
      scope: oauthTokens.scope,
      expires_in: oauthTokens.expiresIn ?? undefined,
    },
    ...(linearContext.organizationName || linearContext.organizationUrlKey
      ? {
          organization: {
            id: linearContext.externalId,
            name: linearContext.organizationName,
            urlKey: linearContext.organizationUrlKey,
          },
        }
      : {}),
  };

  // Idempotent upsert keyed on unique (provider, externalId) constraint
  const rows = await db
    .insert(gwInstallations)
    .values({
      provider: this.name,
      externalId,
      connectedBy: stateData.connectedBy,
      orgId: stateData.orgId,
      status: "active",
      providerAccountInfo: accountInfo,
    })
    .onConflictDoUpdate({
      target: [gwInstallations.provider, gwInstallations.externalId],
      set: {
        status: "active",
        connectedBy: stateData.connectedBy,
        orgId: stateData.orgId,
        providerAccountInfo: accountInfo,
        updatedAt: now,
      },
    })
    .returning({
      id: gwInstallations.id,
    });

  const installation = rows[0];
  if (!installation) { throw new Error("upsert_failed"); }

  await writeTokenRecord(installation.id, oauthTokens);

  return {
    status: "connected",
    installationId: installation.id,
    provider: this.name,
  };
}
```

**f) Update `resolveToken()` to handle refresh — follow Sentry pattern:**
```typescript
async resolveToken(installation: GwInstallation): Promise<TokenResult> {
  const tokenRows = await db
    .select()
    .from(gwTokens)
    .where(eq(gwTokens.installationId, installation.id))
    .limit(1);

  const tokenRow = tokenRows[0];
  if (!tokenRow) { throw new Error("no_token_found"); }

  // Check expiry and refresh if needed
  if (tokenRow.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
    if (!tokenRow.refreshToken) {
      throw new Error("token_expired:no_refresh_token");
    }

    const decryptedRefresh = decrypt(tokenRow.refreshToken, env.ENCRYPTION_KEY);
    const refreshed = await this.refreshToken(decryptedRefresh);

    await updateTokenRecord(tokenRow.id, refreshed, tokenRow.refreshToken, tokenRow.expiresAt);

    return {
      accessToken: refreshed.accessToken,
      provider: this.name,
      expiresIn: refreshed.expiresIn ?? null,
    };
  }

  const decryptedToken = decrypt(tokenRow.accessToken, env.ENCRYPTION_KEY);
  return {
    accessToken: decryptedToken,
    provider: this.name,
    expiresIn: tokenRow.expiresAt
      ? Math.floor((new Date(tokenRow.expiresAt).getTime() - Date.now()) / 1000)
      : null,
  };
}
```

**g) Clean up imports:**
- Remove: `nanoid` (was used for webhookSecret)
- Remove: `and` from drizzle-orm (was used for existing installation query)
- Add: `updateTokenRecord` from token-store
- Remove: `gatewayBaseUrl` from urls (was used for webhook callback URL)

Final imports:
```typescript
import { db } from "@db/console/client";
import { gwInstallations, gwTokens } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { decrypt } from "@repo/lib";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { env } from "../../env.js";
import { writeTokenRecord, updateTokenRecord } from "../../lib/token-store.js";
import { connectionsBaseUrl } from "../../lib/urls.js";
import { linearOAuthResponseSchema } from "../schemas.js";
import type {
  ConnectionProvider,
  LinearAccountInfo,
  LinearAuthOptions,
  TokenResult,
  OAuthTokens,
  CallbackResult,
  CallbackStateData,
} from "../types.js";
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build passes: `pnpm build --filter=connections`

#### Manual Verification:
- [ ] OAuth flow completes: authorize → callback → installation created with correct `providerAccountInfo`
- [ ] Token resolution works for non-expired tokens
- [ ] Code review confirms refresh flow matches Sentry pattern exactly

---

## Testing Strategy

### Code Review Verification:
- Compare final `resolveToken()` against Sentry's (`sentry.ts:244-280`) — should be structurally identical
- Compare final `handleCallback()` against GitHub's (`github.ts:115-202`) — similar pattern (no webhook registration)
- Verify `exchangeCode()` passes `refreshToken` through correctly
- Verify `refreshToken()` uses `application/x-www-form-urlencoded` content type (Linear requirement)

### Manual Testing Steps:
1. Start dev server with `pnpm dev:app`
2. Initiate Linear OAuth flow from console
3. Authorize the app in Linear
4. Verify installation appears in DB with correct `providerAccountInfo`
5. Verify token record has `refresh_token` (if app is post-Oct 2025)
6. Call `/connections/:id/token` endpoint and verify token resolution

## References

- Linear OAuth docs: https://linear.app/developers/oauth-2-0-authentication
- Linear webhook docs: https://linear.app/developers/webhooks
- Integration specs: `apps/connections/integration-specs.json:109-136`
- Sentry refresh pattern: `apps/connections/src/providers/impl/sentry.ts:244-280`
- GitHub callback pattern: `apps/connections/src/providers/impl/github.ts:115-202`
- Token store: `apps/connections/src/lib/token-store.ts`
