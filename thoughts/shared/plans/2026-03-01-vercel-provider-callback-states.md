# Vercel Provider Callback State Handling

## Overview

Apply GitHub-style best practices to the Vercel provider's `handleCallback` — explicit state routing, defensive validation of all callback query params, reactivation detection, and proper `next` URL redirect to complete the Vercel installation lifecycle.

## Current State Analysis

**GitHub provider (reference)** at `apps/connections/src/providers/impl/github.ts:115-202`:
- Explicitly routes on `setup_action` query param (`request`, `update`, `install`)
- Throws "not yet implemented" for unhandled states
- Validates required `installation_id` param
- Detects reactivation (existing installation → `reactivated: true` in result)

**Vercel provider (current)** at `apps/connections/src/providers/impl/vercel.ts:90-161`:
- Only checks for `code` query param — missing `code` throws
- Does not validate `configurationId` from callback
- Does not use `next` URL (Vercel may invalidate tokens without it)
- No reactivation detection
- No cross-validation of callback `configurationId` vs token exchange `installation_id`

### Key Discoveries:
- Vercel sends 4 callback params: `code`, `configurationId`, `teamId`, `next`, `state` (`connections.ts:133`)
- `configurationId` = `installation_id` from token exchange (same `icfg_*` value, different names)
- `next` URL must be navigated to for Vercel to mark installation complete (per Vercel docs)
- Vercel does NOT have a `setup_action` equivalent — state must be inferred from database lookup
- `configurationId` values are never reused after removal — reinstalls always get new `icfg_*` IDs
- Vercel tokens are long-lived (no expiry) for external OAuth flow integrations
- Route handler at `connections.ts:206-246` already supports `result.nextUrl` via `CallbackResult`'s index signature `[key: string]: unknown`

## Desired End State

The Vercel `handleCallback` mirrors GitHub's defensive patterns:
1. All callback query params are explicitly extracted and validated
2. `configurationId` is cross-validated against the token exchange `installation_id`
3. Reactivation is detected (existing installation for same `externalId`)
4. `next` URL is returned in `CallbackResult` so the route handler redirects there
5. The route handler respects `nextUrl` when present, completing Vercel's installation lifecycle

### Verification:
- `pnpm typecheck` passes
- `pnpm lint` passes
- Vercel OAuth callback flow works end-to-end (manual test)
- CLI polling still detects completion via Redis
- Existing installations are not affected

## What We're NOT Doing

- **Native Marketplace migration**: Not migrating from "external" OAuth flow to Vercel's newer "native marketplace" OIDC flow
- **Webhook lifecycle handling**: `integration-configuration.removed` and `integration-configuration.permission-updated` webhook handling belongs in the gateway, not the callback
- **Vercel `teamId` scoping**: Not adding per-team scoping logic to API calls (already handled by the access token's scope)
- **Token refresh**: Vercel external-flow tokens don't expire — no refresh logic needed

## Implementation Approach

Two files changed, one concern per phase:
1. **Phase 1**: Vercel provider — defensive callback with all state routing
2. **Phase 2**: Route handler — respect `nextUrl` in callback results

---

## Phase 1: Vercel Provider Defensive Callback

### Overview
Refactor `VercelProvider.handleCallback` to extract and validate all Vercel callback params, detect reactivation, and cross-validate identifiers.

### Changes Required:

#### 1. `apps/connections/src/providers/impl/vercel.ts` — `handleCallback` method

**Current** (lines 90-161): Only extracts `code`, exchanges, upserts.

**New**: Extract all params, validate, detect reactivation, cross-validate, return `nextUrl`.

```typescript
async handleCallback(
  c: Context,
  stateData: CallbackStateData,
): Promise<CallbackResult> {
  const code = c.req.query("code");
  const configurationId = c.req.query("configurationId");
  const next = c.req.query("next");

  // ── Validate required params ──

  if (!code) {
    throw new Error("missing code");
  }

  if (!configurationId) {
    throw new Error("missing configurationId");
  }

  // ── Exchange code for tokens ──

  const redirectUri = `${connectionsBaseUrl}/connections/${this.name}/callback`;
  const oauthTokens = await this.exchangeCode(code, redirectUri);

  const parsed = vercelOAuthResponseSchema.parse(oauthTokens.raw);

  // Cross-validate: callback configurationId must match token exchange installation_id
  if (parsed.installation_id !== configurationId) {
    throw new Error(
      `configurationId mismatch: callback=${configurationId} token=${parsed.installation_id}`,
    );
  }

  // team_id for team accounts, user_id for personal accounts
  const externalId = parsed.team_id ?? parsed.user_id;

  // ── Detect reactivation ──

  const existing = await db
    .select({ id: gwInstallations.id })
    .from(gwInstallations)
    .where(
      and(
        eq(gwInstallations.provider, "vercel"),
        eq(gwInstallations.externalId, externalId),
      ),
    )
    .limit(1);

  const reactivated = existing.length > 0;

  // ── Build account info ──

  const now = new Date().toISOString();

  const accountInfo: VercelAccountInfo = {
    version: 1,
    sourceType: "vercel",
    events: [
      "deployment.created",
      "deployment.ready",
      "deployment.succeeded",
      "deployment.error",
      "deployment.canceled",
      "project.created",
      "project.removed",
      "integration-configuration.removed",
      "integration-configuration.permission-updated",
    ],
    installedAt: now,
    lastValidatedAt: now,
    raw: {
      token_type: parsed.token_type,
      installation_id: parsed.installation_id,
      user_id: parsed.user_id,
      team_id: parsed.team_id,
    },
  };

  // ── Upsert installation ──

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
      },
    })
    .returning({ id: gwInstallations.id });

  const installation = rows[0];
  if (!installation) {
    throw new Error("upsert_failed");
  }

  await writeTokenRecord(installation.id, oauthTokens);

  return {
    status: "connected",
    installationId: installation.id,
    provider: this.name,
    ...(reactivated && { reactivated: true }),
    ...(next && { nextUrl: next }),
  };
}
```

**Key changes from current:**
1. **Lines +3-4**: Extract `configurationId` and `next` from query params
2. **Lines +10-12**: Validate `configurationId` is present (like GitHub validates `installation_id`)
3. **Lines +21-25**: Cross-validate `configurationId` against token exchange `installation_id`
4. **Lines +31-42**: Reactivation detection (matches GitHub pattern at `github.ts:155-166`)
5. **Line +91**: Spread `reactivated` and `nextUrl` into result (matches GitHub's `reactivated` pattern)

**New import needed**: Add `and` to the drizzle-orm import (currently only imports `eq`).

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] New Vercel installation works end-to-end (code exchange, upsert, token store)
- [ ] Reinstalling same Vercel account shows `reactivated=true` in redirect URL
- [ ] Missing `configurationId` in callback returns clear error

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Route Handler `nextUrl` Redirect

### Overview
Update the callback route handler to check for `nextUrl` in `CallbackResult` and redirect to it when present, completing Vercel's installation lifecycle.

### Changes Required:

#### 1. `apps/connections/src/routes/connections.ts` — callback handler redirect logic

**File**: `apps/connections/src/routes/connections.ts`
**Location**: After Redis result store (line 204), before redirect logic (line 206)

Insert `nextUrl` handling before the existing redirect logic:

```typescript
    // Provider-specific redirect (e.g. Vercel "next" URL to complete installation lifecycle)
    if (typeof result.nextUrl === "string") {
      return c.redirect(result.nextUrl);
    }

    const redirectTo = stateData.redirectTo;
    // ... existing redirect logic unchanged ...
```

**Rationale**: When a provider returns `nextUrl`, it takes priority over our `redirectTo` because:
- The provider's lifecycle completion depends on it (Vercel invalidates tokens without it)
- Redis result is already stored (line 195-204), so CLI polling still works
- `reactivated` status is already stored in Redis for downstream use

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Vercel callback redirects to Vercel's `next` URL after setup
- [ ] CLI OAuth polling still receives completion status via Redis
- [ ] GitHub callback (no `nextUrl`) continues to use existing redirect flow
- [ ] Linear/Sentry callbacks (no `nextUrl`) are unaffected

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Manual Testing Steps:
1. Initiate Vercel connection from console → verify redirect to Vercel install page
2. Complete Vercel install → verify callback extracts `configurationId` and `next`
3. Verify redirect goes to Vercel's `next` URL (not our console)
4. Verify installation appears in DB with correct `providerAccountInfo`
5. Reinstall same Vercel account → verify `reactivated=true` in Redis result
6. Test CLI flow → verify polling detects completion despite `next` redirect
7. Test GitHub flow → verify no behavioral changes
8. Test with missing `configurationId` in callback URL → verify error message

### Edge Cases:
- Personal Vercel account (no `teamId`) → `externalId = user_id`
- Team Vercel account → `externalId = team_id`
- Code already consumed (one-time use) → token exchange fails with clear error
- `configurationId` mismatch → explicit error message

## References

- GitHub provider reference: `apps/connections/src/providers/impl/github.ts:115-202`
- Vercel provider: `apps/connections/src/providers/impl/vercel.ts`
- Route handler: `apps/connections/src/routes/connections.ts:133-291`
- Vercel Integration docs: https://vercel.com/docs/integrations/create-integration/vercel-api-integrations
- Vercel webhook events: https://vercel.com/docs/webhooks/webhooks-api
