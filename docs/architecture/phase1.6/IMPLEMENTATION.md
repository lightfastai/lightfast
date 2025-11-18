# Phase 1.6 Implementation Plan

**Status:** Planning
**Date:** 2025-11-18
**Goal:** Decouple GitHub from organization model - make Lightfast organizations first-class citizens with GitHub as an optional integration

---

## What is Phase 1.6?

Phase 1.6 transforms Lightfast from a **GitHub-dependent platform** to a **platform-agnostic workspace** where GitHub is one integration among many future integrations.

**Current Architecture (Phase 1-1.5):**
- Organizations ARE GitHub organizations (1:1 mapping required)
- Users "claim" GitHub installations to create Lightfast orgs
- Workspace ID computed as `ws_${githubOrgSlug}`
- Cannot use Lightfast without GitHub

**New Architecture (Phase 1.6):**
- Organizations are native Lightfast entities (independent of GitHub)
- Users create/join Lightfast orgs via standard invite flow
- GitHub is an **optional integration** connected post-org-creation
- Workspace ID is stable, independent of GitHub
- Opens path for Linear, Notion, Sentry, etc. integrations

**Key Principle:** Build Lightfast-first, integrate everything else.

---

## Strategic Context

This pivot addresses 13 identified onboarding bugs (Issue #289) by fixing the root cause: **tight coupling between GitHub and organizations**.

**Benefits of Decoupling:**
- **Faster to market:** 12 weeks vs 16 weeks to fix bugs
- **Broader market:** Not limited to GitHub users
- **Better UX:** Standard org creation flow (like Vercel, Clerk)
- **Future-proof:** Easy to add Bitbucket, GitLab, etc.
- **Eliminates bugs:** No more claiming race conditions, installation ID conflicts, slug duplication

**See:** `STRATEGIC_ARCHITECTURE_ANALYSIS.md` for full analysis.

---

## Database Changes

### 1. Organizations Table Migration

**Current Schema:**
```typescript
// db/console/src/schema/tables/organizations.ts
export const organizations = mysqlTable("lightfast_organizations", {
  id: varchar("id", { length: 191 }).notNull().primaryKey(), // Clerk org ID

  // GitHub fields (REQUIRED - this is the problem)
  githubOrgId: int("github_org_id").notNull().unique(),
  githubInstallationId: int("github_installation_id").notNull(),
  githubOrgSlug: varchar("github_org_slug", { length: 255 }).notNull(),

  // Clerk integration
  clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull().unique(),
  clerkOrgSlug: varchar("clerk_org_slug", { length: 255 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
```

**New Schema (Phase 1.6):**
```typescript
// db/console/src/schema/tables/organizations.ts
export const organizations = mysqlTable("lightfast_organizations", {
  id: varchar("id", { length: 191 }).notNull().primaryKey(), // Clerk org ID

  // Native Lightfast organization fields
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  workspaceId: varchar("workspace_id", { length: 191 }).notNull().unique(), // ws_${nanoid}

  // Clerk integration (still required for auth)
  clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull().unique(),
  clerkOrgSlug: varchar("clerk_org_slug", { length: 255 }).notNull(),

  // GitHub integration (NOW OPTIONAL)
  githubOrgId: int("github_org_id").unique(), // nullable
  githubInstallationId: int("github_installation_id"), // nullable
  githubOrgSlug: varchar("github_org_slug", { length: 255 }), // nullable
  githubConnectedAt: timestamp("github_connected_at"), // nullable

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
```

**Key Changes:**
1. ✅ **Add native fields:** `name`, `slug`, `workspaceId` (generated, stable)
2. ✅ **Make GitHub optional:** All GitHub fields nullable
3. ✅ **Add tracking:** `githubConnectedAt` to track when integration added
4. ✅ **Workspace stability:** `workspaceId` no longer derived from GitHub slug

**Migration Strategy:**
```sql
-- Phase 1.6 Migration: Decouple GitHub from organizations
ALTER TABLE lightfast_organizations
  -- Add native Lightfast fields
  ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN slug VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN workspace_id VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN github_connected_at TIMESTAMP NULL,

  -- Make GitHub fields nullable
  MODIFY COLUMN github_org_id INT NULL,
  MODIFY COLUMN github_installation_id INT NULL,
  MODIFY COLUMN github_org_slug VARCHAR(255) NULL,

  -- Add unique constraint on workspace_id
  ADD UNIQUE INDEX idx_workspace_id (workspace_id),
  ADD UNIQUE INDEX idx_slug (slug);

-- Backfill existing organizations (GitHub-claimed orgs)
UPDATE lightfast_organizations
SET
  name = clerk_org_slug, -- Use Clerk name as default
  slug = clerk_org_slug,
  workspace_id = CONCAT('ws_', github_org_slug), -- Preserve existing workspace IDs
  github_connected_at = created_at -- Mark as connected from creation
WHERE github_org_id IS NOT NULL;

-- Remove NOT NULL constraint from GitHub fields (already done in ALTER above)
```

### 2. Connected Repositories Update

**Current Schema:**
```typescript
// db/console/src/schema/tables/connected-repositories.ts
export const connectedRepositories = mysqlTable("lightfast_connected_repositories", {
  id: varchar("id", { length: 191 }).notNull().primaryKey(),
  organizationId: varchar("organization_id", { length: 191 }).notNull(),

  githubRepoId: varchar("github_repo_id", { length: 255 }).notNull().unique(),
  githubInstallationId: varchar("github_installation_id", { length: 255 }).notNull(), // DUPLICATE!

  repoFullName: varchar("repo_full_name", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),

  // Computed at runtime in Phase 1
  workspaceId: varchar("workspace_id", { length: 191 }).notNull(),
});
```

**Changes Needed:**
1. Remove `githubInstallationId` (duplicates organization.githubInstallationId)
2. Remove `workspaceId` field (query from organization instead)
3. Add foreign key constraint to organizations

**New Schema:**
```typescript
// db/console/src/schema/tables/connected-repositories.ts
export const connectedRepositories = mysqlTable("lightfast_connected_repositories", {
  id: varchar("id", { length: 191 }).notNull().primaryKey(),
  organizationId: varchar("organization_id", { length: 191 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }), // FK added

  githubRepoId: varchar("github_repo_id", { length: 255 }).notNull().unique(),
  repoFullName: varchar("repo_full_name", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// Helper to get workspace ID
export const getRepoWorkspaceId = async (repoId: string) => {
  const repo = await db.query.connectedRepositories.findFirst({
    where: eq(connectedRepositories.id, repoId),
    with: { organization: true },
  });
  return repo?.organization.workspaceId;
};
```

**Migration:**
```sql
-- Phase 1.6: Clean up connected_repositories
ALTER TABLE lightfast_connected_repositories
  DROP COLUMN github_installation_id, -- Duplicate data
  DROP COLUMN workspace_id, -- Computed from org
  ADD CONSTRAINT fk_org FOREIGN KEY (organization_id)
    REFERENCES lightfast_organizations(id) ON DELETE CASCADE;
```

### 3. Stores Table (PostgreSQL) - No Changes Needed

**Current Schema (Phase 1.5):**
```typescript
// db/console/src/schema/tables/stores.ts (PostgreSQL)
export const stores = pgTable("lightfast_stores", {
  id: varchar("id", { length: 191 }).notNull().primaryKey(),
  workspaceId: varchar("workspace_id", { length: 191 }).notNull(), // ws_${...}
  name: varchar("name", { length: 191 }).notNull(),
  indexName: varchar("index_name", { length: 191 }).notNull(),
  // ...
});
```

**No migration needed** - already uses `workspaceId` which will now reference stable IDs from organizations table.

---

## API Changes

### 1. New Endpoint: Create Organization

**File:** `apps/console/src/app/api/organizations/create/route.ts` (NEW)

```typescript
import { auth, clerkClient } from "@vendor/clerk/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { organizationsService } from "@/lib/services/organizations";

const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = createOrgSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error },
        { status: 400 }
      );
    }

    const { name, slug } = result.data;

    // 1. Check if slug already taken
    const existing = await organizationsService.findBySlug(slug);
    if (existing) {
      return NextResponse.json(
        { error: "Organization slug already taken" },
        { status: 409 }
      );
    }

    // 2. Create Clerk organization
    const clerk = await clerkClient();
    const clerkOrg = await clerk.organizations.createOrganization({
      name,
      slug,
      createdBy: userId,
    });

    // 3. Generate stable workspace ID
    const workspaceId = `ws_${nanoid(12)}`;

    // 4. Create Lightfast organization
    const org = await organizationsService.create({
      id: clerkOrg.id,
      name,
      slug,
      workspaceId,
      clerkOrgId: clerkOrg.id,
      clerkOrgSlug: clerkOrg.slug,
      // GitHub fields are null
    });

    // 5. Set active org
    // Note: This happens client-side via Clerk's setActive()

    return NextResponse.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      workspaceId: org.workspaceId,
      clerkOrgId: org.clerkOrgId,
    });
  } catch (error) {
    console.error("Failed to create organization:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}
```

### 2. New Endpoint: Connect GitHub Integration

**File:** `apps/console/src/app/api/integrations/github/connect/route.ts` (NEW)

```typescript
import { auth, clerkClient } from "@vendor/clerk/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { organizationsService } from "@/lib/services/organizations";
import { getUserInstallations } from "@/lib/github/client";

const connectGitHubSchema = z.object({
  installationId: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userToken = request.cookies.get("github_user_token")?.value;
    if (!userToken) {
      return NextResponse.json(
        { error: "GitHub token not found" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const result = connectGitHubSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error },
        { status: 400 }
      );
    }

    const { installationId } = result.data;

    // 1. Verify user has access to this installation
    const installations = await getUserInstallations(userToken);
    const installation = installations.find((i) => i.id === installationId);

    if (!installation) {
      return NextResponse.json(
        { error: "Installation not found or no access" },
        { status: 404 }
      );
    }

    // 2. Get current organization
    const org = await organizationsService.findByClerkOrgId(orgId);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // 3. Check if GitHub already connected
    if (org.githubInstallationId) {
      return NextResponse.json(
        { error: "GitHub already connected to this organization" },
        { status: 409 }
      );
    }

    // 4. Check if installation already used by another org
    const existingOrg = await organizationsService.findByGithubInstallationId(
      installationId
    );
    if (existingOrg) {
      return NextResponse.json(
        { error: "GitHub installation already connected to another organization" },
        { status: 409 }
      );
    }

    // 5. Connect GitHub to organization
    const account = installation.account;
    await organizationsService.connectGitHub({
      organizationId: org.id,
      githubOrgId: account.id,
      githubInstallationId: installationId,
      githubOrgSlug: account.login.toLowerCase(),
    });

    // 6. Sync repositories
    // TODO: Trigger repository sync workflow

    return NextResponse.json({
      success: true,
      githubOrg: account.login,
    });
  } catch (error) {
    console.error("Failed to connect GitHub:", error);
    return NextResponse.json(
      { error: "Failed to connect GitHub" },
      { status: 500 }
    );
  }
}
```

### 3. Deprecated Endpoint: Claim Organization

**File:** `apps/console/src/app/(github)/api/organizations/claim/route.ts` (DELETE)

This entire endpoint is removed. Its functionality is replaced by:
- `POST /api/organizations/create` - Create native Lightfast org
- `POST /api/integrations/github/connect` - Connect GitHub integration

### 4. Updated Endpoint: GitHub Webhooks

**File:** `apps/console/src/app/(github)/api/github/webhooks/route.ts`

**Current workspace resolution (BROKEN after Phase 1.6):**
```typescript
// OLD: Resolves workspace from GitHub org slug
const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
const workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);
const workspaceId = workspace.workspaceId; // ws_${githubOrgSlug}
```

**New workspace resolution:**
```typescript
// NEW: Resolve workspace from GitHub installation ID
async function handlePushEvent(payload: PushEvent, deliveryId: string) {
  const installationId = payload.installation.id;

  // 1. Find organization by installation ID
  const org = await organizationsService.findByGithubInstallationId(installationId);

  if (!org) {
    console.error(`No organization found for installation ${installationId}`);
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const workspaceId = org.workspaceId; // Stable workspace ID

  // 2. Find connected repository
  const repo = await connectedRepositoriesService.findByGithubRepoId(
    payload.repository.id.toString()
  );

  if (!repo || !repo.isActive) {
    console.log(`Repository ${payload.repository.full_name} not connected or inactive`);
    return NextResponse.json({ skipped: true });
  }

  // 3. Trigger workflow (same as before)
  await inngest.send({
    name: 'apps-console/docs.push',
    data: {
      workspaceId, // Now stable, not derived from GitHub slug
      repoFullName: payload.repository.full_name,
      githubRepoId: payload.repository.id,
      githubInstallationId: installationId,
      // ...
    }
  });
}
```

---

## Service Layer Changes

### 1. OrganizationsService

**File:** `api/console/src/lib/services/organizations.ts`

**New Methods:**
```typescript
export class OrganizationsService {
  // NEW: Create native Lightfast organization
  async create(data: {
    id: string;
    name: string;
    slug: string;
    workspaceId: string;
    clerkOrgId: string;
    clerkOrgSlug: string;
  }) {
    return await db.insert(organizations).values({
      id: data.id,
      name: data.name,
      slug: data.slug,
      workspaceId: data.workspaceId,
      clerkOrgId: data.clerkOrgId,
      clerkOrgSlug: data.clerkOrgSlug,
      // GitHub fields are null
    });
  }

  // NEW: Connect GitHub integration to existing org
  async connectGitHub(data: {
    organizationId: string;
    githubOrgId: number;
    githubInstallationId: number;
    githubOrgSlug: string;
  }) {
    return await db
      .update(organizations)
      .set({
        githubOrgId: data.githubOrgId,
        githubInstallationId: data.githubInstallationId,
        githubOrgSlug: data.githubOrgSlug,
        githubConnectedAt: new Date(),
      })
      .where(eq(organizations.id, data.organizationId));
  }

  // NEW: Disconnect GitHub integration
  async disconnectGitHub(organizationId: string) {
    return await db
      .update(organizations)
      .set({
        githubOrgId: null,
        githubInstallationId: null,
        githubOrgSlug: null,
        githubConnectedAt: null,
      })
      .where(eq(organizations.id, organizationId));
  }

  // NEW: Find by slug
  async findBySlug(slug: string) {
    return await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });
  }

  // UPDATED: Find by Clerk org ID (no longer assumes GitHub)
  async findByClerkOrgId(clerkOrgId: string) {
    return await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, clerkOrgId),
    });
  }

  // KEEP: Still needed for GitHub webhook resolution
  async findByGithubInstallationId(installationId: number) {
    return await db.query.organizations.findFirst({
      where: eq(organizations.githubInstallationId, installationId),
    });
  }

  // KEEP: Still needed for checking duplicates
  async findByGithubOrgId(githubOrgId: number) {
    return await db.query.organizations.findFirst({
      where: eq(organizations.githubOrgId, githubOrgId),
    });
  }
}
```

### 2. WorkspacesService

**File:** `api/console/src/lib/services/workspaces.ts`

**Breaking Change:** Remove `resolveFromGithubOrgSlug` method

```typescript
export class WorkspacesService {
  // REMOVED: No longer resolve workspace from GitHub slug
  // async resolveFromGithubOrgSlug(githubOrgSlug: string) { ... }

  // NEW: Resolve workspace from organization ID
  async resolveFromOrganizationId(organizationId: string) {
    const org = await organizationsService.findById(organizationId);
    if (!org) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    return {
      workspaceId: org.workspaceId,
      workspaceKey: await this.getWorkspaceKey(org.workspaceId),
    };
  }

  // NEW: Resolve workspace from GitHub installation (for webhooks)
  async resolveFromGithubInstallation(installationId: number) {
    const org = await organizationsService.findByGithubInstallationId(installationId);
    if (!org) {
      throw new Error(`No organization found for installation ${installationId}`);
    }

    return {
      workspaceId: org.workspaceId,
      workspaceKey: await this.getWorkspaceKey(org.workspaceId),
      organizationId: org.id,
    };
  }

  // KEEP: Get workspace key from private config
  private async getWorkspaceKey(workspaceId: string): Promise<string> {
    const config = getPrivateConfig();
    const workspace = config.workspaces.find((w) => w.workspaceId === workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found in config`);
    }
    return workspace.workspaceKey;
  }
}
```

---

## UI Changes

### 1. New Page: Create Organization

**File:** `apps/console/src/app/(onboarding)/onboarding/create-org/page.tsx` (NEW)

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationList } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { toast } from "sonner";

export default function CreateOrgPage() {
  const router = useRouter();
  const { setActive } = useOrganizationList();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);

    try {
      // 1. Create organization via API
      const response = await fetch("/api/organizations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create organization");
      }

      const org = await response.json();

      // 2. Set active organization in Clerk
      if (setActive) {
        await setActive({ organization: org.clerkOrgId });
      }

      toast.success("Organization created successfully!");

      // 3. Redirect to dashboard
      router.push(`/org/${org.slug}/dashboard`);
    } catch (error) {
      console.error("Failed to create organization:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create organization"
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-8">
        <div>
          <h1 className="text-2xl font-bold">Create Your Organization</h1>
          <p className="text-muted-foreground mt-2">
            Get started with Lightfast by creating your first organization.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              placeholder="Acme Inc"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                // Auto-generate slug
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
                );
              }}
            />
          </div>

          <div>
            <Label htmlFor="slug">Organization Slug</Label>
            <Input
              id="slug"
              placeholder="acme-inc"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="text-muted-foreground mt-1 text-sm">
              Used in URLs: console.lightfast.com/org/{slug}
            </p>
          </div>

          <Button
            onClick={handleCreate}
            disabled={!name || !slug || isCreating}
            className="w-full"
          >
            {isCreating ? "Creating..." : "Create Organization"}
          </Button>
        </div>

        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            Already have an invite?{" "}
            <a href="/onboarding/join-org" className="text-primary hover:underline">
              Join an organization
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

### 2. Updated Page: Onboarding Entry

**File:** `apps/console/src/app/(onboarding)/onboarding/page.tsx`

```typescript
// BEFORE: Always redirects to connect-github
export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  redirect("/onboarding/connect-github");
}

// AFTER: Redirects to create org
export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  redirect("/onboarding/create-org");
}
```

### 3. Updated Page: Connect GitHub (Now Optional)

**File:** `apps/console/src/app/(onboarding)/onboarding/connect-github/page.tsx`

**Changes:**
- Remove "required" messaging
- Add "Skip for now" option
- Show as optional integration step
- Redirect to integrations settings instead of claim flow

```typescript
"use client";

export default function ConnectGitHubPage() {
  const router = useRouter();

  const handleConnectGitHub = () => {
    // Redirect to GitHub OAuth with callback to integrations page
    const callbackUrl = encodeURIComponent("/org/settings/integrations");
    window.location.href = `/api/github/auth?callback=${callbackUrl}`;
  };

  const handleSkip = () => {
    router.push("/org/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-8">
        <div>
          <h1 className="text-2xl font-bold">Connect GitHub (Optional)</h1>
          <p className="text-muted-foreground mt-2">
            Connect your GitHub account to sync repositories and documentation.
            You can do this later in settings.
          </p>
        </div>

        <div className="space-y-4">
          <Button onClick={handleConnectGitHub} className="w-full">
            Connect GitHub
          </Button>

          <Button onClick={handleSkip} variant="outline" className="w-full">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 4. Deleted Page: Claim Organization

**File:** `apps/console/src/app/(onboarding)/onboarding/claim-org/page.tsx` (DELETE)

This entire 546-line file is removed. Replaced by `create-org/page.tsx`.

### 5. New Page: Organization Settings - Integrations

**File:** `apps/console/src/app/(app)/org/[slug]/settings/integrations/page.tsx` (NEW)

```typescript
"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { toast } from "sonner";

export default function IntegrationsPage() {
  const { organization } = useOrganization();
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubOrg, setGithubOrg] = useState<string | null>(null);

  useEffect(() => {
    // Fetch organization details to check GitHub connection
    // TODO: Implement tRPC query
  }, [organization]);

  const handleConnectGitHub = () => {
    const callbackUrl = encodeURIComponent(
      `/org/${organization?.slug}/settings/integrations`
    );
    window.location.href = `/api/github/auth?callback=${callbackUrl}`;
  };

  const handleDisconnectGitHub = async () => {
    // TODO: Implement disconnect API
    toast.success("GitHub disconnected");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect external services to sync data into Lightfast.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-900">
              {/* GitHub icon */}
            </div>
            <div>
              <h3 className="font-semibold">GitHub</h3>
              {githubConnected ? (
                <p className="text-muted-foreground text-sm">
                  Connected to {githubOrg}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Sync repositories and documentation
                </p>
              )}
            </div>
          </div>

          {githubConnected ? (
            <Button variant="destructive" onClick={handleDisconnectGitHub}>
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnectGitHub}>Connect</Button>
          )}
        </div>
      </Card>

      {/* Future integrations */}
      <Card className="p-6 opacity-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500">
              {/* Linear icon */}
            </div>
            <div>
              <h3 className="font-semibold">Linear</h3>
              <p className="text-muted-foreground text-sm">Coming soon</p>
            </div>
          </div>
          <Button disabled>Connect</Button>
        </div>
      </Card>
    </div>
  );
}
```

---

## Middleware Changes

**File:** `apps/console/src/middleware.ts`

```typescript
// BEFORE: Redirect pending users to claim-org
if (isPending && !isOnboardingRoute(req) && !isPublicRoute(req)) {
  return NextResponse.redirect(new URL("/onboarding/claim-org", req.url));
}

// AFTER: Redirect pending users to create-org
if (isPending && !isOnboardingRoute(req) && !isPublicRoute(req)) {
  return NextResponse.redirect(new URL("/onboarding/create-org", req.url));
}
```

---

## tRPC Router Changes

### 1. Organization Router

**File:** `api/console/src/router/organization.ts`

**New Procedures:**
```typescript
export const organizationRouter = {
  // UPDATED: List all user orgs (Clerk + DB)
  listUserOrganizations: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    const clerk = await clerkClient();

    const { data: memberships } =
      await clerk.users.getOrganizationMembershipList({ userId });

    const enrichedOrgs = await Promise.all(
      memberships.map(async (membership) => {
        const clerkOrg = membership.organization;

        const dbOrg = await db.query.organizations.findFirst({
          where: eq(organizations.clerkOrgId, clerkOrg.id),
        });

        return {
          id: clerkOrg.id,
          slug: clerkOrg.slug,
          name: clerkOrg.name,
          role: membership.role,
          workspaceId: dbOrg?.workspaceId ?? null,
          githubConnected: Boolean(dbOrg?.githubInstallationId),
          githubOrg: dbOrg?.githubOrgSlug ?? null,
        };
      })
    );

    return enrichedOrgs;
  }),

  // NEW: Get organization details
  getOrganization: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const org = await organizationsService.findBySlug(input.slug);
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return org;
    }),

  // NEW: Check slug availability
  checkSlugAvailability: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const existing = await organizationsService.findBySlug(input.slug);
      return { available: !existing };
    }),
} satisfies TRPCRouterRecord;
```

---

## Testing Checklist

### Database Migration Testing

- [ ] Run migration on local database
- [ ] Verify organizations table schema:
  ```sql
  DESCRIBE lightfast_organizations;
  -- Should show: name, slug, workspace_id (NOT NULL)
  -- Should show: github_* fields (NULL allowed)
  ```
- [ ] Verify backfill for existing orgs:
  ```sql
  SELECT id, name, slug, workspace_id, github_org_id
  FROM lightfast_organizations;
  -- All rows should have name, slug, workspace_id populated
  ```
- [ ] Verify workspace ID uniqueness:
  ```sql
  SELECT workspace_id, COUNT(*) FROM lightfast_organizations
  GROUP BY workspace_id HAVING COUNT(*) > 1;
  -- Should return 0 rows
  ```
- [ ] Test connected_repositories FK constraint:
  ```sql
  DELETE FROM lightfast_organizations WHERE id = 'test-org-id';
  -- Should cascade delete connected repositories
  ```

### API Testing

#### Create Organization
- [ ] POST `/api/organizations/create` with valid data
- [ ] Verify Clerk org created
- [ ] Verify Lightfast org created with stable workspace ID
- [ ] Verify workspace ID format: `ws_${nanoid(12)}`
- [ ] Test duplicate slug rejection (409)
- [ ] Test invalid slug format (400)

#### Connect GitHub Integration
- [ ] POST `/api/integrations/github/connect` with valid installation ID
- [ ] Verify GitHub fields populated in database
- [ ] Verify `githubConnectedAt` timestamp set
- [ ] Test duplicate connection rejection (409)
- [ ] Test installation already used by another org (409)

#### GitHub Webhooks
- [ ] Trigger push webhook for connected repository
- [ ] Verify workspace resolved via installation ID (not slug)
- [ ] Verify workflow triggered with correct stable workspace ID
- [ ] Test webhook for non-connected repository (skipped)
- [ ] Test webhook for non-existent installation (404)

### UI Testing

#### Onboarding Flow - New User
- [ ] Visit `/onboarding`
- [ ] Should redirect to `/onboarding/create-org`
- [ ] Create organization with name and slug
- [ ] Verify organization created
- [ ] Verify redirected to dashboard
- [ ] Verify active org set in Clerk

#### Onboarding Flow - GitHub Connection (Optional)
- [ ] Create organization first
- [ ] Navigate to Settings → Integrations
- [ ] Click "Connect GitHub"
- [ ] Complete GitHub OAuth
- [ ] Verify GitHub connected
- [ ] Verify repositories synced

#### Organization Switcher
- [ ] Switch between organizations
- [ ] Verify active org updates
- [ ] Verify query cache invalidated
- [ ] Verify no duplicate orgs shown

### Edge Case Testing

#### Migration from Phase 1.5 to Phase 1.6
- [ ] Existing GitHub-claimed org:
  - [ ] Verify `workspace_id` preserved as `ws_${githubOrgSlug}`
  - [ ] Verify `name` and `slug` backfilled from Clerk
  - [ ] Verify `githubConnectedAt` set to `createdAt`
- [ ] Webhooks for migrated orgs:
  - [ ] Verify workspace resolution works
  - [ ] Verify existing repositories still sync

#### New Organization (Phase 1.6)
- [ ] Create org without GitHub
- [ ] Verify workspace ID is `ws_${nanoid(12)}` (not GitHub-based)
- [ ] Connect GitHub later
- [ ] Verify workspace ID unchanged
- [ ] Verify repositories synced correctly

#### GitHub Integration Conflicts
- [ ] Try connecting same installation to two orgs (should fail)
- [ ] Try connecting different installations to same org (should replace)
- [ ] Disconnect GitHub, verify repositories marked inactive
- [ ] Reconnect GitHub, verify repositories reactivated

### Security Testing

- [ ] Cannot create org without authentication (401)
- [ ] Cannot connect GitHub without org membership (403)
- [ ] Cannot access another org's GitHub connection (403)
- [ ] Slug validation prevents injection attempts
- [ ] Workspace ID is cryptographically random (nanoid)

---

## Migration Strategy for Existing Users

### Pre-Migration (Phase 1.5 → Phase 1.6)

**Current State:**
- All organizations have GitHub integration (required)
- Workspace IDs are `ws_${githubOrgSlug}`
- Organizations created via "claiming" GitHub installations

**Goals:**
1. Preserve existing workspace IDs (no data migration in Pinecone)
2. Make GitHub optional for new orgs
3. Maintain backwards compatibility

### Migration Steps

**Step 1: Database Schema Update (Non-breaking)**
```sql
-- Add new fields with defaults (allows existing rows to work)
ALTER TABLE lightfast_organizations
  ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN slug VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN workspace_id VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN github_connected_at TIMESTAMP NULL;

-- Make GitHub fields nullable (breaking change - requires backfill first)
ALTER TABLE lightfast_organizations
  MODIFY COLUMN github_org_id INT NULL,
  MODIFY COLUMN github_installation_id INT NULL,
  MODIFY COLUMN github_org_slug VARCHAR(255) NULL;

-- Add constraints after backfill
ALTER TABLE lightfast_organizations
  ADD UNIQUE INDEX idx_workspace_id (workspace_id),
  ADD UNIQUE INDEX idx_slug (slug);
```

**Step 2: Backfill Existing Data**
```typescript
// scripts/migrate-phase1.6-backfill.ts
import { db } from "@db/console/client";
import { organizations } from "@db/console/schema";
import { clerkClient } from "@vendor/clerk/server";

async function backfillOrganizations() {
  const orgs = await db.query.organizations.findMany();

  for (const org of orgs) {
    // Get Clerk org details for name
    const clerk = await clerkClient();
    const clerkOrg = await clerk.organizations.getOrganization({
      organizationId: org.clerkOrgId,
    });

    // Preserve existing workspace ID format
    const workspaceId = `ws_${org.githubOrgSlug}`;

    await db
      .update(organizations)
      .set({
        name: clerkOrg.name,
        slug: clerkOrg.slug,
        workspaceId,
        githubConnectedAt: org.createdAt, // Mark as connected from creation
      })
      .where(eq(organizations.id, org.id));

    console.log(`Backfilled org ${org.id}: ${workspaceId}`);
  }
}

backfillOrganizations();
```

**Step 3: Code Deployment**
- Deploy new API routes (`/create`, `/integrations/github/connect`)
- Deploy new UI components (create-org page)
- Update webhook handler (resolve via installation ID)
- Update middleware (redirect to create-org)

**Step 4: Remove Deprecated Code**
- Delete `/api/organizations/claim` route
- Delete claim-org page
- Remove `WorkspacesService.resolveFromGithubOrgSlug`

### Rollback Plan

If migration fails, rollback steps:

1. **Revert database schema:**
   ```sql
   ALTER TABLE lightfast_organizations
     DROP COLUMN name,
     DROP COLUMN slug,
     DROP COLUMN workspace_id,
     DROP COLUMN github_connected_at,
     MODIFY COLUMN github_org_id INT NOT NULL,
     MODIFY COLUMN github_installation_id INT NOT NULL,
     MODIFY COLUMN github_org_slug VARCHAR(255) NOT NULL;
   ```

2. **Revert code deployment:**
   - Restore `/api/organizations/claim` route
   - Restore claim-org page
   - Restore old webhook resolution logic

3. **Data integrity check:**
   ```sql
   -- Verify all orgs have GitHub data
   SELECT * FROM lightfast_organizations
   WHERE github_org_id IS NULL OR github_installation_id IS NULL;
   -- Should return 0 rows
   ```

---

## Architecture Benefits

✅ **Eliminates 13 onboarding bugs** - No more claiming race conditions, installation ID duplication, slug conflicts
✅ **Faster time to market** - 12 weeks vs 16 weeks to fix bugs
✅ **Broader market reach** - Not limited to GitHub users
✅ **Standard UX** - Create/join flow like Vercel, Clerk, Linear
✅ **Future-proof** - Easy to add Bitbucket, GitLab, Notion, Linear
✅ **Stable workspace IDs** - No more recomputing from GitHub slugs
✅ **Clean separation** - Organizations ≠ Integrations
✅ **Backwards compatible** - Existing orgs work without changes

---

## Files Summary

### New Files (8)

| File | Purpose |
|------|---------|
| `docs/architecture/phase1.6/IMPLEMENTATION.md` | This implementation plan |
| `apps/console/src/app/api/organizations/create/route.ts` | Create native Lightfast organization |
| `apps/console/src/app/api/integrations/github/connect/route.ts` | Connect GitHub to existing org |
| `apps/console/src/app/(onboarding)/onboarding/create-org/page.tsx` | New onboarding UI - create org |
| `apps/console/src/app/(app)/org/[slug]/settings/integrations/page.tsx` | Integrations management UI |
| `db/console/src/migrations/XXXXXX_phase1.6_decouple_github.sql` | Database migration script |
| `scripts/migrate-phase1.6-backfill.ts` | Backfill existing organizations |
| `scripts/migrate-phase1.6-verify.ts` | Verify migration success |

### Modified Files (14)

| File | Changes |
|------|---------|
| `db/console/src/schema/tables/organizations.ts` | Add native fields, make GitHub optional |
| `db/console/src/schema/tables/connected-repositories.ts` | Remove duplicate fields, add FK |
| `apps/console/src/app/(onboarding)/onboarding/page.tsx` | Redirect to create-org instead of connect-github |
| `apps/console/src/app/(onboarding)/onboarding/connect-github/page.tsx` | Make optional, add skip button |
| `apps/console/src/app/(github)/api/github/webhooks/route.ts` | Resolve workspace via installation ID |
| `apps/console/src/middleware.ts` | Redirect pending users to create-org |
| `api/console/src/lib/services/organizations.ts` | Add create(), connectGitHub(), findBySlug() |
| `api/console/src/lib/services/workspaces.ts` | Remove resolveFromGithubOrgSlug(), add resolveFromGithubInstallation() |
| `api/console/src/router/organization.ts` | Add getOrganization, checkSlugAvailability |
| `apps/console/src/components/org-switcher.tsx` | Show all orgs, indicate GitHub status |
| `api/console/src/inngest/workflow/docs-ingestion.ts` | Resolve workspace from installation |
| `packages/console-config/src/private-config.ts` | Support non-GitHub workspace IDs |
| `apps/console/src/app/(app)/org/[slug]/layout.tsx` | Handle orgs without GitHub |
| `apps/console/src/app/(app)/org/[slug]/settings/layout.tsx` | Add Integrations tab |

### Deleted Files (2)

| File | Reason |
|------|--------|
| `apps/console/src/app/(github)/api/organizations/claim/route.ts` | Replaced by create + connect APIs |
| `apps/console/src/app/(onboarding)/onboarding/claim-org/page.tsx` | Replaced by create-org page |

### Unchanged Files (Work As-Is)

| File | Status |
|------|--------|
| `api/console/src/inngest/workflow/ensure-store.ts` | ✅ Already source-agnostic |
| `api/console/src/inngest/workflow/shared/process-documents.ts` | ✅ Uses stable workspace IDs |
| `api/console/src/inngest/workflow/shared/delete-documents.ts` | ✅ Uses stable workspace IDs |
| `db/console/src/schema/tables/stores.ts` | ✅ Already uses workspaceId field |
| `db/console/src/schema/tables/docs-documents.ts` | ✅ Phase 1.5 made source-agnostic |

---

## Timeline Estimate

**Total: 4 weeks (12 weeks faster than fixing 13 bugs individually)**

### Week 1: Database & Services (Foundation)
- [ ] Day 1-2: Database schema migration + backfill script
- [ ] Day 3-4: Update OrganizationsService and WorkspacesService
- [ ] Day 5: Write migration tests and verification scripts

### Week 2: API Layer (Backend)
- [ ] Day 1-2: Implement `/api/organizations/create` endpoint
- [ ] Day 2-3: Implement `/api/integrations/github/connect` endpoint
- [ ] Day 4: Update GitHub webhooks handler
- [ ] Day 5: API testing and error handling

### Week 3: UI Layer (Frontend)
- [ ] Day 1-2: Build create-org page
- [ ] Day 3: Update onboarding entry and connect-github page
- [ ] Day 4: Build integrations settings page
- [ ] Day 5: Update org switcher and middleware

### Week 4: Integration Testing & Deployment
- [ ] Day 1-2: End-to-end testing (new flow + existing flow)
- [ ] Day 3: Edge case testing and bug fixes
- [ ] Day 4: Staging deployment and smoke tests
- [ ] Day 5: Production deployment and monitoring

---

## Success Criteria

### Functional Requirements
- [ ] New users can create Lightfast organizations without GitHub
- [ ] Existing users' orgs continue working (zero downtime)
- [ ] GitHub connection is optional and post-org-creation
- [ ] Workspace IDs are stable and never change
- [ ] All 13 onboarding bugs eliminated

### Non-Functional Requirements
- [ ] Zero data loss during migration
- [ ] All existing Pinecone vectors remain accessible
- [ ] API response times < 200ms for org creation
- [ ] UI loads in < 1s for onboarding flow
- [ ] 100% test coverage for new services

### Business Metrics
- [ ] Onboarding completion rate increases by 30%
- [ ] GitHub connection rate (optional) > 70%
- [ ] Zero customer support tickets for claiming bugs
- [ ] Enable 3+ new integrations in Phase 2 (Linear, Notion, etc.)

---

## Next Steps (Post Phase 1.6)

### Phase 2: Additional Integrations
With decoupled architecture in place:
1. **Linear integration** - Issues, projects, comments
2. **Notion integration** - Pages, databases
3. **Sentry integration** - Issues, errors
4. **Vercel integration** - Deployments, logs
5. **Zendesk integration** - Tickets, KB articles

**Effort per integration:** 1-2 weeks (vs 8-12 weeks if coupled to orgs)

### Phase 2.5: Relationship Extraction
- Cross-source entity resolution
- PR → Issue → Deployment chains
- Who owns what across tools
- See: `docs/architecture/phase2.5/`

### Phase 3: Multi-Workspace Organizations
- Organizations can have multiple workspaces
- Workspace-level permissions
- Team-based access control

---

## Questions?

**Database Schema:**
- See: `db/console/src/schema/tables/organizations.ts`
- Migration: `db/console/src/migrations/XXXXXX_phase1.6_decouple_github.sql`

**API Design:**
- Create org: `apps/console/src/app/api/organizations/create/route.ts`
- Connect GitHub: `apps/console/src/app/api/integrations/github/connect/route.ts`

**Strategic Context:**
- See: `STRATEGIC_ARCHITECTURE_ANALYSIS.md` (3 pathways comparison)
- Bugs fixed: `ONBOARDING_DB_CONNECTION_ANALYSIS.md` (13 bugs eliminated)

**Phase 1.5 Reference:**
- See: `docs/architecture/phase1.5/IMPLEMENTATION.md` (multi-source infrastructure)

---

**Status:** Ready for review and implementation
**Priority:** P0 - Critical path to product-market fit
**Risk:** Low - Backwards compatible migration with rollback plan
