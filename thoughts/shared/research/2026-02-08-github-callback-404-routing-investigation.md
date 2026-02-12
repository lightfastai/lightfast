---
date: 2026-02-08T03:12:46+0000
researcher: Jeevana
git_commit: 3d0624e619ecd13dbfa10a6ea446611b93c84b7b
branch: main
repository: lightfast
topic: "GitHub OAuth Callback 404 Investigation"
tags: [research, codebase, github, oauth, routing, callback, next-js, microfrontends]
status: complete
last_updated: 2026-02-08
last_updated_by: Jeevana
---

# Research: GitHub OAuth Callback 404 Investigation

**Date**: 2026-02-08T03:12:46+0000
**Researcher**: Jeevana
**Git Commit**: 3d0624e619ecd13dbfa10a6ea446611b93c84b7b
**Branch**: main
**Repository**: lightfast

## Research Question

Why does the URL `lightfast.ai/api/github/callback?code=e58d3ad0da3014bdf3f1&installation_id=108719680&setup_action=install` return a 404 error instead of completing the GitHub App installation?

## Summary

The `/api/github/callback` route **does not exist** in the console codebase. The GitHub OAuth flow uses different endpoint naming:

- **Setup URL** (after app installation): `/api/github/app-installed`
- **Callback URL** (after user OAuth): `/api/github/user-authorized`

The 404 occurs because the GitHub App is configured to redirect to `/api/github/callback`, which has no corresponding route handler in the Next.js App Router. The actual OAuth flow expects callbacks at `/api/github/user-authorized`.

## Detailed Findings

### Missing Route

**File Structure**: `apps/console/src/app/(github)/api/github/`

```
apps/console/src/app/(github)/
├── api/
│   └── github/
│       ├── install-app/route.ts       (✓ exists)
│       ├── app-installed/route.ts     (✓ exists)
│       ├── authorize-user/route.ts    (✓ exists)
│       ├── user-authorized/route.ts   (✓ exists)
│       ├── webhooks/route.ts          (✓ exists)
│       └── callback/                  (✗ DOES NOT EXIST)
```

The glob search for `**/api/github/callback/**` returned no results, confirming this route is not implemented.

### Actual GitHub OAuth Flow

The implemented flow uses a two-stage process:

#### Stage 1: GitHub App Installation
1. User visits `/api/github/install-app` ([route.ts:23](apps/console/src/app/(github)/api/github/install-app/route.ts#L23))
2. Redirects to `https://github.com/apps/{slug}/installations/new`
3. User installs app on GitHub.com
4. GitHub redirects to **Setup URL**: `/api/github/app-installed` ([route.ts:24](apps/console/src/app/(github)/api/github/app-installed/route.ts#L24))
5. This route stores `installation_id` in cookie and redirects to OAuth

#### Stage 2: User OAuth Authorization
6. Redirects to `/api/github/authorize-user` ([route.ts:24](apps/console/src/app/(github)/api/github/authorize-user/route.ts#L24))
7. Redirects to `https://github.com/login/oauth/authorize`
8. User authorizes on GitHub.com
9. GitHub redirects to **Callback URL**: `/api/github/user-authorized` ([route.ts:35](apps/console/src/app/(github)/api/github/user-authorized/route.ts#L35))
10. Exchanges code for token, fetches installations, stores in database
11. Redirects to `/github/connected` success page

### Expected GitHub App Configuration

From `apps/console/CLAUDE.md:171-199`:

**Production Configuration**:
- **Homepage URL**: `https://console.lightfast.com`
- **Callback URL**: `https://console.lightfast.com/api/github/user-authorized` ✓
- **Setup URL**: `https://console.lightfast.com/api/github/app-installed` ✓
- **Webhook URL**: `https://console.lightfast.com/api/github/webhooks` ✓

**Development Configuration**:
- **Homepage URL**: `http://localhost:3024`
- **Callback URL**: `http://localhost:3024/api/github/user-authorized` ✓
- **Setup URL**: `http://localhost:3024/api/github/app-installed` ✓
- **Webhook URL**: `https://your-ngrok-url.ngrok.io/api/github/webhooks` ✓

Note: Port 3024 is the Vercel microfrontends proxy that routes to the console app (port 4107).

### Route Group Transparency

The `(github)` route group does NOT affect URL paths. Next.js App Router strips parentheses from URLs:

- File: `(github)/api/github/user-authorized/route.ts`
- URL: `/api/github/user-authorized`

Route groups are organizational only and do not create URL segments.

### Microfrontends Configuration

From `apps/console/microfrontends.json:1-64`:

The console app (`lightfast-console`) has no explicit `routing` configuration, making it the catch-all application. The `/api/github/*` paths are not claimed by `lightfast-www` or `lightfast-auth`, so they fall through to console.

**Result**: All GitHub API routes are served by the console app at port 4107 in development, or `https://lightfast.ai` in production.

### Base URL Resolution

From `apps/console/src/lib/base-url.ts:35-53`:

The `createBaseUrl()` function returns:
- **Production**: `https://lightfast.ai` (custom domain)
- **Preview**: `https://${VERCEL_URL}` (Vercel preview)
- **Development**: `http://localhost:4107` (default port)

Used throughout GitHub routes to construct OAuth redirect URIs ([app-installed/route.ts:38](apps/console/src/app/(github)/api/github/app-installed/route.ts#L38), [authorize-user/route.ts:28](apps/console/src/app/(github)/api/github/authorize-user/route.ts#L28)).

## Code References

### API Route Handlers
- `apps/console/src/app/(github)/api/github/install-app/route.ts:23-63` - Initiates GitHub App installation
- `apps/console/src/app/(github)/api/github/app-installed/route.ts:24-68` - Setup URL callback (receives installation_id)
- `apps/console/src/app/(github)/api/github/authorize-user/route.ts:24-62` - Initiates user OAuth
- `apps/console/src/app/(github)/api/github/user-authorized/route.ts:35-206` - Callback URL handler (exchanges code for token)
- `apps/console/src/app/(github)/api/github/webhooks/route.ts:462-608` - Webhook event receiver

### Supporting Files
- `apps/console/microfrontends.json:1-64` - Vercel microfrontends routing configuration
- `apps/console/src/lib/base-url.ts:35-60` - Environment-aware base URL utility
- `apps/console/src/app/(github)/github/connected/page.tsx:14-59` - OAuth success page
- `apps/console/CLAUDE.md:171-241` - GitHub App configuration documentation

### Packages
- `packages/console-oauth/src/state.ts:145-267` - OAuth state generation and validation
- `packages/console-oauth/src/tokens.ts:151-349` - Token encryption with AES-256-GCM
- `packages/console-octokit-github/src/index.ts:89-101` - GitHub API client (`getUserInstallations`)
- `api/console/src/router/user/user-sources.ts:279-376` - tRPC procedure for storing OAuth results

## Architecture Documentation

### OAuth State Management

**Generation** (`packages/console-oauth/src/state.ts:148-161`):
- 32-byte cryptographic random token
- 16-byte nonce for replay prevention
- Timestamp for expiration (10 minutes default)
- Optional `redirectPath` for custom callbacks
- Base64URL encoded for cookie storage

**Validation** (`packages/console-oauth/src/state.ts:197-267`):
- Constant-time token comparison
- Nonce replay prevention with in-memory Set
- Expiration check (configurable)
- Validation errors: `invalid_format`, `mismatch`, `already_used`, `expired`

### Cookie Configuration Pattern

All OAuth state cookies use the same configuration ([authorize-user/route.ts:51-57](apps/console/src/app/(github)/api/github/authorize-user/route.ts#L51-57)):

```typescript
{
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax", // CRITICAL: Required for external OAuth redirects
  maxAge: 600, // 10 minutes
  path: "/"
}
```

**SameSite "lax" requirement**: Comment at [authorize-user/route.ts:49-50](apps/console/src/app/(github)/api/github/authorize-user/route.ts#L49-50) explains that `sameSite: "strict"` would block cookies on external redirects from GitHub.

### Token Encryption

**Implementation** (`packages/console-oauth/src/tokens.ts:307-313`):
- AES-256-GCM authenticated encryption
- Random 12-byte IV per encryption
- 128-bit authentication tag
- Cookie format: `encryptedToken.iv.authTag`
- Used for short-lived access tokens (5 minutes)

### Database Storage

**Table**: `lightfast_user_sources` (`db/console/src/schema/tables/user-sources.ts:20-85`)

**Key Columns**:
- `userId` (Clerk user ID)
- `sourceType` ("github", "vercel")
- `accessToken` (encrypted text)
- `providerMetadata` (JSONB)

**GitHub Metadata Format**:
```json
{
  "version": 1,
  "sourceType": "github",
  "installations": [
    {
      "id": "108719680",
      "accountId": "12345",
      "accountLogin": "username",
      "accountType": "Organization",
      "avatarUrl": "https://...",
      "permissions": {...},
      "installedAt": "2026-02-08T...",
      "lastValidatedAt": "2026-02-08T..."
    }
  ]
}
```

**Upsert Pattern** ([user-sources.ts:314-375](api/console/src/router/user/user-sources.ts#L314-375)):
1. Check for existing record by `userId` + `sourceType`
2. Update if exists (set token, metadata, `isActive: true`)
3. Insert if new
4. Return `{ id, created }` boolean

### tRPC Auth Boundaries

**userScopedProcedure** ([user-sources.ts:279](api/console/src/router/user/user-sources.ts#L279)):
- No organization membership required
- Used for personal OAuth connections
- Allows "pending" users (users without org)
- Configured via `auth({ treatPendingAsSignedOut: false })`

This is why both [app-installed/route.ts:31](apps/console/src/app/(github)/api/github/app-installed/route.ts#L31) and [user-authorized/route.ts:110](apps/console/src/app/(github)/api/github/user-authorized/route.ts#L110) use `treatPendingAsSignedOut: false` - to support users creating their first workspace.

## Historical Context (from thoughts/)

### Authentication & OAuth Evolution

**Actor Identity Resolution**:
- `thoughts/shared/plans/2025-12-15-actor-implementation-bugfix-oauth.md` - Core insight: Users sign up via Clerk with GitHub OAuth, so Clerk already has `clerkUserId ↔ githubId` mapping
- `thoughts/shared/plans/2025-12-16-github-id-identity-resolution.md` - Implemented GitHub ID as single source of truth for actor identity

**Clerk Waitlist Integration**:
- `thoughts/shared/plans/2026-02-08-auth-sign-up-production-enablement.md` - Enabled sign-up with Clerk waitlist invitation tokens (`__clerk_ticket`)
- `thoughts/shared/plans/2026-02-08-clerk-waitlist-redirect-bug.md` - Fixed external redirect when waitlist blocks OAuth sign-in flows
- `thoughts/shared/research/2026-02-08-clerk-waitlist-redirect-bug.md` - Analysis of Clerk error codes (`sign_up_mode_restricted_waitlist`) and OAuth behavior

### GitHub Integration Research

**GitHub Apps Architecture**:
- `thoughts/shared/research/2025-12-10-github-pr-integration-research.md` - GitHub Apps provide webhook events and API access (recommended over OAuth Apps)
- `thoughts/shared/research/2025-12-10-github-issues-integration-research.md` - GitHub Issues integration with fine-grained permissions, 16+ webhook events
- `thoughts/shared/research/2025-12-10-integration-marketplace-console.md` - Two-table architecture (`userSources` + `workspaceIntegrations`)

**Clerk Limitations**:
- `thoughts/shared/research/2025-12-10-clerk-integration-research.md` - CRITICAL: Clerk does NOT support third-party marketplace integrations, designed to be embedded INTO applications

## Related Research

- `thoughts/shared/research/2026-02-06-web-analysis-clerk-middleware-auth-header-stripping.md` - Why Clerk middleware strips Authorization header on internal fetches
- `thoughts/shared/research/2025-12-16-auth-sign-in-redirect-loop.md` - Sign-in redirect loop related to Clerk organization feature
- `thoughts/shared/research/2025-12-16-github-id-source-of-truth-audit.md` - Clerk `ExternalAccountJSON` structure with `provider_user_id`

## Open Questions

1. **Production GitHub App Configuration**: Is the production GitHub App currently configured with `/api/github/callback` as the Callback URL? This would need to be updated to `/api/github/user-authorized`.

2. **Query Parameters**: The 404 URL includes `installation_id` and `setup_action` parameters, which are typical of the Setup URL callback, not the OAuth Callback URL. This suggests GitHub might be configured with `/api/github/callback` as the **Setup URL** instead of `/api/github/app-installed`.

3. **Historical Routes**: Was `/api/github/callback` ever implemented and later removed? Searching git history might reveal if this was a previous implementation.

4. **Development vs Production**: Are there different GitHub Apps for development and production environments? The CLAUDE.md suggests separate apps but doesn't confirm current configuration.
