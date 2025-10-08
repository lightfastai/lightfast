# tRPC Patterns & Best Practices - Deus App

This document outlines the tRPC patterns implemented in the Deus application, following Next.js App Router best practices.

## Architecture Overview

```
packages/deus-trpc/          # Shared tRPC utilities
├── src/
│   ├── client.ts           # QueryClient configuration
│   ├── react.tsx           # Client-side provider & hooks
│   └── server.tsx          # Server-side utilities (RSC)
│
api/deus/                    # Backend API with tRPC routers
├── src/
│   ├── trpc.ts             # tRPC initialization & context
│   ├── root.ts             # Main app router
│   └── router/             # Feature routers
│
apps/deus/                   # Frontend application
├── src/
│   ├── app/                # Next.js App Router pages
│   ├── components/         # React components
│   └── lib/
│       └── trpc-errors.ts  # Error handling utilities
```

## Core Patterns

### 1. Server-Side Prefetching

**When**: In Server Components (pages/layouts) before rendering client components.

**Why**: Eliminates loading states, improves perceived performance, enables instant page loads.

**Example**:

```tsx
// apps/deus/src/app/(app)/org/[orgId]/page.tsx
import { prefetch, trpc } from "@repo/deus-trpc/server";

export default async function OrgHomePage({ params }) {
  const { orgId } = await params;
  const access = await verifyOrgAccess(userId, githubOrgId);

  // Prefetch data in server component
  prefetch(
    trpc.repository.list.queryOptions({
      includeInactive: false,
      organizationId: access.org.id,
    })
  );

  return <OrgChatInterface orgId={githubOrgId} organizationId={access.org.id} />;
}
```

### 2. HydrateClient Boundaries

**When**: Wrap route groups that use tRPC queries.

**Why**: Dehydrates server-fetched data and rehydrates it on the client for instant availability.

**Example**:

```tsx
// apps/deus/src/app/(app)/layout.tsx
import { HydrateClient } from "@repo/deus-trpc/server";

export default async function AppLayout({ children }) {
  const { userId } = await auth();
  const organizations = await findUserOrganizations(userId);

  return (
    <HydrateClient>
      <div className="dark">
        <AuthenticatedHeader organizations={organizations} />
        {children}
      </div>
    </HydrateClient>
  );
}
```

### 3. useSuspenseQuery for Client Components

**When**: In client components where data is prefetched on the server.

**Why**:
- Eliminates manual loading state handling
- Works seamlessly with React Suspense
- Cleaner component code
- Better TypeScript inference (data is never undefined)

**Before**:
```tsx
const { data: repositories = [], isLoading } = useQuery({
  ...trpc.repository.list.queryOptions({ organizationId }),
});

if (isLoading) return <Loader />;
```

**After**:
```tsx
const { data: repositories = [] } = useSuspenseQuery({
  ...trpc.repository.list.queryOptions({ organizationId }),
});
// No loading state needed - handled by Suspense boundary
```

### 4. Suspense Boundaries with Skeletons

**When**: Wrap client components that use `useSuspenseQuery`.

**Why**: Provides loading UI while data is being fetched or streamed.

**Example**:

```tsx
// apps/deus/src/app/(app)/org/[orgId]/settings/repositories/page.tsx
import { Suspense } from "react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default async function RepositoriesPage({ params }) {
  // ... prefetch logic

  return (
    <Suspense fallback={<RepositoriesSettingsSkeleton />}>
      <RepositoriesSettings organizationId={access.org.id} />
    </Suspense>
  );
}

function RepositoriesSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/60 p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
```

### 5. Typed tRPC Mutations (No Manual Fetch)

**When**: Any data mutation (create, update, delete).

**Why**:
- Full type safety from backend to frontend
- Automatic error handling via tRPC error system
- No need to construct URLs or handle response parsing
- Consistent API interface

**Before** (Manual Fetch):
```tsx
const connectMutation = useMutation({
  mutationFn: async (input) => {
    const response = await fetch("/api/trpc/repository.connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: input }),
    });
    if (!response.ok) throw new Error("Failed");
    return response.json();
  },
});
```

**After** (tRPC Mutation):
```tsx
const trpc = useTRPC();
const connectMutation = useMutation(
  trpc.repository.connect.mutationOptions({
    onSuccess: () => { /* ... */ },
    onError: (error) => { /* ... */ },
  })
);
```

### 6. Optimistic Updates with Immer

**When**: Mutations that should feel instant (like connecting a repository).

**Why**:
- Immediate UI feedback
- Better perceived performance
- Automatic rollback on error
- Type-safe cache updates

**Pattern**:

```tsx
import { produce } from "immer";

const connectMutation = useMutation(
  trpc.repository.connect.mutationOptions({
    onMutate: async (variables) => {
      // 1. Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: trpc.repository.list.queryKey({ organizationId }),
      });

      // 2. Snapshot previous value
      const previousRepositories = queryClient.getQueryData(
        trpc.repository.list.queryKey({ organizationId })
      );

      // 3. Optimistically update with immer
      queryClient.setQueryData(
        trpc.repository.list.queryKey({ organizationId }),
        produce(previousRepositories, (draft) => {
          if (draft) {
            draft.unshift({
              id: crypto.randomUUID(),
              githubRepoId: variables.githubRepoId,
              // ... other fields
            });
          }
        })
      );

      return { previousRepositories };
    },
    onError: (error, variables, context) => {
      // 4. Rollback on error
      if (context?.previousRepositories) {
        queryClient.setQueryData(
          trpc.repository.list.queryKey({ organizationId }),
          context.previousRepositories
        );
      }
      toast({ title: "Failed", variant: "destructive" });
    },
    onSuccess: () => {
      toast({ title: "Success" });
    },
    onSettled: () => {
      // 5. Invalidate to ensure consistency
      void queryClient.invalidateQueries({
        queryKey: trpc.repository.list.queryKey({ organizationId }),
      });
    },
  })
);
```

## Error Handling

The app uses a comprehensive error handling system in `src/lib/trpc-errors.ts`:

### Type Guards
```tsx
import { isTRPCClientError, getTRPCErrorCode } from "~/lib/trpc-errors";

if (isTRPCClientError(error)) {
  const code = getTRPCErrorCode(error); // "UNAUTHORIZED" | "NOT_FOUND" | etc.
}
```

### Validation Errors
```tsx
import { getValidationErrors } from "~/lib/trpc-errors";

const validationErrors = getValidationErrors(error);
// Returns: { email: ["Invalid email"], password: ["Too short"] }
```

### Toast Integration
```tsx
import { showTRPCErrorToast } from "~/lib/trpc-errors";

try {
  await mutation.mutateAsync(data);
} catch (error) {
  showTRPCErrorToast(error, "Custom message");
}
```

### React Hook
```tsx
import { useTRPCErrorHandler } from "~/lib/trpc-errors";

function Component() {
  const { handleError, showSuccessToast } = useTRPCErrorHandler();

  const mutation = useMutation({
    onError: handleError,
    onSuccess: () => showSuccessToast("Repository connected!"),
  });
}
```

## Query Configuration

### Client Configuration (`packages/deus-trpc/src/client.ts`)

```tsx
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30s to avoid immediate refetch
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
```

**Key Points**:
- `staleTime: 30s` prevents immediate refetch on client hydration
- SuperJSON handles Date, Map, Set serialization
- Dehydrate pending queries for Suspense support

### Server-Side Context (`packages/deus-trpc/src/server.tsx`)

```tsx
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({ headers: heads });
});
```

**Key Points**:
- Uses React `cache` for request-level memoization
- Sets `x-trpc-source: rsc` header for tracking
- Creates fresh context per request

## Router Patterns

### Protected Procedures (`api/deus/src/trpc.ts`)

```tsx
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: { userId: ctx.session.userId },
    },
  });
});
```

### Query Pattern

```tsx
export const repositoryRouter = {
  list: protectedProcedure
    .input(z.object({
      includeInactive: z.boolean().default(false),
      organizationId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Always validate ownership
      const repositories = await db
        .select()
        .from(DeusConnectedRepository)
        .where(eq(DeusConnectedRepository.organizationId, input.organizationId));

      return repositories;
    }),
} satisfies TRPCRouterRecord;
```

### Mutation Pattern

```tsx
export const repositoryRouter = {
  connect: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      githubRepoId: z.string(),
      // ... other fields
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Validate ownership/access
      const access = await verifyAccess(ctx.session.userId, input.organizationId);
      if (!access) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // 2. Check for duplicates
      const existing = await db.select()...;
      if (existing[0]) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Already connected",
        });
      }

      // 3. Perform mutation
      await db.insert(DeusConnectedRepository).values({...});

      return { success: true, id };
    }),
} satisfies TRPCRouterRecord;
```

## Performance Optimizations

### 1. Batch Requests
The client uses `httpBatchStreamLink` to automatically batch multiple tRPC calls into a single HTTP request.

### 2. Request Deduplication
React Query automatically deduplicates identical queries made within a short timeframe.

### 3. Streaming with Suspense
Using `useSuspenseQuery` allows React to stream components as data becomes available.

### 4. Selective Invalidation
Always invalidate specific query keys rather than all queries:

```tsx
// ✅ Good - specific invalidation
void queryClient.invalidateQueries({
  queryKey: trpc.repository.list.queryKey({ organizationId }),
});

// ❌ Bad - invalidates everything
void queryClient.invalidateQueries();
```

## Common Pitfalls

### 1. Forgetting to Prefetch
```tsx
// ❌ Bad - no prefetch, loading state on every navigation
export default async function Page() {
  return <Component />;
}

// ✅ Good - prefetch in server component
export default async function Page() {
  prefetch(trpc.data.get.queryOptions({ id }));
  return <Component />;
}
```

### 2. Using useQuery Instead of useSuspenseQuery
```tsx
// ❌ Bad - manual loading states when data is prefetched
const { data, isLoading } = useQuery({...});
if (isLoading) return <Loader />;

// ✅ Good - leverages Suspense
const { data } = useSuspenseQuery({...});
```

### 3. Not Using Optimistic Updates
```tsx
// ❌ Bad - slow feedback, poor UX
const mutation = useMutation(trpc.item.delete.mutationOptions({
  onSettled: () => queryClient.invalidateQueries({...}),
}));

// ✅ Good - instant feedback
const mutation = useMutation(trpc.item.delete.mutationOptions({
  onMutate: async (id) => {
    // Optimistically remove from list
    await queryClient.cancelQueries({...});
    const previous = queryClient.getQueryData({...});
    queryClient.setQueryData({...}, produce(previous, draft => {
      const index = draft.findIndex(item => item.id === id);
      if (index > -1) draft.splice(index, 1);
    }));
    return { previous };
  },
  onError: (err, vars, context) => {
    // Rollback on error
    queryClient.setQueryData({...}, context.previous);
  },
}));
```

### 4. Manual Fetch Instead of tRPC
```tsx
// ❌ Bad - loses type safety
const response = await fetch("/api/trpc/...");
const data = await response.json();

// ✅ Good - full type safety
const mutation = useMutation(trpc.item.create.mutationOptions());
await mutation.mutateAsync({ title: "..." });
```

## Testing Patterns

### Mocking tRPC Queries
```tsx
import { QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient();
queryClient.setQueryData(
  ["repository", "list", { organizationId: "123" }],
  mockRepositories
);
```

### Testing Mutations
```tsx
const mockMutate = vi.fn();
vi.mock("@repo/deus-trpc/react", () => ({
  useTRPC: () => ({
    repository: {
      connect: {
        mutationOptions: () => ({ mutationFn: mockMutate }),
      },
    },
  }),
}));
```

## Migration Checklist

When adding a new feature:

- [ ] Define router with proper input validation (Zod)
- [ ] Use `protectedProcedure` for authenticated routes
- [ ] Prefetch data in server components
- [ ] Use `useSuspenseQuery` in client components
- [ ] Add Suspense boundaries with skeleton loaders
- [ ] Use tRPC mutations instead of manual fetch
- [ ] Implement optimistic updates for instant feedback
- [ ] Add proper error handling with toast notifications
- [ ] Test loading states and error scenarios

## Resources

- [tRPC Documentation](https://trpc.io/docs)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Immer Documentation](https://immerjs.github.io/immer/)
