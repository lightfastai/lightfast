# Native OAuth tRPC Pattern Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the native OAuth browser route with the app's existing tRPC server-query patterns while preserving direct server-side tRPC callers for external native OAuth JSON facade routes.

**Architecture:** App-rendered pages use `@repo/app-trpc/server` and the request-scoped React Query client for query data, matching `(pending-allowed)` and org settings pages. App-owned JSON facade route handlers keep using `createCallerFactory()` because they adapt external native clients to internal tRPC procedures and need explicit request headers. Shared shell account/org prefetch moves out of the root `(app)` layout so `/oauth/*` does not fetch shell data it never renders.

**Tech Stack:** Next.js App Router, React Server Components, `@repo/app-trpc`, `@trpc/server`, `@trpc/tanstack-react-query`, TanStack Query hydration, Clerk cookie auth, Zod, Vitest, Testing Library.

**Implementation revision:** After architecture review, the browser OAuth org
selection flow should use normal app tRPC end to end. The final implementation
removes `continueNativeAuth`, makes `NativeAuthOrgSelect` a client component,
calls `trpc.native.auth.createAttempt.mutationOptions(...)`, and navigates to
the returned Clerk authorization URL in the browser. Direct server-side tRPC
caller usage is limited to the native HTTP facade routes under `/api/oauth/*`,
via `createNativeOAuthFacadeCaller`.

---

## Scope

In scope:

- Convert `/oauth/[client]/start` from a direct tRPC caller to `getQueryClient().fetchQuery(trpc.native.auth.listOrganizations.queryOptions())`.
- Keep native OAuth JSON facade routes on direct server-side tRPC calls.
- Move the native-auth direct-caller helper out of the API route private folder so server actions and route handlers share it without depending on an API route subtree.
- Move eager shell prefetch from `apps/app/src/app/(app)/layout.tsx` into shell-rendering layouts only.
- Update focused tests for OAuth start, native OAuth facade routes, root app layout, pending-allowed layout, org layout, and shell data prefetch.

Out of scope:

- Changing native OAuth procedure contracts in `api/app`.
- Converting `continueNativeAuth` to a client mutation.
- Reworking Clerk OAuth config, token exchange, or native-session metadata.
- Replacing the existing app-level `TRPCReactProvider`, `NuqsAdapter`, `PageErrorBoundary`, or `Toaster`.

## Architecture Decisions

- **Browser pages use app tRPC hydration patterns:** If a route renders inside the app and needs query data for UI, use `@repo/app-trpc/server` query options and the request-scoped query client. This is the same boundary as `account/settings/general`, org layout access checks, and API key settings.
- **Facade routes use direct callers:** `GET /api/oauth/[client]/config` and `POST /api/oauth/finalize` are external JSON adapters. They should keep `createCallerFactory(appRouter)` so they can pass `Authorization`, `x-lightfast-native-client`, and `x-trpc-source` into `createTRPCContext`.
- **Server actions may use direct callers when executing mutations:** `continueNativeAuth` is a form server action and redirects to Clerk after `native.auth.createAttempt`. There is no established server-action mutation pattern using `@repo/app-trpc/server`, so it should continue using the direct caller helper.
- **Root `(app)` layout should not own shell data:** `/oauth/*` shares root app providers but does not render `TeamSwitcher` or `UserMenu`. Account/org shell layouts should prefetch `viewer.organization.listUserOrganizations` and `viewer.account.get` because those layouts render the client islands that consume the queries.

## File Structure

Create:

- `apps/app/src/app/(app)/(oauth)/_server/native-auth-caller.ts`
- `apps/app/src/components/shell-data-boundary.tsx`
- `apps/app/src/__tests__/app/(app)/layout.test.tsx`
- `apps/app/src/__tests__/components/shell-data-boundary.test.tsx`

Modify:

- `apps/app/src/app/(app)/layout.tsx`
- `apps/app/src/app/(app)/(pending-allowed)/layout.tsx`
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/layout.tsx`
- `apps/app/src/app/(app)/(oauth)/api/oauth/[client]/config/route.ts`
- `apps/app/src/app/(app)/(oauth)/api/oauth/finalize/route.ts`
- `apps/app/src/app/(app)/(oauth)/oauth/[client]/start/actions.ts`
- `apps/app/src/app/(app)/(oauth)/oauth/[client]/start/page.tsx`
- `apps/app/src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx`
- `apps/app/src/__tests__/app/(app)/(pending-allowed)/layout.test.tsx`
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/layout.test.tsx`

Delete:

- `apps/app/src/app/(app)/(oauth)/api/oauth/_server/native-auth-caller.ts`

---

### Task 1: Move the Native OAuth Direct Caller Helper

**Files:**
- Create: `apps/app/src/app/(app)/(oauth)/_server/native-auth-caller.ts`
- Delete: `apps/app/src/app/(app)/(oauth)/api/oauth/_server/native-auth-caller.ts`
- Modify: `apps/app/src/app/(app)/(oauth)/api/oauth/[client]/config/route.ts`
- Modify: `apps/app/src/app/(app)/(oauth)/api/oauth/finalize/route.ts`
- Modify: `apps/app/src/app/(app)/(oauth)/oauth/[client]/start/actions.ts`
- Modify: `apps/app/src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx`

- [ ] **Step 1: Create the route-group server helper**

Create `apps/app/src/app/(app)/(oauth)/_server/native-auth-caller.ts`:

```ts
import "server-only";

import { appRouter, createCallerFactory, createTRPCContext } from "@api/app";
import {
  NATIVE_AUTH_HEADERS,
  type NativeClient,
} from "@repo/native-auth-contract";

const createCaller = createCallerFactory(appRouter);

export async function createNativeAuthCaller(input: {
  headers: Headers;
  source: NativeClient;
}) {
  const headers = new Headers(input.headers);
  headers.set("x-trpc-source", input.source);
  headers.set(NATIVE_AUTH_HEADERS.client, input.source);

  return createCaller(await createTRPCContext({ headers }));
}
```

- [ ] **Step 2: Update facade route imports**

In `apps/app/src/app/(app)/(oauth)/api/oauth/[client]/config/route.ts`, replace:

```ts
import { createNativeAuthCaller } from "../../_server/native-auth-caller";
```

with:

```ts
import { createNativeAuthCaller } from "../../../../_server/native-auth-caller";
```

In `apps/app/src/app/(app)/(oauth)/api/oauth/finalize/route.ts`, replace:

```ts
import { createNativeAuthCaller } from "../_server/native-auth-caller";
```

with:

```ts
import { createNativeAuthCaller } from "../../../_server/native-auth-caller";
```

- [ ] **Step 3: Update the server action import**

In `apps/app/src/app/(app)/(oauth)/oauth/[client]/start/actions.ts`, replace:

```ts
import { createNativeAuthCaller } from "~/app/(app)/(oauth)/api/oauth/_server/native-auth-caller";
```

with:

```ts
import { createNativeAuthCaller } from "~/app/(app)/(oauth)/_server/native-auth-caller";
```

- [ ] **Step 4: Update the action test mock path**

In `apps/app/src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx`, replace the native caller mock module id with:

```ts
vi.mock("~/app/(app)/(oauth)/_server/native-auth-caller", () => ({
  createNativeAuthCaller: vi.fn(async () => ({
    native: {
      auth: {
        createAttempt,
      },
    },
  })),
}));
```

This mock should expose only `createAttempt` after Task 2, because the page will no longer use the direct caller for `listOrganizations`.

- [ ] **Step 5: Delete the old helper**

Delete `apps/app/src/app/(app)/(oauth)/api/oauth/_server/native-auth-caller.ts`.

- [ ] **Step 6: Run focused facade tests**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/api/oauth/oauth-routes.test.ts'
```

Expected: PASS. The tests should still verify that facade routes set `authorization`, `x-lightfast-native-client`, and `x-trpc-source` before creating tRPC context.

- [ ] **Step 7: Commit the helper move**

```bash
git add \
  'apps/app/src/app/(app)/(oauth)/_server/native-auth-caller.ts' \
  'apps/app/src/app/(app)/(oauth)/api/oauth/_server/native-auth-caller.ts' \
  'apps/app/src/app/(app)/(oauth)/api/oauth/[client]/config/route.ts' \
  'apps/app/src/app/(app)/(oauth)/api/oauth/finalize/route.ts' \
  'apps/app/src/app/(app)/(oauth)/oauth/[client]/start/actions.ts' \
  'apps/app/src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx'
git commit -m "refactor: move native oauth caller helper"
```

### Task 2: Convert OAuth Start Page to App tRPC Server Query Pattern

**Files:**
- Modify: `apps/app/src/app/(app)/(oauth)/oauth/[client]/start/page.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx`

- [ ] **Step 1: Replace the page test's direct-caller setup with app tRPC server mocks**

In `apps/app/src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx`, keep `createAttempt`, `redirectMock`, and the action mock from Task 1. Add these mocks near the top of the file:

```ts
const fetchQuery = vi.fn();
const listOrganizationsQueryOptions = vi.fn(() => ({
  queryKey: ["native", "auth", "listOrganizations"],
}));

vi.mock("@repo/app-trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery }),
  trpc: {
    native: {
      auth: {
        listOrganizations: {
          queryOptions: listOrganizationsQueryOptions,
        },
      },
    },
  },
}));
```

Remove `listOrganizations` from the native caller mock.

- [ ] **Step 2: Update test setup to resolve organizations from `fetchQuery`**

In the test `beforeEach`, replace `listOrganizations.mockResolvedValue([...])` with:

```ts
fetchQuery.mockResolvedValue([
  {
    bindingStatus: "bound",
    id: "org_1",
    name: "Acme",
    role: "org:admin",
    slug: "acme",
  },
]);
```

Also reset the new mocks:

```ts
fetchQuery.mockReset();
listOrganizationsQueryOptions.mockClear();
```

- [ ] **Step 3: Assert the page uses the server query options path**

In the test that renders organizations, add these assertions after rendering:

```ts
expect(listOrganizationsQueryOptions).toHaveBeenCalledOnce();
expect(fetchQuery).toHaveBeenCalledWith({
  queryKey: ["native", "auth", "listOrganizations"],
});
```

- [ ] **Step 4: Run the test and confirm the current implementation fails**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx'
```

Expected before implementation: FAIL because `NativeAuthStartPage` still imports `createNativeAuthCaller` and does not call `getQueryClient().fetchQuery(...)`.

- [ ] **Step 5: Implement the server query pattern**

Replace `apps/app/src/app/(app)/(oauth)/oauth/[client]/start/page.tsx` with:

```tsx
import {
  type NativeClient,
  nativeClientSchema,
} from "@repo/native-auth-contract";
import { getQueryClient, trpc } from "@repo/app-trpc/server";
import { notFound } from "next/navigation";

import { NativeAuthOrgSelect } from "./_components/native-auth-org-select";
import { nativeAuthStartSearchSchema } from "./validators";

export const dynamic = "force-dynamic";

export default async function NativeAuthStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsedClient = nativeClientSchema.safeParse((await params).client);
  const parsedSearch = nativeAuthStartSearchSchema.safeParse(
    await searchParams
  );

  if (!(parsedClient.success && parsedSearch.success)) {
    notFound();
  }

  const client: NativeClient = parsedClient.data;
  const organizations = await getQueryClient().fetchQuery(
    trpc.native.auth.listOrganizations.queryOptions()
  );

  return (
    <NativeAuthOrgSelect
      client={client}
      codeChallenge={parsedSearch.data.code_challenge}
      organizations={organizations}
      redirectUri={parsedSearch.data.redirect_uri}
      state={parsedSearch.data.state}
    />
  );
}
```

- [ ] **Step 6: Run the focused OAuth start test**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx'
```

Expected: PASS.

- [ ] **Step 7: Commit the OAuth start page query migration**

```bash
git add \
  'apps/app/src/app/(app)/(oauth)/oauth/[client]/start/page.tsx' \
  'apps/app/src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx'
git commit -m "refactor: use app trpc query for oauth org list"
```

### Task 3: Move Shell Query Prefetch Out of Root App Layout

**Files:**
- Create: `apps/app/src/components/shell-data-boundary.tsx`
- Create: `apps/app/src/__tests__/components/shell-data-boundary.test.tsx`
- Create: `apps/app/src/__tests__/app/(app)/layout.test.tsx`
- Modify: `apps/app/src/app/(app)/layout.tsx`
- Modify: `apps/app/src/app/(app)/(pending-allowed)/layout.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/layout.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-allowed)/layout.test.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/layout.test.tsx`

- [ ] **Step 1: Write the shell boundary test**

Create `apps/app/src/__tests__/components/shell-data-boundary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accountQueryOptions = vi.fn(() => ({
  queryKey: ["viewer", "account", "get"],
}));
const hydrateClient = vi.fn(({ children }: { children?: ReactNode }) => (
  <div data-testid="shell-hydration">{children}</div>
));
const organizationListQueryOptions = vi.fn(() => ({
  queryKey: ["viewer", "organization", "listUserOrganizations"],
}));
const prefetch = vi.fn();

vi.mock("@repo/app-trpc/server", () => ({
  HydrateClient: hydrateClient,
  prefetch,
  trpc: {
    viewer: {
      account: {
        get: { queryOptions: accountQueryOptions },
      },
      organization: {
        listUserOrganizations: {
          queryOptions: organizationListQueryOptions,
        },
      },
    },
  },
}));

const { ShellDataBoundary } = await import("~/components/shell-data-boundary");

beforeEach(() => {
  accountQueryOptions.mockClear();
  hydrateClient.mockClear();
  organizationListQueryOptions.mockClear();
  prefetch.mockClear();
});

describe("ShellDataBoundary", () => {
  it("prefetches shell account and organization queries before hydrating children", () => {
    render(
      <ShellDataBoundary>
        <div>Shell child</div>
      </ShellDataBoundary>
    );

    expect(organizationListQueryOptions).toHaveBeenCalledOnce();
    expect(accountQueryOptions).toHaveBeenCalledOnce();
    expect(prefetch).toHaveBeenCalledWith({
      queryKey: ["viewer", "organization", "listUserOrganizations"],
    });
    expect(prefetch).toHaveBeenCalledWith({
      queryKey: ["viewer", "account", "get"],
    });
    expect(screen.getByTestId("shell-hydration")).toHaveTextContent(
      "Shell child"
    );
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/components/shell-data-boundary.test.tsx'
```

Expected before implementation: FAIL because `~/components/shell-data-boundary` does not exist.

- [ ] **Step 3: Write the root app layout regression test**

Create `apps/app/src/__tests__/app/(app)/layout.test.tsx`:

```tsx
import React from "react";
import { describe, expect, it, vi } from "vitest";

interface Kids {
  children?: React.ReactNode;
}

const prefetch = vi.fn(() => {
  throw new Error("root app layout must not prefetch shell data");
});

vi.mock("@repo/app-trpc/react", () => ({
  TRPCReactProvider: ({ children }: Kids) => <>{children}</>,
}));

vi.mock("@repo/app-trpc/server", () => ({
  HydrateClient: ({ children }: Kids) => <>{children}</>,
  prefetch,
  trpc: {
    viewer: {
      account: {
        get: { queryOptions: () => ({ queryKey: ["viewer", "account", "get"] }) },
      },
      organization: {
        listUserOrganizations: {
          queryOptions: () => ({
            queryKey: ["viewer", "organization", "listUserOrganizations"],
          }),
        },
      },
    },
  },
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock("nuqs/adapters/next/app", () => ({
  NuqsAdapter: ({ children }: Kids) => <>{children}</>,
}));

vi.mock("~/components/errors/page-error-boundary", () => ({
  PageErrorBoundary: ({ children }: Kids) => <>{children}</>,
}));

const { default: AppLayout } = await import("~/app/(app)/layout");

function containsText(node: unknown, text: string): boolean {
  if (!React.isValidElement(node)) {
    return false;
  }

  const props = node.props as { children?: React.ReactNode };
  return React.Children.toArray(props.children).some((child) =>
    typeof child === "string"
      ? child.includes(text)
      : containsText(child, text)
  );
}

describe("root app layout", () => {
  it("provides app-level wrappers without prefetching shell-only data", () => {
    const element = AppLayout({ children: <main>OAuth handoff</main> });

    expect(prefetch).not.toHaveBeenCalled();
    expect(containsText(element, "OAuth handoff")).toBe(true);
  });
});
```

- [ ] **Step 4: Run the root layout test and confirm it fails**

Run:

```bash
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/layout.test.tsx'
```

Expected before implementation: FAIL with `root app layout must not prefetch shell data` because `apps/app/src/app/(app)/layout.tsx` still prefetches shell account and organization queries.

- [ ] **Step 5: Create the shell boundary**

Create `apps/app/src/components/shell-data-boundary.tsx`:

```tsx
import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";

export function ShellDataBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  prefetch(trpc.viewer.organization.listUserOrganizations.queryOptions());
  prefetch(trpc.viewer.account.get.queryOptions());

  return <HydrateClient>{children}</HydrateClient>;
}
```

- [ ] **Step 6: Remove eager shell prefetch from the root app layout**

In `apps/app/src/app/(app)/layout.tsx`, replace the file with:

```tsx
import { TRPCReactProvider } from "@repo/app-trpc/react";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <TRPCReactProvider>
        <PageErrorBoundary fallbackTitle="Failed to load application">
          <div className="dark flex h-screen flex-col overflow-hidden bg-background">
            {children}
            <Toaster />
          </div>
        </PageErrorBoundary>
      </TRPCReactProvider>
    </NuqsAdapter>
  );
}
```

- [ ] **Step 7: Wrap the pending-allowed shell layout**

In `apps/app/src/app/(app)/(pending-allowed)/layout.tsx`, replace the file with:

```tsx
import { ShellDataBoundary } from "~/components/shell-data-boundary";
import { UserLayoutShell } from "~/components/user-layout-shell";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShellDataBoundary>
      <UserLayoutShell>{children}</UserLayoutShell>
    </ShellDataBoundary>
  );
}
```

- [ ] **Step 8: Wrap the org slug layout**

In `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/layout.tsx`, change the import from:

```ts
import { getQueryClient, HydrateClient, trpc } from "@repo/app-trpc/server";
```

to:

```ts
import { getQueryClient, trpc } from "@repo/app-trpc/server";
```

Add:

```ts
import { ShellDataBoundary } from "~/components/shell-data-boundary";
```

Replace the return block with:

```tsx
  return (
    <ShellDataBoundary>
      <OrgPageErrorBoundary orgSlug={slug}>{children}</OrgPageErrorBoundary>
    </ShellDataBoundary>
  );
```

- [ ] **Step 9: Update the pending-allowed layout test**

Replace `apps/app/src/__tests__/app/(app)/(pending-allowed)/layout.test.tsx` with:

```tsx
import React from "react";
import { describe, expect, it, vi } from "vitest";

interface Kids {
  children?: React.ReactNode;
}

vi.mock("~/components/shell-data-boundary", () => ({
  ShellDataBoundary: ({ children }: Kids) => (
    <section data-testid="shell-data-boundary">{children}</section>
  ),
}));

const { default: UserLayout } = await import(
  "~/app/(app)/(pending-allowed)/layout"
);

function containsComponentNamed(node: unknown, componentName: string): boolean {
  if (!React.isValidElement(node)) {
    return false;
  }

  const type = node.type;
  if (typeof type === "function" && type.name === componentName) {
    return true;
  }

  const props = node.props as { children?: React.ReactNode };
  return React.Children.toArray(props.children).some((child) =>
    containsComponentNamed(child, componentName)
  );
}

describe("user layout", () => {
  it("uses the shared shell data boundary and user layout shell", () => {
    const element = UserLayout({ children: <div>Account page</div> });

    expect(containsComponentNamed(element, "ShellDataBoundary")).toBe(true);
    expect(containsComponentNamed(element, "UserLayoutShell")).toBe(true);
  });
});
```

- [ ] **Step 10: Update the org layout test**

Replace `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/layout.test.tsx` with:

```tsx
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Kids {
  children?: React.ReactNode;
}

const fetchQueryMock = vi.fn();
const getBySlugQueryOptionsMock = vi.fn((input: { slug: string }) => ({
  queryKey: [["viewer", "organization", "getBySlug"], input],
}));
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@repo/app-trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  trpc: {
    viewer: {
      organization: {
        getBySlug: { queryOptions: getBySlugQueryOptionsMock },
      },
    },
  },
}));

vi.mock("@repo/ui/components/ui/sidebar", () => ({
  SidebarInset: ({ children }: Kids) => <>{children}</>,
  SidebarProvider: ({ children }: Kids) => <>{children}</>,
  SidebarTrigger: () => null,
}));

vi.mock("@vendor/observability/error/next", () => ({
  parseError: (error: unknown) => error,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    debug: vi.fn(),
  },
}));

vi.mock("~/components/app-sidebar", () => {
  function AppSidebar() {
    return <aside data-testid="app-sidebar" />;
  }

  return { AppSidebar };
});

vi.mock("~/components/authenticated-topbar", () => {
  function AuthenticatedTopbar({ left }: { left?: React.ReactNode }) {
    return <header>{left}</header>;
  }

  return { AuthenticatedTopbar };
});

vi.mock("~/components/errors/org-page-error-boundary", () => ({
  OrgPageErrorBoundary: ({ children }: Kids) => <>{children}</>,
}));

vi.mock("~/components/shell-data-boundary", () => ({
  ShellDataBoundary: ({ children }: Kids) => (
    <section data-testid="shell-data-boundary">{children}</section>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { default: OrgLayout } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/layout"
);

function containsComponentNamed(node: unknown, componentName: string): boolean {
  if (!React.isValidElement(node)) {
    return false;
  }

  const type = node.type;
  if (typeof type === "function" && type.name === componentName) {
    return true;
  }

  const props = node.props as { children?: React.ReactNode };
  return React.Children.toArray(props.children).some((child) =>
    containsComponentNamed(child, componentName)
  );
}

function invoke(slug = "acme") {
  return OrgLayout({
    children: <div>Workspace</div>,
    params: Promise.resolve({ slug }),
  });
}

describe("[slug]/layout - membership/slug access gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchQueryMock.mockReset();
    getBySlugQueryOptionsMock.mockClear();
  });

  it("sends denied org access to the route not-found boundary", async () => {
    fetchQueryMock.mockRejectedValue(new Error("Organization not found"));

    await expect(invoke("acme")).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("sends nonexistent org slugs to the route not-found boundary", async () => {
    fetchQueryMock.mockRejectedValue(new Error("Organization not found"));

    await expect(invoke("acme")).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("returns a UI-less membership boundary with shell data when org access is allowed", async () => {
    fetchQueryMock.mockResolvedValue({
      bindingStatus: "unbound",
      org: {
        id: "org_123",
        imageUrl: "",
        name: "Acme",
        slug: "acme",
      },
      role: "org:member",
    });

    const element = await invoke("acme");

    expect(containsComponentNamed(element, "ShellDataBoundary")).toBe(true);
    expect(containsComponentNamed(element, "AuthenticatedTopbar")).toBe(false);
    expect(containsComponentNamed(element, "AppSidebar")).toBe(false);
    expect(getBySlugQueryOptionsMock).toHaveBeenCalledWith({ slug: "acme" });
  });
});
```

- [ ] **Step 11: Run focused shell and layout tests**

Run:

```bash
pnpm --filter @lightfast/app test -- \
  'src/__tests__/app/(app)/layout.test.tsx' \
  'src/__tests__/components/shell-data-boundary.test.tsx' \
  'src/__tests__/app/(app)/(pending-allowed)/layout.test.tsx' \
  'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/layout.test.tsx'
```

Expected: PASS. The pending-allowed and org route trees should still render their shell wrappers, and `/oauth/*` should no longer inherit shell query prefetch from root layout.

- [ ] **Step 12: Commit the shell prefetch relocation**

```bash
git add \
  'apps/app/src/app/(app)/layout.tsx' \
  'apps/app/src/app/(app)/(pending-allowed)/layout.tsx' \
  'apps/app/src/app/(app)/(pending-not-allowed)/[slug]/layout.tsx' \
  'apps/app/src/components/shell-data-boundary.tsx' \
  'apps/app/src/__tests__/app/(app)/layout.test.tsx' \
  'apps/app/src/__tests__/components/shell-data-boundary.test.tsx' \
  'apps/app/src/__tests__/app/(app)/(pending-allowed)/layout.test.tsx' \
  'apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/layout.test.tsx'
git commit -m "refactor: scope shell query prefetch to shell layouts"
```

### Task 4: Final Verification

**Files:**
- Verify only; no source changes.

- [ ] **Step 1: Run focused app tests**

Run:

```bash
pnpm --filter @lightfast/app test -- \
  'src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx' \
  'src/__tests__/app/api/oauth/oauth-routes.test.ts' \
  'src/__tests__/app/(app)/layout.test.tsx' \
  'src/__tests__/components/shell-data-boundary.test.tsx' \
  'src/__tests__/app/(app)/(pending-allowed)/layout.test.tsx' \
  'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/layout.test.tsx' \
  'src/__tests__/proxy.test.ts'
```

Expected: PASS.

- [ ] **Step 2: Run the app typecheck**

Run:

```bash
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 3: Inspect remaining direct caller imports**

Run:

```bash
rg "createNativeAuthCaller|createCallerFactory|createTRPCContext" apps/app/src -n
```

Expected direct caller imports:

```text
apps/app/src/app/(app)/(oauth)/_server/native-auth-caller.ts
apps/app/src/app/(app)/(oauth)/api/oauth/[client]/config/route.ts
apps/app/src/app/(app)/(oauth)/api/oauth/finalize/route.ts
apps/app/src/app/(app)/(oauth)/oauth/[client]/start/actions.ts
```

There should be no direct caller import in `apps/app/src/app/(app)/(oauth)/oauth/[client]/start/page.tsx`.

## Execution Handoff

1. Subagent-Driven (recommended): dispatch a fresh subagent per task, review between tasks, and keep the commits from each task.
2. Inline Execution: execute tasks in this session using `superpowers:executing-plans`, batching only where the plan has explicit checkpoints.

## Self-Review

- Spec coverage: The plan covers the page query-pattern migration, direct-caller facade boundary, server-action helper sharing, root shell-prefetch relocation, focused tests, and typecheck verification.
- Placeholder scan: No task contains unresolved placeholder language or an unspecified testing instruction.
- Type consistency: The plan uses existing `trpc.native.auth.listOrganizations.queryOptions()`, `viewer.organization.listUserOrganizations`, `viewer.account.get`, `createNativeAuthCaller`, and `ShellDataBoundary` names consistently across tasks.
