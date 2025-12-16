# GitHub ID Identity Resolution Implementation Plan

## Overview

Implement GitHub ID as the single source of truth for actor identity by:
1. Adding `clerkUserId` column to actor profiles for Clerk→GitHub mapping
2. Implementing lazy actor linking when authenticated users access workspaces
3. Removing Google OAuth to enforce GitHub-only authentication
4. Cleaning up unused email index

This is a pre-production implementation with no migration concerns for existing users.

## Current State Analysis

### Actor Profile Schema (`db/console/src/schema/tables/workspace-actor-profiles.ts`)
- **Canonical actor ID**: `actorId` field stores `github:{numericId}` format
- **No Clerk linkage**: No `clerkUserId` field exists
- **Display name**: Populated from `sourceActor.name` or parsed from actorId
- **Email**: Stored but never queried

### Actor Identity Schema (`db/console/src/schema/tables/workspace-actor-identities.ts`)
- **Email index**: `actor_identity_email_idx` exists but is never queried
- **Username search**: `sourceUsername` used for @mention search only

### Google OAuth Implementation (2 files - auth app only, chat is standalone)
- `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx:52-75`
- `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-up.tsx`

### Key Discoveries
- Clerk provides GitHub numeric ID via `provider_user_id` in external accounts
- Vercel events resolve to GitHub IDs via commit SHA linkage (existing behavior)
- Authenticated context available in tRPC via `ctx.auth.userId`
- Activity recording already tracks `actorUserId` for Clerk user actions

## Desired End State

After implementation:
1. Actor profiles have optional `clerkUserId` linking Clerk users to their GitHub identity
2. When a Clerk user (with GitHub OAuth) accesses a workspace, their profile is lazily linked
3. Only GitHub OAuth is available for sign-in/sign-up
4. Unused email index is removed

### Verification
- [x] `clerkUserId` column exists in `workspaceActorProfiles` (schema updated, migration generated)
- [x] Lazy linking function updates profiles on authenticated workspace access
- [x] Google OAuth buttons removed from all auth components
- [x] `actor_identity_email_idx` index dropped (in migration)

## What We're NOT Doing

- **Clerk webhooks**: No webhook infrastructure for user sync (lazy linking instead)
- **Lightfast usernames**: Deferred feature, not part of this implementation
- **Display name upgrades**: Not changing "octocat" → "John Doe" (keep GitHub username)
- **Backward reconciliation**: Not adding background job for username-based actor cleanup
- **Email-based matching**: Email is display-only, not for identity resolution

## Implementation Approach

Three independent phases that can be implemented in any order:
1. Schema migration (add `clerkUserId`, drop email index)
2. Lazy actor linking (runtime linking on authenticated access)
3. Google OAuth removal (UI changes only)

---

## Phase 1: Schema Migration

### Overview
Add `clerkUserId` column and index to actor profiles, remove unused email index from identities.

### Changes Required

#### 1. Add clerkUserId Column
**File**: `db/console/src/schema/tables/workspace-actor-profiles.ts`

Add after `avatarUrl` field (line 46):

```typescript
    avatarUrl: text("avatar_url"),

    // Clerk user linking (for authenticated user → actor resolution)
    clerkUserId: varchar("clerk_user_id", { length: 191 }),

    // Expertise (future enhancement)
```

Add index in the table definition (after `lastActiveIdx`, around line 97):

```typescript
    // Index for finding recently active profiles
    lastActiveIdx: index("actor_profile_last_active_idx").on(
      table.workspaceId,
      table.lastActiveAt,
    ),

    // Index for Clerk user → actor profile lookup
    clerkUserIdx: index("actor_profile_clerk_user_idx").on(
      table.workspaceId,
      table.clerkUserId,
    ),
```

#### 2. Remove Unused Email Index
**File**: `db/console/src/schema/tables/workspace-actor-identities.ts`

Remove the email index definition (lines 64-68):

```typescript
// REMOVE THIS:
    emailIdx: index("actor_identity_email_idx").on(
      table.workspaceId,
      table.sourceEmail,
    ),
```

Keep the `sourceEmail` column itself for display purposes.

#### 3. Generate Migration
```bash
cd db/console && pnpm db:generate
```

### Success Criteria

#### Automated Verification
- [x] Migration generates successfully: `cd db/console && pnpm db:generate`
- [ ] Migration applies cleanly: `cd db/console && pnpm db:migrate`
- [x] Type checking passes: `pnpm --filter @db/console typecheck`
- [x] Build succeeds: `pnpm --filter @db/console build`

#### Manual Verification
- [ ] New `clerk_user_id` column appears in database
- [ ] Index `actor_profile_clerk_user_idx` created
- [ ] Index `actor_identity_email_idx` dropped

---

## Phase 2: Lazy Actor Linking

### Overview
Implement lazy linking that connects Clerk users to their GitHub-based actor profiles when they access a workspace.

### Changes Required

#### 1. Create Actor Linking Utility
**File**: `api/console/src/lib/actor-linking.ts` (NEW FILE)

```typescript
import { and, eq, isNull } from "drizzle-orm";
import { db, workspaceActorProfiles } from "@db/console";
import type { User } from "@clerk/backend";

/**
 * Lazily links a Clerk user to their GitHub-based actor profile.
 * Called when an authenticated user accesses a workspace.
 *
 * This is a no-op if:
 * - User has no GitHub external account
 * - No actor profile exists for this GitHub ID in the workspace
 * - Profile is already linked to this Clerk user
 */
export async function ensureActorLinked(
  workspaceId: string,
  clerkUser: Pick<User, "id" | "externalAccounts">,
): Promise<{ linked: boolean; actorId: string | null }> {
  // Find GitHub external account
  const githubAccount = clerkUser.externalAccounts?.find(
    (acc) => acc.provider === "oauth_github",
  );

  if (!githubAccount?.providerUserId) {
    return { linked: false, actorId: null };
  }

  const githubNumericId = githubAccount.providerUserId;
  const canonicalActorId = `github:${githubNumericId}`;

  // Lazy link: Update profile if clerkUserId not set
  const result = await db
    .update(workspaceActorProfiles)
    .set({ clerkUserId: clerkUser.id })
    .where(
      and(
        eq(workspaceActorProfiles.workspaceId, workspaceId),
        eq(workspaceActorProfiles.actorId, canonicalActorId),
        isNull(workspaceActorProfiles.clerkUserId),
      ),
    )
    .returning({ actorId: workspaceActorProfiles.actorId });

  return {
    linked: result.length > 0,
    actorId: result[0]?.actorId ?? null,
  };
}

/**
 * Get actor profile for a Clerk user in a workspace.
 * Returns null if user has no linked actor profile.
 */
export async function getActorForClerkUser(
  workspaceId: string,
  clerkUserId: string,
): Promise<{ actorId: string; displayName: string } | null> {
  const profile = await db.query.workspaceActorProfiles.findFirst({
    where: and(
      eq(workspaceActorProfiles.workspaceId, workspaceId),
      eq(workspaceActorProfiles.clerkUserId, clerkUserId),
    ),
    columns: {
      actorId: true,
      displayName: true,
    },
  });

  return profile ?? null;
}
```

#### 2. Integrate with Workspace Access
**File**: `api/console/src/router/org/workspace.ts`

Add import at top of file:

```typescript
import { ensureActorLinked } from "~/lib/actor-linking";
```

Add lazy linking call in `getByName` procedure (around line 187) after workspace is resolved:

```typescript
// After resolving workspace, lazily link actor
if (ctx.auth.type === "clerk-active") {
  // Fire-and-forget: don't block the response
  void ensureActorLinked(workspace.id, {
    id: ctx.auth.userId,
    externalAccounts: ctx.auth.sessionClaims?.externalAccounts,
  }).catch(() => {
    // Silently ignore linking errors - this is best-effort
  });
}
```

**Note**: This requires `externalAccounts` to be available in session claims. If not available, we'll need to fetch the user from Clerk API.

#### 3. Alternative: Fetch User on Demand
If `externalAccounts` is not in session claims, update the linking call:

```typescript
import { clerkClient } from "@clerk/nextjs/server";

// In getByName procedure:
if (ctx.auth.type === "clerk-active") {
  void (async () => {
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(ctx.auth.userId);
      await ensureActorLinked(workspace.id, user);
    } catch {
      // Silently ignore linking errors
    }
  })();
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `pnpm --filter @api/console typecheck`
- [x] Build succeeds: `pnpm --filter @api/console build`
- [ ] Lint passes: `pnpm --filter @api/console lint` (pre-existing errors in other files)

#### Manual Verification
- [ ] Sign in with GitHub OAuth
- [ ] Access a workspace where you've contributed (have actor profile)
- [ ] Verify `clerk_user_id` is populated in database for your actor profile
- [ ] Second access to same workspace doesn't trigger update (idempotent)

---

## Phase 3: Remove Google OAuth

### Overview
Remove Google OAuth buttons from auth app components, keeping only GitHub OAuth.
Note: Chat app (`apps/chat`) is standalone and not modified.

### Changes Required

#### 1. Auth App Sign-In Component
**File**: `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-in.tsx`

Replace entire file content:

```typescript
"use client";

import * as React from "react";
import type { OAuthStrategy } from "@clerk/types";
import { useSignIn } from "@clerk/nextjs";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { Icons } from "@repo/ui/components/icons";
import { handleClerkError } from "~/app/lib/clerk/error-handler";
import { useLogger } from "@vendor/observability/client-log";
import { consoleUrl } from "~/lib/related-projects";

export function OAuthSignIn() {
  const { signIn, isLoaded } = useSignIn();
  const [loading, setLoading] = React.useState<OAuthStrategy | null>(null);
  const log = useLogger();

  const signInWith = async (strategy: OAuthStrategy) => {
    if (!signIn) return;

    try {
      setLoading(strategy);
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sign-in/sso-callback",
        redirectUrlComplete: consoleUrl,
      });
    } catch (err) {
      log.error("[OAuthSignIn] OAuth authentication failed", {
        strategy,
        error: err,
      });

      const errorResult = handleClerkError(err, {
        component: "OAuthSignIn",
        action: "oauth_redirect",
        strategy,
      });

      toast.error(errorResult.userMessage);
      setLoading(null);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full h-12"
      onClick={() => signInWith("oauth_github")}
      disabled={!isLoaded || loading !== null}
    >
      {loading === "oauth_github" ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.gitHub className="mr-2 h-4 w-4" />
      )}
      Continue with GitHub
    </Button>
  );
}
```

#### 2. Auth App Sign-Up Component
**File**: `apps/auth/src/app/(app)/(auth)/_components/oauth-sign-up.tsx`

Apply equivalent changes - remove Google button, keep only GitHub.

#### 3. Clerk Dashboard Configuration
**Action**: Disable Google OAuth provider in Clerk Dashboard
- Navigate to https://dashboard.clerk.com/
- Go to User & Authentication → Social Connections
- Disable Google OAuth provider

### Success Criteria

#### Automated Verification
- [x] Auth app builds: `pnpm --filter @lightfast/auth build`
- [x] Auth app type checks: `pnpm --filter @lightfast/auth typecheck`
- [ ] Auth app lint passes: `pnpm --filter @lightfast/auth lint`

#### Manual Verification
- [ ] Sign-in page shows only GitHub button
- [ ] Sign-up page shows only GitHub button
- [ ] GitHub OAuth flow works end-to-end
- [ ] No Google-related errors in browser console

---

## Testing Strategy

### Unit Tests
- Test `ensureActorLinked` with:
  - User with GitHub external account → links successfully
  - User without GitHub external account → no-op
  - User with existing link → no-op (idempotent)
  - Non-existent actor profile → no-op

### Integration Tests
- Full OAuth flow: GitHub sign-in → workspace access → actor linked
- Multiple workspace access: linking happens only once

### Manual Testing Steps
1. Create new Clerk account via GitHub OAuth
2. Push code to a connected repository (creates actor profile via webhook)
3. Sign in and access the workspace
4. Verify database shows `clerk_user_id` on actor profile
5. Verify no Google OAuth option appears on auth pages

## Performance Considerations

- Lazy linking is fire-and-forget, doesn't block workspace access
- Index on `(workspaceId, clerkUserId)` ensures fast lookups
- No additional API calls during normal operation (Clerk user data from session)

## Migration Notes

- No data migration required (pre-production)
- Schema migration is additive (new column, new index)
- Dropping email index has no impact (never used in queries)

## References

- Research document: `thoughts/shared/research/2025-12-16-github-id-source-of-truth-audit.md`
- Actor bugfix plan: `thoughts/shared/plans/2025-12-15-actor-implementation-bugfix-oauth.md`
- ClerkOrgId propagation: `thoughts/shared/research/2025-12-16-clerkorgid-propagation-architecture.md`
