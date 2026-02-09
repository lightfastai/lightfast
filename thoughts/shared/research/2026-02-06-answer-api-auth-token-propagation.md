---
date: 2026-02-06T03:46:29Z
researcher: claude
git_commit: 2d64657db572cd01b7a2fd685d5d6e20144d2952
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Answer API 401 Error: Auth Token Propagation from Answer Route to Internal Search API"
tags: [research, codebase, authentication, answer-api, search-api, dual-auth, clerk]
status: complete
last_updated: 2026-02-06
last_updated_by: claude
---

# Research: Answer API 401 Error - Auth Token Propagation

**Date**: 2026-02-06T03:46:29Z
**Researcher**: claude
**Git Commit**: 2d64657db572cd01b7a2fd685d5d6e20144d2952
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

The answer API at `/v1/answer/[...v]/route.ts` gets a 401 error when its agent tools call `/v1/search` internally. The error is:

```
Search API error: 401 - {"error":"UNAUTHORIZED","message":"Authentication required. Provide 'Authorization: Bearer <api-key>' header or sign in.","requestId":"..."}
```

Investigate how auth tokens flow from the answer route through tool execution to internal API calls, and document the three authentication paths in `withDualAuth`.

## Summary

The 401 error occurs because when the answer API's tools make internal HTTP calls to `/v1/search`, the Clerk JWT token from `auth().getToken()` is being passed as a Bearer token. However, the receiving `/v1/search` endpoint processes this through `withDualAuth`, which takes **Path C (Clerk Session)** - not **Path B (Trusted Bearer)** as intended.

The root cause is that `auth()` on the receiving end of the internal fetch does NOT have the same Clerk session context - it's a server-to-server HTTP call, not a browser request with session cookies. The Clerk JWT bearer token in the Authorization header triggers Path B, but **only if `auth()` doesn't resolve first**.

### The Three Authentication Paths in `withDualAuth`

**Path A: API Key** (`with-dual-auth.ts:61-77`)
- Triggered by: `Authorization: Bearer sk-lf-...`
- Validates: API key hash in database
- Used by: External API consumers

**Path B: Trusted Bearer Token** (`with-dual-auth.ts:78-121`)
- Triggered by: `Authorization: Bearer <non-sk-lf-token>` (e.g., Clerk JWT)
- Requires: Both `X-Workspace-ID` and `X-User-ID` headers
- Validates: Only workspace existence in database
- Intended for: Internal service-to-service calls (answer tools → search API)

**Path C: Clerk Session** (`with-dual-auth.ts:124-176`)
- Triggered by: No Authorization header, relies on Clerk session cookies
- Validates: Full org membership via `getCachedUserOrgMemberships`
- Used by: Console UI (browser requests with cookies)

### The Problem

When the answer tool calls `/v1/search`:

```
Tool sends: Authorization: Bearer <clerk-jwt>, X-Workspace-ID, X-User-ID
                                ↓
withDualAuth checks: authHeader?.startsWith("Bearer ")  → YES
                                ↓
token.startsWith("sk-lf-")  → NO (it's a Clerk JWT)
                                ↓
Enters Path B (trusted bearer token)
                                ↓
Checks X-Workspace-ID and X-User-ID → both present
                                ↓
Validates workspace exists → should succeed
```

**If Path B executes correctly**, the request should succeed. The 401 error with `"Authentication required"` message comes from **Path C, line 133** - which means the code is somehow reaching Path C instead of Path B.

### Root Cause Investigation

The 401 error message `"Authentication required. Provide 'Authorization: Bearer <api-key>' header or sign in."` is returned at `with-dual-auth.ts:133-134` in Path C. This path is only reached when **no Authorization header is present** (lines 57-122 are skipped).

This means one of:
1. The `authToken` from `auth().getToken()` is returning `null/undefined`, causing the conditional spread `...(authToken ? { Authorization: ... } : {})` to not include the header
2. The Clerk `auth()` call at `route.ts:39` is not returning a valid token in this execution context

Evidence: The route logs `console.log("authToken", authToken)` at line 43 - checking this log would confirm if the token is undefined.

## Detailed Findings

### 1. Answer Route Authentication Flow

**File**: `apps/console/src/app/(api)/v1/answer/[...v]/route.ts`

The answer route authenticates the incoming request, then obtains a Clerk JWT for internal calls:

```typescript
// Line 30: Authenticate incoming request
const authResult = await withDualAuth(request, requestId);

// Lines 38-41: Get Clerk JWT for tool use
const clerkAuth = await auth();
const token = await clerkAuth.getToken();
const authToken = token ?? undefined;

// Lines 72-76: Pass to agent runtime context
createRuntimeContext: () => ({
  workspaceId: authData.workspaceId,
  userId: authData.userId,
  authToken,  // <-- This may be undefined
})
```

### 2. Tool Header Construction

**File**: `apps/console/src/ai/tools/search.ts:50-56`

All five answer tools use the same pattern:

```typescript
const res = await fetch(`${createBaseUrl()}/v1/search`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Workspace-ID": workspaceId,
    "X-User-ID": userId,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  },
  // ...
});
```

If `authToken` is undefined, no Authorization header is sent, and `withDualAuth` falls through to Path C which calls `await auth()` - but this is a server-to-server fetch with no Clerk session cookies, so `auth()` returns no userId → 401.

### 3. UI Client Authentication

**File**: `apps/console/src/ai/hooks/use-answer-transport.ts`

The UI client sends:
- `Content-Type: application/json`
- `X-Workspace-ID: <workspaceId>`
- Clerk session cookies (implicit via same-origin fetch)

No Authorization header is sent. Authentication relies on Clerk cookies → Path C.

### 4. Base URL Resolution

**File**: `apps/console/src/lib/base-url.ts:35-53`

In development: `http://localhost:4107`
In production: `https://lightfast.ai`

Internal tool calls go to the same server, making them same-origin in production but still server-to-server (no browser cookies).

### 5. Search Route Authentication

**File**: `apps/console/src/app/(api)/v1/search/route.ts`

The search route calls `withDualAuth(request, requestId)` at line 50. The same dual auth logic applies - it needs either an API key, a bearer token with workspace/user headers, or a valid Clerk session.

## Code References

- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts:38-41` - Clerk token extraction
- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts:72-76` - Runtime context creation
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:57-122` - Bearer token auth paths (A & B)
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:124-138` - Session auth path (C) with 401 error
- `apps/console/src/ai/tools/search.ts:50-56` - Internal search API call with conditional auth header
- `apps/console/src/ai/tools/contents.ts:22-28` - Internal contents API call
- `apps/console/src/ai/tools/find-similar.ts:33-39` - Internal find-similar API call
- `apps/console/src/ai/tools/graph.ts:40-46` - Internal graph API call
- `apps/console/src/ai/tools/related.ts:34-40` - Internal related API call
- `apps/console/src/ai/hooks/use-answer-transport.ts:13-30` - UI client transport config
- `apps/console/src/lib/base-url.ts:35-53` - Base URL resolution

## Architecture Documentation

### Authentication Flow Diagram

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Browser (UI)  │────▶│  /v1/answer (POST)   │     │  /v1/search     │
│                 │     │                      │     │                 │
│  Sends:         │     │  1. withDualAuth()   │     │  withDualAuth() │
│  - Cookies      │     │     → Path C (session)│     │                 │
│  - X-Workspace  │     │  2. auth().getToken() │     │  Receives from  │
│                 │     │     → Clerk JWT?      │     │  answer tools:  │
└─────────────────┘     │  3. Creates agent     │     │  - Bearer <jwt> │
                        │     with authToken    │     │  - X-Workspace  │
                        │                      │     │  - X-User-ID    │
                        │  4. Agent executes    │────▶│                 │
                        │     tools internally  │     │  → Path B       │
                        └──────────────────────┘     │    (trusted)    │
                                                     └─────────────────┘
```

### Problem Scenario

```
If auth().getToken() returns null:

Browser → /v1/answer (Path C ✓) → auth().getToken() = null → authToken = undefined
                                                                    ↓
Tool fetch → /v1/search (NO Auth header) → withDualAuth → Path C → auth() = no cookies → 401
```

### Expected Scenario

```
If auth().getToken() returns valid JWT:

Browser → /v1/answer (Path C ✓) → auth().getToken() = "eyJ..." → authToken = "eyJ..."
                                                                        ↓
Tool fetch → /v1/search (Bearer eyJ...) → withDualAuth → Path B → validates workspace → 200 ✓
```

## Analysis: Why auth().getToken() May Return Null

The `auth()` function from `@clerk/nextjs/server` works differently depending on context:

1. **In a route handler processing a browser request**: `auth()` has access to the request's Clerk session cookies → can return a valid token
2. **In a route handler where the request came from another server-side fetch**: The cookies context depends on Next.js request propagation

At `route.ts:39`, `auth()` is called in the answer route handler which IS processing a browser request (it has cookies). So `getToken()` should return a valid JWT. However, if there's any issue with the Clerk session or token generation, it could return null.

The `console.log("authToken", authToken)` at line 43 would confirm this. Check server logs for this output.

## Open Questions

1. What does the `console.log("authToken", authToken)` at `route.ts:43` output? If it's `undefined`, the issue is at token extraction.
2. Is there a timing issue where the Clerk session token expires between the initial auth and the tool execution?
3. Could `createBaseUrl()` be resolving to a different origin in some edge case, affecting cookie propagation?
4. The `auth().getToken()` call - does Clerk's `getToken()` work reliably in Next.js App Router route handlers?
