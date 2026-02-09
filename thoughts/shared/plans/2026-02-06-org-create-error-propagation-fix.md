# Fix Organization Creation Error Propagation

## Overview

Fix the Clerk error code mismatch in the organization creation and update flows so that duplicate slug errors are properly surfaced to the user instead of showing a generic "Failed to create organization" message.

## Current State Analysis

The server-side catch block at `api/console/src/router/user/organization.ts:173-175` checks for Clerk error code `"duplicate_record"` and message containing `"already exists"`. However, Clerk actually returns:
- **Code**: `form_identifier_exists`
- **Message**: `"That slug is taken. Please try another."`

Neither condition matches, so the error falls through to a generic `INTERNAL_SERVER_ERROR` at line 184. The client-side `onError` handler at `apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx:70-83` works correctly — it displays a toast with `err.message` — but receives the unhelpful generic message.

### Key Discoveries:
- The `updateName` mutation at `organization.ts:254-255` has the exact same bug
- `@clerk/shared`'s `isClerkAPIResponseError` is not available in the API package (it depends on `@clerk/nextjs`, not `@clerk/shared` directly)
- The fix should stay within the existing manual error inspection pattern

## Desired End State

When a user tries to create a team with a slug that already exists:
1. The server catches the `form_identifier_exists` Clerk error
2. Throws a `TRPCError` with code `CONFLICT` and a user-friendly message
3. The client displays a destructive toast: **"Failed to create team"** / `"An organization with the name "xyz" already exists"`

Same behavior for the `updateName` mutation.

## What We're NOT Doing

- Not refactoring to use `isClerkAPIResponseError` from `@clerk/shared` (not available in the API package)
- Not changing the client-side error handler (it already works correctly)
- Not changing the toast system (shadcn/ui `useToast` is fine for this flow)
- Not adding new dependencies

## Implementation Approach

Minimal fix: add the correct Clerk error code (`form_identifier_exists`) and message substring (`"slug is taken"`) to both the `create` and `updateName` error handlers.

## Phase 1: Fix Error Code Matching

### Overview
Update the Clerk error code checks in both the `create` and `updateName` mutations to match the actual error codes Clerk returns.

### Changes Required:

#### 1. Fix `create` mutation error handler
**File**: `api/console/src/router/user/organization.ts`
**Lines**: 173-175

Current:
```typescript
if (
  clerkError.errors?.[0]?.code === "duplicate_record" ||
  clerkError.errors?.[0]?.message?.includes("already exists")
)
```

Change to:
```typescript
if (
  clerkError.errors?.[0]?.code === "duplicate_record" ||
  clerkError.errors?.[0]?.code === "form_identifier_exists" ||
  clerkError.errors?.[0]?.message?.includes("already exists") ||
  clerkError.errors?.[0]?.message?.includes("slug is taken")
)
```

#### 2. Fix `updateName` mutation error handler
**File**: `api/console/src/router/user/organization.ts`
**Lines**: 254-255

Current:
```typescript
if (
  clerkError.errors?.[0]?.code === "duplicate_record" ||
  clerkError.errors?.[0]?.message?.includes("already exists")
)
```

Change to:
```typescript
if (
  clerkError.errors?.[0]?.code === "duplicate_record" ||
  clerkError.errors?.[0]?.code === "form_identifier_exists" ||
  clerkError.errors?.[0]?.message?.includes("already exists") ||
  clerkError.errors?.[0]?.message?.includes("slug is taken")
)
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter @api/console build`
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Navigate to `/account/teams/new`
- [ ] Enter a team name that already exists (e.g., "lightfast")
- [ ] Click "Continue"
- [ ] Toast shows: title="Failed to create team", description=`An organization with the name "lightfast" already exists`
- [ ] The optimistic update is properly rolled back (the temp org disappears from the list)

---

## Testing Strategy

### Manual Testing Steps:
1. Start dev server: `pnpm dev:app`
2. Navigate to `/account/teams/new`
3. Enter an existing team slug
4. Click "Continue"
5. Verify the destructive toast shows the correct duplicate slug message
6. Verify the organization list doesn't retain the optimistic entry
7. Repeat with a unique slug to verify the happy path still works

## References

- Research: `thoughts/shared/research/2026-02-06-org-create-error-propagation.md`
- Server error handler: `api/console/src/router/user/organization.ts:164-188`
- Client error handler: `apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx:70-83`
