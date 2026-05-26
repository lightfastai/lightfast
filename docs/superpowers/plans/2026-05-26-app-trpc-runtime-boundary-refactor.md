# App tRPC Runtime Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `@repo/app-trpc` and make each runtime consumer own its own tRPC client/provider configuration while keeping `@api/app` as the shared router contract.

**Architecture:** `@api/app` remains the server-side tRPC package for router definitions, context creation, procedure builders, auth gates, direct callers, and `AppRouter` types. `apps/app` owns Next.js web/RSC tRPC integration. `apps/desktop` owns Electron renderer tRPC integration and bridge-specific auth headers. There is intentionally no shared client core package.

**Tech Stack:** pnpm workspace, Turborepo boundaries, Next.js App Router, Electron/Vite renderer, tRPC v11, `@trpc/tanstack-react-query`, TanStack Query, SuperJSON, Vitest.

---

## File Structure

### Create

- `apps/app/src/trpc/query-client.ts`
  - App-owned TanStack Query client factory and hydration serialization config.
- `apps/app/src/trpc/react-query-meta.ts`
  - App-local TanStack Query `Register` augmentation for mutation metadata.
- `apps/app/src/trpc/react.tsx`
  - App-owned client-side tRPC React context, provider, HTTP links, web mutation toast policy, and same-origin credential behavior.
- `apps/app/src/trpc/server.tsx`
  - App-owned RSC tRPC proxy, request-scoped query client, `HydrateClient`, and `prefetch`.
- `apps/desktop/src/renderer/src/react/trpc/query-client.ts`
  - Desktop-owned TanStack Query client factory.
- `apps/desktop/src/renderer/src/react/trpc/react-query-meta.ts`
  - Desktop-local TanStack Query `Register` augmentation.
- `apps/desktop/src/renderer/src/react/trpc/react.tsx`
  - Desktop-owned `useTRPC`, provider, HTTP links, mutation toast policy, and desktop request headers.
- `apps/desktop/src/renderer/src/react/trpc/provider.tsx`
  - Desktop bridge adapter that reads `window.lightfastBridge` and passes app origin/auth headers into the desktop tRPC provider.

### Modify

- `apps/app/package.json`
  - Remove `@repo/app-trpc`.
  - Add direct dependencies used by local app tRPC modules: `@trpc/tanstack-react-query`, `superjson`, and `sonner`.
- `apps/app/next.config.ts`
  - Remove `@repo/app-trpc` from `transpilePackages` and `optimizePackageImports`.
- `apps/app/vitest.config.ts`
  - Remove `@repo/app-trpc` from inline dependency config.
- `apps/app/src/**`
  - Replace app imports from `@repo/app-trpc/server` with `~/trpc/server`.
  - Replace app imports from `@repo/app-trpc/react` with `~/trpc/react`.
  - Update tests that mock `@repo/app-trpc/*` to mock the new app-local modules.
- `apps/desktop/package.json`
  - Remove `@repo/app-trpc`.
  - Add direct dependencies used by local desktop tRPC modules: `@trpc/client` and `@trpc/tanstack-react-query`.
- `apps/desktop/vite.renderer.config.ts`
  - Remove `@repo/app-trpc/desktop` and `@repo/app-trpc/react` from `optimizeDeps.include`.
  - Keep direct runtime dependencies such as `superjson` and `sonner` if still needed.
- `apps/desktop/src/renderer/src/react/**`
  - Replace desktop imports from `@repo/app-trpc/desktop` and `@repo/app-trpc/react` with renderer-local imports.
- `pnpm-lock.yaml`
  - Let `pnpm install --lockfile-only` or `pnpm install` update workspace dependency edges.

### Delete

- `packages/app-trpc/src/client.ts`
- `packages/app-trpc/src/desktop.tsx`
- `packages/app-trpc/src/react.tsx`
- `packages/app-trpc/src/server.tsx`
- `packages/app-trpc/src/types.ts`
- `packages/app-trpc/package.json`
- `packages/app-trpc/tsconfig.json`
- `packages/app-trpc/turbo.json`

---

## Task 1: Move App-Owned tRPC Modules Into `apps/app`

**Files:**
- Create: `apps/app/src/trpc/query-client.ts`
- Create: `apps/app/src/trpc/react-query-meta.ts`
- Create: `apps/app/src/trpc/react.tsx`
- Create: `apps/app/src/trpc/server.tsx`
- Modify: `apps/app/package.json`
- Modify: `apps/app/next.config.ts`
- Modify: `apps/app/vitest.config.ts`

- [ ] **Step 1: Create app query client module**

Create `apps/app/src/trpc/query-client.ts` with the same behavior currently in `packages/app-trpc/src/client.ts`.

```ts
import {
  defaultShouldDehydrateQuery,
  type MutationCache,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = (opts?: { mutationCache?: MutationCache }) =>
  new QueryClient({
    mutationCache: opts?.mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        shouldRedactErrors: () => false,
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
```

- [ ] **Step 2: Create app React Query metadata augmentation**

Create `apps/app/src/trpc/react-query-meta.ts`.

```ts
export {};

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      errorTitle?: string;
      suppressErrorToast?: boolean;
    };
  }
}
```

- [ ] **Step 3: Create app client-side tRPC provider**

Create `apps/app/src/trpc/react.tsx` by moving the web-relevant provider behavior from `packages/app-trpc/src/react.tsx`.

```tsx
"use client";

import type { AppRouter } from "@api/app";
import type { QueryClient } from "@tanstack/react-query";
import { MutationCache, QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
  TRPCClientError,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { toast } from "sonner";
import SuperJSON from "superjson";

import { createQueryClient } from "./query-client";
import "./react-query-meta";

const trpcContext = createTRPCContext<AppRouter>();

export const useTRPC = trpcContext.useTRPC;
export const TRPCProvider = trpcContext.TRPCProvider;

const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    if (mutation.options.meta?.suppressErrorToast) {
      return;
    }

    const title = mutation.options.meta?.errorTitle ?? "Something went wrong";

    let message = "An unexpected error occurred. Please try again.";
    if (
      error instanceof TRPCClientError &&
      error.data?.httpStatus != null &&
      error.data.httpStatus < 500
    ) {
      message = error.message;
    }

    toast.error(title, { description: message });
  },
});

let clientQueryClientSingleton: QueryClient | undefined;

function getBrowserQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient();
  }

  return (clientQueryClientSingleton ??= createQueryClient({ mutationCache }));
}

function defaultGetBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? 4104}`;
}

export function TRPCReactProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getBrowserQueryClient();

  const [trpcClient] = useState(() => {
    const baseUrl = defaultGetBaseUrl();

    return createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `${baseUrl}/api/trpc`,
          headers: () => ({
            "x-trpc-source": "client",
          }),
          fetch(url, init) {
            const sameOrigin =
              typeof window !== "undefined" &&
              new URL(url.toString(), window.location.origin).origin ===
                window.location.origin;
            return fetch(url, {
              ...init,
              credentials: sameOrigin ? "include" : "omit",
            } as RequestInit);
          },
        }),
      ],
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Create app RSC tRPC module**

Create `apps/app/src/trpc/server.tsx` by moving `packages/app-trpc/src/server.tsx` and updating the query client import.

```tsx
import type { AppRouter } from "@api/app";
import { appRouter, createTRPCContext } from "@api/app";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type {
  TRPCInfiniteQueryOptions,
  TRPCOptionsProxy,
  TRPCQueryOptions,
} from "@trpc/tanstack-react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";

import { createQueryClient } from "./query-client";

const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({ headers: heads });
});

export const getQueryClient = cache(createQueryClient);

export const trpc: TRPCOptionsProxy<AppRouter> = createTRPCOptionsProxy({
  router: appRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

export function prefetch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryOptions:
    | ReturnType<TRPCQueryOptions<any>>
    | ReturnType<TRPCInfiniteQueryOptions<any>>
) {
  const queryClient = getQueryClient();
  if (
    (queryOptions.queryKey[1] as { type?: string } | undefined)?.type ===
    "infinite"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    void queryClient.prefetchQuery(queryOptions as any);
  }
}
```

- [ ] **Step 5: Update app package dependencies**

Modify `apps/app/package.json`.

Remove:

```json
"@repo/app-trpc": "workspace:*"
```

Add dependencies if they are not already present:

```json
"@trpc/tanstack-react-query": "catalog:",
"sonner": "^2.0.6",
"superjson": "catalog:"
```

- [ ] **Step 6: Remove app config references to `@repo/app-trpc`**

Modify `apps/app/next.config.ts`.

Remove `@repo/app-trpc` from:

```ts
transpilePackages: [
  "@repo/app-trpc",
]
```

and:

```ts
experimental: {
  optimizePackageImports: [
    "@repo/app-trpc",
  ],
}
```

Modify `apps/app/vitest.config.ts`.

Change:

```ts
inline: ["@repo/ui", "@repo/app-trpc", "@repo/app-validation"],
```

to:

```ts
inline: ["@repo/ui", "@repo/app-validation"],
```

- [ ] **Step 7: Run app typecheck to expose import migration failures**

Run:

```bash
pnpm --filter @lightfast/app typecheck
```

Expected: FAIL with unresolved `@repo/app-trpc/*` imports. This verifies the app-local modules compile far enough for migration errors to be actionable.

---

## Task 2: Migrate `apps/app` Imports And Tests

**Files:**
- Modify: `apps/app/src/app/(app)/layout.tsx`
- Modify: `apps/app/src/components/shell-data-boundary.tsx`
- Modify: all `apps/app/src/app/**` files importing `@repo/app-trpc/server`
- Modify: all `apps/app/src/app/**` and `apps/app/src/components/**` files importing `@repo/app-trpc/react`
- Modify: all `apps/app/src/__tests__/**` files mocking `@repo/app-trpc/server` or `@repo/app-trpc/react`

- [ ] **Step 1: Replace app server imports**

Find:

```bash
rg '"@repo/app-trpc/server"' apps/app/src
```

Replace each import like:

```ts
import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
```

with:

```ts
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
```

For imports that only use part of the API, preserve the imported names:

```ts
import { getQueryClient, trpc } from "~/trpc/server";
```

- [ ] **Step 2: Replace app React imports**

Find:

```bash
rg '"@repo/app-trpc/react"' apps/app/src
```

Replace imports like:

```ts
import { useTRPC } from "@repo/app-trpc/react";
```

with:

```ts
import { useTRPC } from "~/trpc/react";
```

Replace provider imports like:

```ts
import { TRPCReactProvider } from "@repo/app-trpc/react";
```

with:

```ts
import { TRPCReactProvider } from "~/trpc/react";
```

- [ ] **Step 3: Replace app test mocks**

Find:

```bash
rg '@repo/app-trpc' apps/app/src/__tests__
```

Replace mocks like:

```ts
vi.mock("@repo/app-trpc/server", () => ({
  HydrateClient: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  prefetch: vi.fn(),
  trpc: {},
}));
```

with:

```ts
vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  prefetch: vi.fn(),
  trpc: {},
}));
```

Replace React provider mocks like:

```ts
vi.mock("@repo/app-trpc/react", () => ({
  TRPCReactProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  useTRPC: vi.fn(),
}));
```

with:

```ts
vi.mock("~/trpc/react", () => ({
  TRPCReactProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  useTRPC: vi.fn(),
}));
```

- [ ] **Step 4: Verify no app imports remain**

Run:

```bash
rg '@repo/app-trpc' apps/app
```

Expected: no output.

- [ ] **Step 5: Run app checks**

Run:

```bash
pnpm --filter @lightfast/app typecheck
pnpm --filter @lightfast/app test
```

Expected: both commands pass.

---

## Task 3: Move Desktop-Owned tRPC Modules Into `apps/desktop`

**Files:**
- Create: `apps/desktop/src/renderer/src/react/trpc/query-client.ts`
- Create: `apps/desktop/src/renderer/src/react/trpc/react-query-meta.ts`
- Create: `apps/desktop/src/renderer/src/react/trpc/react.tsx`
- Create: `apps/desktop/src/renderer/src/react/trpc/provider.tsx`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/vite.renderer.config.ts`

- [ ] **Step 1: Create desktop query client module**

Create `apps/desktop/src/renderer/src/react/trpc/query-client.ts`. Start with the same behavior as app, but keep it desktop-owned so later desktop caching changes do not require shared-package edits.

```ts
import {
  defaultShouldDehydrateQuery,
  type MutationCache,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = (opts?: { mutationCache?: MutationCache }) =>
  new QueryClient({
    mutationCache: opts?.mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        shouldRedactErrors: () => false,
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
```

- [ ] **Step 2: Create desktop React Query metadata augmentation**

Create `apps/desktop/src/renderer/src/react/trpc/react-query-meta.ts`.

```ts
export {};

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      errorTitle?: string;
      suppressErrorToast?: boolean;
    };
  }
}
```

- [ ] **Step 3: Create desktop tRPC React provider**

Create `apps/desktop/src/renderer/src/react/trpc/react.tsx`.

```tsx
import type { AppRouter } from "@api/app";
import type { QueryClient } from "@tanstack/react-query";
import { MutationCache, QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
  TRPCClientError,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { toast } from "sonner";
import SuperJSON from "superjson";

import { createQueryClient } from "./query-client";
import "./react-query-meta";

export interface DesktopTRPCProviderOptions {
  baseUrl: string;
  getAuthHeaders?: () =>
    | Record<string, string | undefined>
    | Promise<Record<string, string | undefined>>;
}

const trpcContext = createTRPCContext<AppRouter>();

export const useTRPC = trpcContext.useTRPC;
export const TRPCProvider = trpcContext.TRPCProvider;

const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    if (mutation.options.meta?.suppressErrorToast) {
      return;
    }

    const title = mutation.options.meta?.errorTitle ?? "Something went wrong";

    let message = "An unexpected error occurred. Please try again.";
    if (
      error instanceof TRPCClientError &&
      error.data?.httpStatus != null &&
      error.data.httpStatus < 500
    ) {
      message = error.message;
    }

    toast.error(title, { description: message });
  },
});

let clientQueryClientSingleton: QueryClient | undefined;

function getQueryClient() {
  return (clientQueryClientSingleton ??= createQueryClient({ mutationCache }));
}

function compactHeaders(headers: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(headers).filter((entry): entry is [string, string] => {
      const [, value] = entry;
      return value !== undefined;
    })
  );
}

export function DesktopTRPCReactProvider({
  children,
  options,
}: {
  children: React.ReactNode;
  options: DesktopTRPCProviderOptions;
}) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            import.meta.env.DEV ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `${options.baseUrl.replace(/\/$/, "")}/api/trpc`,
          headers: async () =>
            compactHeaders({
              "x-trpc-source": "desktop",
              "x-lightfast-desktop": "1",
              ...((await options.getAuthHeaders?.()) ?? {}),
            }),
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Create desktop bridge provider**

Create `apps/desktop/src/renderer/src/react/trpc/provider.tsx`.

```tsx
import type { ReactNode } from "react";

import { DesktopTRPCReactProvider } from "./react";

interface DesktopBridgeAuth {
  getRequestHeaders?: () =>
    | Promise<Record<string, string | undefined>>
    | Record<string, string | undefined>;
}

interface DesktopTRPCProviderProps {
  baseUrl: string;
  children: ReactNode;
}

export function DesktopTRPCProvider({
  children,
  baseUrl,
}: DesktopTRPCProviderProps) {
  return (
    <DesktopTRPCReactProvider
      options={{
        baseUrl,
        getAuthHeaders: async () => {
          const bridge = (
            window as unknown as {
              lightfastBridge?: { auth?: DesktopBridgeAuth };
            }
          ).lightfastBridge;
          return (await bridge?.auth?.getRequestHeaders?.()) ?? {};
        },
      }}
    >
      {children}
    </DesktopTRPCReactProvider>
  );
}
```

- [ ] **Step 5: Update desktop dependencies**

Modify `apps/desktop/package.json`.

Remove:

```json
"@repo/app-trpc": "workspace:*"
```

Add:

```json
"@trpc/client": "catalog:",
"@trpc/tanstack-react-query": "catalog:"
```

Keep existing direct dependencies:

```json
"@tanstack/react-query": "catalog:",
"sonner": "^2.0.6",
"superjson": "catalog:"
```

- [ ] **Step 6: Update Vite optimizer config**

Modify `apps/desktop/vite.renderer.config.ts`.

Change:

```ts
optimizeDeps: {
  include: [
    "@repo/app-trpc/desktop",
    "@repo/app-trpc/react",
    "@radix-ui/react-dropdown-menu",
    "lucide-react",
    "superjson",
    "sonner",
  ],
},
```

to:

```ts
optimizeDeps: {
  include: [
    "@radix-ui/react-dropdown-menu",
    "lucide-react",
    "superjson",
    "sonner",
  ],
},
```

- [ ] **Step 7: Run desktop typecheck to expose import migration failures**

Run:

```bash
pnpm --filter @lightfast/desktop typecheck
```

Expected: FAIL with unresolved `@repo/app-trpc/*` imports. This verifies desktop-local modules compile far enough for migration errors to be actionable.

---

## Task 4: Migrate Desktop Imports

**Files:**
- Modify: `apps/desktop/src/renderer/src/react/entry.tsx`
- Modify: `apps/desktop/src/renderer/src/react/account-card.tsx`
- Modify: `apps/desktop/src/renderer/src/react/user-menu.tsx`
- Modify: `apps/desktop/src/renderer/src/react/settings/panes/account.tsx`

- [ ] **Step 1: Replace desktop provider import**

Modify `apps/desktop/src/renderer/src/react/entry.tsx`.

Change:

```ts
import { DesktopTRPCProvider } from "@repo/app-trpc/desktop";
```

to:

```ts
import { DesktopTRPCProvider } from "./trpc/provider";
```

- [ ] **Step 2: Replace desktop `useTRPC` imports beside entry**

Modify files in `apps/desktop/src/renderer/src/react/` such as `account-card.tsx` and `user-menu.tsx`.

Change:

```ts
import { useTRPC } from "@repo/app-trpc/react";
```

to:

```ts
import { useTRPC } from "./trpc/react";
```

- [ ] **Step 3: Replace nested desktop `useTRPC` imports**

Modify `apps/desktop/src/renderer/src/react/settings/panes/account.tsx`.

Change:

```ts
import { useTRPC } from "@repo/app-trpc/react";
```

to:

```ts
import { useTRPC } from "../../trpc/react";
```

- [ ] **Step 4: Verify no desktop imports remain**

Run:

```bash
rg '@repo/app-trpc' apps/desktop
```

Expected: no output.

- [ ] **Step 5: Run desktop checks**

Run:

```bash
pnpm --filter @lightfast/desktop typecheck
pnpm --filter @lightfast/desktop test
```

Expected: both commands pass.

---

## Task 5: Remove `packages/app-trpc`

**Files:**
- Delete: `packages/app-trpc/src/client.ts`
- Delete: `packages/app-trpc/src/desktop.tsx`
- Delete: `packages/app-trpc/src/react.tsx`
- Delete: `packages/app-trpc/src/server.tsx`
- Delete: `packages/app-trpc/src/types.ts`
- Delete: `packages/app-trpc/package.json`
- Delete: `packages/app-trpc/tsconfig.json`
- Delete: `packages/app-trpc/turbo.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Verify only historical docs mention `@repo/app-trpc`**

Run:

```bash
rg '@repo/app-trpc' --glob '!docs/**' --glob '!thoughts/**'
```

Expected: only `packages/app-trpc/**`, `pnpm-lock.yaml`, or no output. If app or desktop source files remain, return to Task 2 or Task 4.

- [ ] **Step 2: Delete the package files**

Delete:

```text
packages/app-trpc/src/client.ts
packages/app-trpc/src/desktop.tsx
packages/app-trpc/src/react.tsx
packages/app-trpc/src/server.tsx
packages/app-trpc/src/types.ts
packages/app-trpc/package.json
packages/app-trpc/tsconfig.json
packages/app-trpc/turbo.json
```

- [ ] **Step 3: Update lockfile**

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` no longer contains importers for `packages/app-trpc`, `apps/app` no longer depends on `@repo/app-trpc`, and `apps/desktop` no longer depends on `@repo/app-trpc`.

- [ ] **Step 4: Verify workspace no longer resolves `@repo/app-trpc`**

Run:

```bash
pnpm list --depth -1 --filter @repo/app-trpc
```

Expected: command reports no matching project or no listed package.

---

## Task 6: Final Verification

**Files:**
- Verify only, no planned source modifications.

- [ ] **Step 1: Run focused package checks**

Run:

```bash
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
pnpm --filter @lightfast/app test
pnpm --filter @lightfast/desktop typecheck
pnpm --filter @lightfast/desktop test
```

Expected: all commands pass.

- [ ] **Step 2: Run repo-level check**

Run:

```bash
pnpm check
```

Expected: command passes.

- [ ] **Step 3: Verify no runtime package references remain outside historical planning docs**

Run:

```bash
rg '@repo/app-trpc' --glob '!docs/**' --glob '!thoughts/**' --glob '!pnpm-lock.yaml'
```

Expected: no output.

- [ ] **Step 4: Inspect git diff for boundary correctness**

Run:

```bash
git diff --stat
git diff -- apps/app/src/trpc apps/desktop/src/renderer/src/react/trpc apps/app/package.json apps/desktop/package.json apps/app/next.config.ts apps/app/vitest.config.ts apps/desktop/vite.renderer.config.ts
```

Expected:
- `@api/app` still owns router/context/procedure definitions.
- `apps/app` owns all Next/web tRPC integration.
- `apps/desktop` owns all Electron renderer tRPC integration.
- No shared tRPC client/core package remains.

---

## Notes And Risks

- The app and desktop query-client/provider code will initially duplicate behavior. That is intentional because runtime consumers own their configs.
- Do not split `AppRouter` in this refactor. Keep the server route shape in `api/app/src/root.ts` as-is.
- Do not introduce `@repo/app-next-trpc`, `@repo/app-desktop-trpc`, or a replacement shared client package.
- Be careful with `@tanstack/react-query` module augmentation. It must be present in each consumer runtime that uses mutation metadata.
- Desktop currently relied on transitive `@trpc/client` and `@trpc/tanstack-react-query` through `@repo/app-trpc`; after this refactor those must be direct desktop dependencies.
- `apps/app` currently relied on transitive `@trpc/tanstack-react-query`, `superjson`, and `sonner`; after this refactor those must be direct app dependencies.

## Self-Review

- Spec coverage: Covers the agreed ownership split, no shared client core, app-local Next/RSC wiring, desktop-local Electron wiring, import migration, package removal, and verification.
- Placeholder scan: No deferred implementation placeholders.
- Type consistency: The plan consistently uses `AppRouter` from `@api/app`, app imports under `~/trpc/*`, and desktop imports under `./trpc/*` or `../../trpc/*`.
