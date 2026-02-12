---
date: 2026-02-06T12:00:00+08:00
researcher: claude
git_commit: 5eaa1050042cde2cbd11f812af558fc900123918
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Organization creation error propagation from Clerk API to UI"
tags: [research, codebase, organization, clerk, error-handling, trpc, team-creation]
status: complete
last_updated: 2026-02-06
last_updated_by: claude
---

# Research: Organization Creation Error Propagation from Clerk API to UI

**Date**: 2026-02-06
**Researcher**: claude
**Git Commit**: 5eaa1050042cde2cbd11f812af558fc900123918
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question
When creating a new organization at `/account/teams/new`, a Clerk API error (`form_identifier_exists` / "That slug is taken") does not propagate correctly to the UI - it silently fails in the background. How does the error flow currently work and where does it break?

## Summary

The error propagation breaks because of a **mismatch between the Clerk error code the server checks for and the actual error code Clerk returns**. The server-side catch block at `api/console/src/router/user/organization.ts:174` checks for `"duplicate_record"`, but Clerk actually returns `"form_identifier_exists"`. Since the condition doesn't match, the error falls through to the generic `INTERNAL_SERVER_ERROR` throw at line 184. The client-side `onError` handler at `apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx:70-83` does display the error via a toast - but the message it receives is the generic "Failed to create organization" instead of the user-friendly duplicate slug message.

## Detailed Findings

### 1. Server-Side Error Handler - The Mismatch

**File**: `api/console/src/router/user/organization.ts:155-189`

The catch block handles errors from `clerk.organizations.createOrganization()`:

```typescript
// Lines 164-181
if (error && typeof error === "object" && "errors" in error) {
  const clerkError = error as {
    errors?: Array<{ code: string; message: string }>;
  };

  if (
    clerkError.errors?.[0]?.code === "duplicate_record" ||      // <-- checks this
    clerkError.errors?.[0]?.message?.includes("already exists")  // <-- and this
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `An organization with the name "${input.slug}" already exists`,
    });
  }
}
```

**What Clerk actually returns** (from the error log):
```
ClerkAPIError {
  code: 'form_identifier_exists',           // <-- actual code
  message: 'That slug is taken. Please try another.',  // <-- actual message
}
```

The condition at line 174 checks for `"duplicate_record"` but gets `"form_identifier_exists"`. The message check at line 175 looks for `"already exists"` but the actual message is `"That slug is taken. Please try another."`. Neither condition matches, so it falls through to:

```typescript
// Lines 184-188
throw new TRPCError({
  code: "INTERNAL_SERVER_ERROR",
  message: "Failed to create organization",
  cause: error,
});
```

### 2. Client-Side Error Handler - Works but Receives Generic Message

**File**: `apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx:70-83`

```typescript
onError: (err, variables, context) => {
  // Rollback on error
  if (context?.previousOrgs) {
    queryClient.setQueryData(
      trpc.organization.listUserOrganizations.queryOptions().queryKey,
      context.previousOrgs,
    );
  }

  toast({
    title: "Failed to create team",
    description: err.message || "Please try again.",
    variant: "destructive",
  });
},
```

This handler is correctly wired and will display a toast. However:
- `err.message` will be `"Failed to create organization"` (the generic INTERNAL_SERVER_ERROR message)
- The optimistic update rollback at lines 72-77 works correctly
- The toast does display with `variant: "destructive"`

### 3. The `mutate` vs `mutateAsync` Pattern

**File**: `apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx:119-121`

```typescript
createOrgMutation.mutate({
  slug: teamName,
});
```

The button uses `mutate()` (fire-and-forget) not `mutateAsync()` (returns promise). This means:
- Errors are handled via the `onError` callback in mutation options (line 70)
- There's no try/catch around the call
- The mutation error **does** get handled by the `onError` callback
- The toast **does** show, but with the generic "Failed to create organization" message

### 4. Full Error Flow

```
User clicks "Continue"
  → handleCreateTeam() validates form (create-team-button.tsx:106-108)
  → createOrgMutation.mutate({ slug: "lightfast" }) (line 119)
  → Optimistic update adds temp org to cache (lines 39-68)
  → tRPC sends POST to /api/trpc/user (via splitLink)
  → organization.create mutation runs (organization.ts:128)
  → clerk.organizations.createOrganization() fails (line 140)
  → Clerk throws: { code: "form_identifier_exists", message: "That slug is taken..." }
  → Catch block checks for "duplicate_record" (line 174) → NO MATCH
  → Catch block checks for "already exists" in message (line 175) → NO MATCH
  → Falls through to generic INTERNAL_SERVER_ERROR (line 184)
  → tRPC sends error with message "Failed to create organization"
  → Client receives error
  → onError callback fires (line 70)
  → Optimistic update rolled back (lines 72-77)
  → Toast shows: title="Failed to create team", description="Failed to create organization"
```

### 5. Existing Clerk Error Handling Utilities (Not Used Here)

**File**: `apps/console/src/app/lib/clerk/error-handling.ts:14-36`

A utility function `getErrorMessage()` exists that uses `isClerkAPIResponseError` from `@clerk/shared` to extract user-friendly messages from Clerk errors. This utility is not used in the organization creation flow.

**File**: `apps/www/src/lib/clerk-error-handler.ts:162-353`

The www app has a more comprehensive `handleClerkError()` utility that:
- Explicitly handles `form_identifier_exists` error code
- Maps it to a user-friendly message
- Integrates with Sentry for unexpected errors

Neither of these utilities is used in the organization router.

### 6. Comparison with `updateName` Handler

**File**: `api/console/src/router/user/organization.ts:248-263`

The `updateName` mutation has the exact same error checking pattern:
```typescript
if (
  clerkError.errors?.[0]?.code === "duplicate_record" ||
  clerkError.errors?.[0]?.message?.includes("already exists")
)
```
This would have the same issue if Clerk returns `form_identifier_exists` during an update.

### 7. Toast System Note

The create team button uses shadcn/ui's `useToast` hook (imported from `@repo/ui/hooks/use-toast`) rather than Sonner. Both toast systems are used across the console app. Other mutation handlers in the codebase (e.g., `jobs-table.tsx`, `api-key-list.tsx`) use Sonner directly.

## Code References
- `api/console/src/router/user/organization.ts:128-190` - Organization create mutation with error handling
- `api/console/src/router/user/organization.ts:164-181` - Clerk error code check (checks "duplicate_record", not "form_identifier_exists")
- `api/console/src/router/user/organization.ts:184-188` - Generic fallthrough error
- `apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx:37-104` - Mutation with optimistic updates and onError toast
- `apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx:70-83` - onError callback that displays toast
- `apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx:119-121` - mutate() call (fire-and-forget)
- `apps/console/src/app/lib/clerk/error-handling.ts:14-36` - Existing Clerk error utility (not used in this flow)
- `apps/www/src/lib/clerk-error-handler.ts:162-353` - WWW app Clerk error handler (handles form_identifier_exists)
- `api/console/src/trpc.ts:242-251` - tRPC error formatter
- `packages/console-trpc/src/react.tsx:59-115` - Client tRPC setup with splitLink routing

## Architecture Documentation

### Error Propagation Chain
```
Clerk API Error → organization.ts catch block → TRPCError → HTTP Response →
  tRPC Client → React Query mutation state → onError callback → Toast UI
```

### Two Toast Systems in Console
1. **Sonner** (`import { toast } from "sonner"`) - Used in component-level mutations
2. **Shadcn/UI** (`useToast` from `@repo/ui/hooks/use-toast`) - Used in form submissions

### Clerk Error Format
```typescript
{
  clerkError: true,
  code: 'api_response_error',
  status: 422,
  errors: [
    ClerkAPIError {
      code: 'form_identifier_exists',  // The actual error code
      message: 'That slug is taken. Please try another.',
      longMessage: 'That slug is taken. Please try another.',
      meta: { /* ... */ }
    }
  ]
}
```

## Open Questions
- Should the console's `getErrorMessage()` utility at `apps/console/src/app/lib/clerk/error-handling.ts` be used in the organization router?
- Should the server-side error check include `form_identifier_exists` alongside `duplicate_record`?
- Is the same mismatch present in other Clerk API calls throughout the codebase?
