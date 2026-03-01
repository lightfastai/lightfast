---
date: 2026-03-01T11:00:00+11:00
researcher: claude
git_commit: 3024fbdec5356fc24fe4499b83c1050b5b66ef75
branch: feat/connections-provider-account-info
repository: lightfast
topic: "Sentry listProjects failure — organizationSlug empty string"
tags: [research, sentry, connections, oauth, trpc]
status: complete
last_updated: 2026-03-01
last_updated_by: claude
---

# Research: Sentry listProjects Failure — organizationSlug Empty String

**Date**: 2026-03-01
**Git Commit**: 3024fbdec
**Branch**: feat/connections-provider-account-info

## Research Question

Sentry connection is stored with `organizationSlug: ""`. The `sentry-source-item.tsx` UI shows "Failed to load projects. The connection may need to be refreshed." when trying to list projects. What is wrong with fetching Sentry projects?

## Summary

The failure chain has two steps:

1. **Root cause**: During the OAuth callback, `GET https://sentry.io/api/0/organizations/` is called with the new Sentry app installation token to retrieve the org slug. This call silently fails (best-effort try/catch at `apps/connections/src/providers/impl/sentry.ts:191`), leaving `organizationSlug: ""` stored in `gwInstallations.providerAccountInfo`.

2. **Symptom**: `connections.sentry.listProjects` reads `organizationSlug` from the stored `providerAccountInfo` and throws `PRECONDITION_FAILED` when it is falsy (empty string `""` is falsy in JS), at `api/console/src/router/org/connections.ts:1030-1035`.

The UI component catches any error from `listProjects` and shows the generic "Failed to load projects" message.

**Key evidence**: The stored connection shows `"organizationSlug": ""` and was installed at `2026-03-01T10:45:59.395Z` — which is **after** the commit `3024fbdec` (2026-03-01T10:37:13Z) that introduced the `GET /api/0/organizations/` fetch. This means the fetch is in place but is silently failing for Sentry app installation tokens.

## Detailed Findings

### 1. OAuth Callback — organizationSlug extraction

**File**: `apps/connections/src/providers/impl/sentry.ts:180-193`

```typescript
let organizationSlug = "";
try {
  const orgsResponse = await fetch("https://sentry.io/api/0/organizations/", {
    headers: { Authorization: `Bearer ${oauthTokens.accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (orgsResponse.ok) {
    const orgs = await orgsResponse.json() as { slug: string }[];
    organizationSlug = orgs[0]?.slug ?? "";
  }
} catch {
  // Best-effort — organizationSlug will remain empty
}
```

The token here is a **Sentry app installation token** — obtained via `POST /api/0/sentry-app-installations/{installationId}/authorizations/` (line 39-54 in `sentry.ts`). This is different from a user OAuth token. The `/api/0/organizations/` endpoint's behavior with app installation tokens is the suspect: it either returns a non-OK response, an empty array, or an object shape that doesn't have a top-level `slug` array.

### 2. tRPC listProjects — precondition guard

**File**: `api/console/src/router/org/connections.ts:1029-1035`

```typescript
const orgSlug = providerAccountInfo.organizationSlug;
if (!orgSlug) {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Sentry organization slug not found. Please reconnect Sentry.",
  });
}
```

Empty string `""` evaluates as falsy, so this guard throws `PRECONDITION_FAILED`. The actual Sentry API call is at lines 1038-1044:

```typescript
const response = await fetch(
  `https://sentry.io/api/0/organizations/${orgSlug}/projects/`,
  { headers: { Authorization: `Bearer ${accessToken}` }, ... }
);
```

### 3. SentryAccountInfo type

**File**: `packages/gateway-types/src/account-info.ts:88-95`

```typescript
interface SentryAccountInfo extends BaseAccountInfo {
  sourceType: "sentry";
  raw: SentryOAuthRaw;
  installationId: string;   // Sentry's installation UUID (from query param)
  organizationSlug: string; // slug used for all subsequent API calls
}
```

`organizationSlug` is typed as `string` (not `string | null`), but the code stores `""` when the fetch fails, which passes the type check but fails the runtime `!orgSlug` guard.

### 4. UI component error display

**File**: `apps/console/src/app/(app)/(user)/new/_components/sentry-source-item.tsx:229-237`

```tsx
{projectsError ? (
  <div className="flex flex-col items-center py-6 text-center gap-3">
    <p className="text-sm text-destructive">
      Failed to load projects. The connection may need to be refreshed.
    </p>
    <Button onClick={handleConnect} variant="outline" size="sm">
      Reconnect Sentry
    </Button>
  </div>
) : ...}
```

`projectsError` is populated from `useQuery` which catches the `PRECONDITION_FAILED` TRPCError.

### 5. Stored connection data (from user's report)

```json
{
  "raw": {
    "scopes": ["alerts:read", "event:read", "org:read", "project:read"],
    "expiresAt": "2026-03-01T18:45:58.740295Z"
  },
  "events": ["installation", "issue", "error", "comment"],
  "version": 1,
  "sourceType": "sentry",
  "installedAt": "2026-03-01T10:45:59.395Z",
  "installationId": "693284ff-558c-46d4-8272-c134fd938d9d",
  "lastValidatedAt": "2026-03-01T10:45:59.395Z",
  "organizationSlug": ""   // ← empty, root cause
}
```

Note: `org:read` scope IS present in the stored scopes, so scope is not the problem.

## Failure Chain

```
OAuth Callback (sentry.ts:183)
  └─ GET /api/0/organizations/ with app installation Bearer token
     └─ Response: non-OK OR empty array OR unexpected shape
        └─ organizationSlug stays ""
           └─ Stored in gwInstallations.providerAccountInfo.organizationSlug = ""

listProjects tRPC call (connections.ts:1029)
  └─ reads providerAccountInfo.organizationSlug = ""
     └─ !orgSlug → true (empty string is falsy)
        └─ throws PRECONDITION_FAILED
           └─ useQuery sets projectsError
              └─ UI shows "Failed to load projects"
```

## Hypothesis: Why /api/0/organizations/ returns no orgs for app installation tokens

Sentry distinguishes between two token types:
- **User auth tokens**: Returned by `/api/0/auth/login/` — can call `/api/0/organizations/` to list all orgs the user belongs to
- **App installation tokens**: Returned by `/api/0/sentry-app-installations/{uuid}/authorizations/` — scoped to a single installation/org

For app installation tokens, `/api/0/organizations/` likely returns an empty array (the token is not a "user" with org memberships) or a 403. The `org:read` scope allows reading org details but the endpoint semantics differ.

The Sentry App installation itself contains the `organizationSlug` — it can be retrieved via `GET /api/0/sentry-app-installations/{installationId}/` which returns `{ organization: { slug: "..." } }`.

## Code References

- `apps/connections/src/providers/impl/sentry.ts:180-193` — best-effort org fetch during callback
- `apps/connections/src/providers/impl/sentry.ts:36-75` — `exchangeCode` via Sentry app-installations endpoint
- `api/console/src/router/org/connections.ts:1022-1035` — `organizationSlug` extraction and falsy guard
- `api/console/src/router/org/connections.ts:1038-1044` — Sentry projects API call
- `packages/gateway-types/src/account-info.ts:88-95` — `SentryAccountInfo` type
- `apps/console/src/app/(app)/(user)/new/_components/sentry-source-item.tsx:229-237` — error UI
- `apps/connections/src/providers/impl/sentry.ts:195-207` — `SentryAccountInfo` construction

## Historical Context

The commit `3024fbdec` (`feat(connections): fix Sentry organizationSlug extraction`) added the `GET /api/0/organizations/` fetch approach specifically because "Sentry's token exchange endpoint does not return organization data." The fix was correct in identifying that the exchange response doesn't include org info, but the fallback endpoint may also not work for app installation tokens.

## Open Questions

1. What does `GET /api/0/organizations/` actually return when called with a Sentry app installation Bearer token? (HTTP status, body)
2. Does `GET /api/0/sentry-app-installations/{installationId}/` return `organization.slug` for app tokens?
3. Is `installationId` (Sentry's UUID: `693284ff-...`) the correct identifier for the `/sentry-app-installations/` lookup?
