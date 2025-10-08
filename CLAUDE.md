# Project Specification
See @SPEC.md for business goals and product vision.

# Common Commands

## Build, Lint, and Typecheck
```bash
# App-specific build commands (NEVER use pnpm build for all packages)
pnpm build:www      # Build www app only
pnpm build:auth     # Build auth app only
pnpm build:cloud    # Build cloud app only

# Linting and formatting (global commands)
pnpm lint           # Lint all packages
pnpm lint:fix       # Fix linting issues
pnpm typecheck      # Run TypeScript type checking
pnpm format         # Check formatting
pnpm format:fix     # Fix formatting issues

# Development servers
pnpm dev            # Start development servers
pnpm dev:www        # Start www app only (port 4101)

# Other useful commands
pnpm clean          # Clean all build artifacts
pnpm clean:workspaces # Clean turbo workspaces
```

## Database Commands
```bash
pnpm db:migrate     # Run database migrations
pnpm db:migrate:generate # Generate migration files
pnpm db:studio      # Open database studio
```

## Environment Variable Management
```bash
# Environment variables loaded via `dotenv` in app packages
# Check individual app package.json files for environment-specific commands

# Repository Structure
- **Monorepo**: pnpm workspace with Turbo
- **Apps**:
  - `apps/www` - Marketing site (port 4101)
- **Packages**: Shared libraries in `packages/`
- **Vendor**: Third-party integrations in `vendor/`
- **Internal**: ESLint, Prettier, TypeScript configs in `internal/`

# Code Style
- ESLint configuration extends from `@repo/eslint-config`
- Prettier configuration from `@repo/prettier-config`
- TypeScript configs extend from `@repo/typescript-config`

# Testing Instructions
Check package.json files for test commands - currently no global test command configured.

# Environment Setup
- Node.js >= 20.16.0
- pnpm 10.5.2 (enforced by packageManager)
- Environment variables loaded via `dotenv` in app packages

# Workflows

## Workflow 1: Investigate External Repos
Clone repos to `/tmp/repos/<repo-name>` for safe investigation without affecting the current workspace.

## Workflow 2: Investigate Dependencies  
In pnpm monorepo with `node-linker=hoisted`, all dependencies are hoisted to root `node_modules/` - check there first.

---

# Lightfast Next.js App Development Guide

This guide provides best practices and conventions for developing the Next.js application in `apps/www` based on the patterns established in this codebase.

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript with strict type checking
- **Styling**: Tailwind CSS v4 (via `@repo/ui` workspace)
- **State Management**: Jotai for client-side state
- **Form Handling**: React Hook Form with Zod validation
- **Analytics**: PostHog + Vercel Analytics
- **Error Tracking**: Sentry + BetterStack
- **Authentication**: Clerk
- **Email**: Resend
- **Background Jobs**: Inngest
- **Rate Limiting**: Arcjet (via `@vendor/security`)

### Project Structure

```
apps/www/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (app)/             # Public pages group
│   │   ├── (early-access)/    # API routes for early access
│   │   ├── (health)/          # Health check endpoints
│   │   ├── (inngest)/         # Background job endpoints
│   │   └── layout.tsx         # Root layout
│   ├── components/            # React components
│   ├── config/               # App configuration
│   ├── content/              # Static content
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utility functions
│   ├── provider/             # Context providers
│   └── stores/               # State stores
├── public/                    # Static assets
└── package.json              # Dependencies and scripts
```

## Key Conventions

### 1. Environment Configuration

Use typed environment variables via `@t3-oss/env-nextjs`:

```typescript
// src/env.ts
export const env = createEnv({
  extends: [
    vercel(),
    // Vendor environment schemas
  ],
  server: {
    // Server-only vars
  },
  client: {
    // NEXT_PUBLIC_* vars
  }
});
```

**Best Practice**: Always import from `~/env` to ensure type safety and validation.

### 2. Routing Patterns

#### Route Groups
- `(app)` - Public pages with marketing layout
- `(legal)` - Legal pages with specific layout
- `(early-access)`, `(health)`, `(inngest)` - API route groups

#### API Routes
- Use Edge Runtime for performance: `export const runtime = "edge"`
- Implement comprehensive error handling with typed responses
- Include request ID tracking for debugging

Example API route structure:
```typescript
// Error types and responses
type NextErrorResponse = {
  type: ErrorType;
  error: string;
  message: string;
}

// Request validation
const result = await jsonParseSafe<RequestType>(request);

// Error handling with specific types
if (result.isErr()) {
  return NextResponse.json<NextErrorResponse>(
    { type: ErrorType.BAD_REQUEST, error: "...", message: "..." },
    { status: 400, headers: { [REQUEST_ID_HEADER]: requestId } }
  );
}
```

### 3. Component Architecture

#### Component Organization
- **Feature-based structure**: Group related components together
- **Barrel exports**: Use index files for cleaner imports
- **Separation of concerns**: API logic, UI components, and types in separate files

Example structure:
```
components/early-access/
├── api/                    # API interaction functions
├── hooks/                  # Feature-specific hooks
├── jotai/                  # State atoms and providers
├── early-access-form.tsx   # Main component
├── early-access-form.schema.ts  # Validation schema
└── errors.ts              # Error types and mappings
```

#### Component Patterns
- Use `"use client"` directive for client components
- Implement proper loading and error states
- Use React Hook Form for forms with Zod validation
- Implement analytics tracking for user interactions

### 4. Styling Approach

- **Tailwind CSS v4**: Configured via `@repo/ui` workspace
- **CSS Variables**: For dynamic values and theming
- **Utility-first**: Prefer Tailwind classes over custom CSS
- **Dark mode**: Built-in with `dark` class on body

Example:
```typescript
<div className="bg-background border p-4 dark:border-white/20">
  <p className="text-foreground text-sm">Content</p>
</div>
```

### 5. State Management

#### Client State (Jotai)
```typescript
// Define atoms
export const countAtom = atom(0);

// Use in components
const [count, setCount] = useAtom(countAtom);
```

#### Server State
- Use server components by default
- Implement proper caching strategies
- Use React Suspense for loading states

### 6. Error Handling

#### Comprehensive Error System
```typescript
// Define error types
export enum ErrorType {
  BAD_REQUEST = "BAD_REQUEST",
  RATE_LIMIT = "RATE_LIMIT",
  // ...
}

// Error mapping for user messages
export const ErrorMap: Record<ErrorType, string> = {
  [ErrorType.BAD_REQUEST]: "Invalid request",
  // ...
};

// Use Result pattern with neverthrow
const result = await functionSafe();
result.match(
  (data) => { /* success */ },
  (error) => { /* handle error */ }
);
```

#### Error Reporting
- Client errors: Use `useErrorReporter` hook
- API errors: Use `reportApiError` function
- Include context: component name, error type, request ID

### 7. Data Fetching

#### API Integration
```typescript
// Safe API calls with error handling
export async function createEntrySafe(data: Data): Promise<Result<Success, Error>> {
  try {
    const response = await fetch("/api/endpoint", {
      method: "POST",
      headers: {
        [REQUEST_ID_HEADER]: generateRequestId(),
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return err(error);
    }
    
    return ok(await response.json());
  } catch (error) {
    return err({ type: ErrorType.NETWORK_ERROR, error });
  }
}
```

### 8. Performance Optimization

#### Next.js Configuration
```typescript
// next.config.ts
experimental: {
  optimizeCss: true,
  optimizePackageImports: ["@repo/ui", "jotai", "lucide-react"],
}
```

#### Best Practices
- Use dynamic imports for heavy components
- Implement proper image optimization
- Minimize client-side JavaScript
- Use Edge Runtime for API routes

### 9. Testing & Development

#### Scripts
```bash
pnpm dev        # Start dev server
pnpm build      # Build for production
pnpm lint       # Run ESLint
pnpm typecheck  # Type checking
pnpm format     # Check formatting
```

#### Running Dev Servers in Background
When working with Claude Code, run dev servers in the background to avoid blocking the terminal:

```bash
# Run specific app dev server in background
pnpm dev:www > /tmp/www-dev.log 2>&1 &
pnpm dev:app > /tmp/app-dev.log 2>&1 &
# Check dev server logs
cat /tmp/www-dev.log
tail -f /tmp/app-dev.log  # Follow logs in real-time

# Kill background dev servers
pkill -f "next dev"
pkill -f "turbo watch dev"

# Check running processes
ps aux | grep "pnpm dev"
```

#### Development Workflow
1. Use `pnpm with-env` for environment variables
2. Check types with `tsc --noEmit`
3. Lint with configured ESLint rules
4. Format with Prettier

### 10. Security Best Practices

- **Input validation**: Always validate with Zod schemas
- **Rate limiting**: Use Arcjet for API protection
- **CSRF protection**: Implemented via middleware
- **Request signing**: Use request IDs for tracking
- **Environment variables**: Never expose sensitive data

### 11. Monitoring & Observability

- **Logging**: Use `@vendor/observability/log`
- **Analytics**: Track user events with PostHog
- **Performance**: Monitor with Vercel Analytics
- **Errors**: Report to Sentry in production

### 12. Deployment

- **Platform**: Optimized for Vercel deployment
- **Edge Runtime**: Preferred for API routes
- **Environment**: Validated via `@t3-oss/env-nextjs`
- **Monitoring**: Integrated with Vercel, Sentry, BetterStack

## Common Patterns

### Form Implementation
```typescript
const form = useForm({
  schema: formSchema,
  defaultValues: { email: "" }
});

const onSubmit = async (values: z.infer<typeof formSchema>) => {
  const result = await apiCallSafe(values);
  result.match(
    (data) => toast({ title: "Success!" }),
    (error) => toast({ title: "Error", variant: "destructive" })
  );
};
```

### Protected Routes
Use Clerk's middleware for authentication:
```typescript
// middleware.ts
export default authMiddleware({
  publicRoutes: ["/", "/api/health"],
});
```

### Background Jobs
Use Inngest for async processing:
```typescript
// _workflow/job.ts
export const job = inngest.createFunction(
  { id: "job-id" },
  { event: "job/trigger" },
  async ({ event, step }) => {
    // Job logic
  }
);
```

## Summary

This Next.js app follows modern best practices with:
- Type-safe environment configuration
- Comprehensive error handling
- Performance optimization
- Proper separation of concerns
- Security-first approach
- Full observability stack

When developing, prioritize:
1. Type safety with TypeScript
2. Error handling with Result pattern
3. Performance with Edge Runtime
4. User experience with proper loading states
5. Security with input validation

---

# tRPC Integration Guide

This guide covers tRPC patterns and best practices used across applications in the monorepo (e.g., `apps/chat`, `apps/deus`).

## Architecture Overview

### Package Structure

```
api/
├── <app>/             # API backend with tRPC routers
│   ├── src/
│   │   ├── trpc.ts           # tRPC initialization & context
│   │   ├── root.ts           # Main app router
│   │   └── router/           # Feature routers
│   └── package.json

packages/
├── <app>-trpc/        # Shared tRPC client utilities (if app-specific)
│   ├── src/
│   │   ├── client.ts         # Query client config
│   │   ├── react.tsx         # Client-side provider & hooks
│   │   └── server.tsx        # Server-side utilities (RSC)
│   └── package.json

apps/
├── <app>/             # Frontend using tRPC
│   ├── src/
│   │   ├── hooks/            # Custom tRPC hooks
│   │   └── lib/
│   │       └── trpc-errors.ts  # Error handling utilities
│   └── package.json
```

## Server-Side Patterns

### 1. tRPC Initialization (api/*/src/trpc.ts)

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@vendor/clerk/server";
import { db } from "@db/<app>/client";

/**
 * Context creation - available in all procedures
 */
export const createTRPCContext = async (opts: {
  headers: Headers;
}) => {
  const clerkSession = await auth();

  const session = {
    userId: clerkSession?.userId ?? null,
  };

  return {
    session,
    db,  // Database client
  };
};

/**
 * Initialize tRPC with SuperJSON transformer and Zod error formatting
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError:
        error.cause instanceof ZodError
          ? error.cause.flatten()
          : null,
    },
  }),
});

/**
 * Procedure types
 */
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;    // Unauthenticated
export const protectedProcedure = t.procedure  // Authenticated
  .use(({ ctx, next }) => {
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

**Key Features:**
- SuperJSON transformer for Date/Map/Set serialization
- Zod error formatting for validation errors
- Session-based authentication middleware
- Type-safe context with authenticated vs public procedures

### 2. Router Definition (api/*/src/root.ts)

```typescript
import { createTRPCRouter } from "./trpc";
import { featureARouter } from "./router/feature-a";
import { featureBRouter } from "./router/feature-b";

/**
 * Main app router - flat structure for easier access
 */
export const appRouter = createTRPCRouter({
  featureA: featureARouter,
  featureB: featureBRouter,
  // ... more routers
});

export type AppRouter = typeof appRouter;
```

**Pattern:**
- Flat router structure (not nested) for simpler client access
- Export router type for client-side usage
- Feature-based router organization

### 3. Feature Router Patterns (api/*/src/router/feature.ts)

#### Query Example

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { z } from "zod";

export const featureRouter = {
  /**
   * List items with cursor pagination
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db
        .select()
        .from(Table)
        .where(eq(Table.userId, ctx.session.userId))
        .limit(input.limit);

      return items;
    }),
} satisfies TRPCRouterRecord;
```

#### Mutation Example

```typescript
export const featureRouter = {
  /**
   * Create or update item
   */
  upsert: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Verify ownership
      const item = await ctx.db
        .select({ id: Table.id })
        .from(Table)
        .where(
          and(
            eq(Table.id, input.id),
            eq(Table.userId, ctx.session.userId)
          )
        )
        .limit(1);

      if (!item[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      // 2. Perform mutation
      await ctx.db
        .update(Table)
        .set({ data: input.data })
        .where(eq(Table.id, input.id));

      return { success: true };
    }),
} satisfies TRPCRouterRecord;
```

**Best Practices:**
- Always validate ownership before mutations
- Use Zod for input validation
- Throw descriptive TRPCError with appropriate codes
- Return success indicators or data objects
- Use `satisfies TRPCRouterRecord` for type safety

### 4. Next.js API Route Handler (apps/*/src/app/(trpc)/api/trpc/[trpc]/route.ts)

```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@api/<app>";

export const runtime = "edge";

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () =>
      createTRPCContext({
        headers: req.headers,
      }),
    onError({ error, path }) {
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
  });

  return response;
};

export { handler as GET, handler as POST };
```

## Client-Side Patterns

### 1. tRPC Package Setup (packages/*-trpc/src)

#### Query Client (client.ts)

```typescript
import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,  // 30s to avoid immediate refetch
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

#### React Provider (react.tsx)

```typescript
"use client";

import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@api/<app>";

const trpcContext = createTRPCContext<AppRouter>();

export const useTRPC = trpcContext.useTRPC;
export const TRPCProvider = trpcContext.TRPCProvider;

export function TRPCReactProvider({ children }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: `/api/trpc`,
          headers: () => ({ "x-trpc-source": "client" }),
          fetch(url, init) {
            return fetch(url, { ...init, credentials: "include" });
          },
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

#### Server Utilities (server.tsx)

```typescript
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { appRouter, createTRPCContext } from "@api/<app>";

export const trpc = createTRPCOptionsProxy<AppRouter>({
  router: appRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});

export function prefetch(queryOptions) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    void queryClient.prefetchInfiniteQuery(queryOptions);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}

export function HydrateClient({ children }) {
  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      {children}
    </HydrationBoundary>
  );
}
```

### 2. Server Component Usage

```typescript
import { trpc, HydrateClient, prefetch } from "@repo/<app>-trpc/server";
import { TRPCReactProvider } from "@repo/<app>-trpc/react";

export default async function Layout({ children }) {
  // Prefetch critical data in RSC
  prefetch(trpc.feature.query.queryOptions({ param }));

  return (
    <TRPCReactProvider>
      <HydrateClient>
        {children}
      </HydrateClient>
    </TRPCReactProvider>
  );
}
```

### 3. Query Hooks

```typescript
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/<app>-trpc/react";

export function useFeatureQuery({ id, enabled = true }) {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.feature.get.queryOptions({ id }),
    enabled: Boolean(id) && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
```

### 4. Mutation Hooks with Optimistic Updates

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";
import { useTRPC } from "@repo/<app>-trpc/react";

export function useFeatureMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.feature.update.mutationOptions({
      onMutate: async (variables) => {
        // 1. Cancel outgoing queries
        await queryClient.cancelQueries({
          queryKey: trpc.feature.list.queryOptions().queryKey,
        });

        // 2. Snapshot previous data
        const previous = queryClient.getQueryData(
          trpc.feature.list.queryOptions().queryKey
        );

        // 3. Optimistically update
        queryClient.setQueryData(
          trpc.feature.list.queryOptions().queryKey,
          produce(previous, (draft) => {
            // Update draft
          })
        );

        return { previous };
      },

      onError: (err, vars, context) => {
        // 4. Rollback on error
        if (context?.previous) {
          queryClient.setQueryData(
            trpc.feature.list.queryOptions().queryKey,
            context.previous
          );
        }
      },

      onSettled: () => {
        // 5. Invalidate to ensure consistency
        void queryClient.invalidateQueries({
          queryKey: trpc.feature.list.queryOptions().queryKey,
        });
      },
    })
  );
}
```

**Optimistic Update Pattern:**
1. Cancel in-flight queries
2. Snapshot current data in `onMutate`
3. Optimistically update with `setQueryData` + `produce` (immer)
4. Rollback in `onError` using snapshot
5. Invalidate in `onSettled` for consistency

### 5. Error Handling Utilities (apps/*/src/lib/trpc-errors.ts)

```typescript
import type { TRPCClientError } from "@trpc/client";
import type { AppRouter } from "@api/<app>";

export function isTRPCClientError(
  error: unknown
): error is TRPCClientError<AppRouter> {
  return error instanceof Error && error.name === "TRPCClientError";
}

export function getTRPCErrorCode(error: unknown) {
  if (!isTRPCClientError(error)) return null;
  return error.data?.code as string | null;
}

export function getValidationErrors(error: unknown) {
  if (!isTRPCClientError(error)) return null;
  const code = getTRPCErrorCode(error);
  if (code !== "BAD_REQUEST") return null;

  if (error.data && "zodError" in error.data) {
    const zodError = error.data.zodError;
    if (zodError && 'fieldErrors' in zodError) {
      return zodError.fieldErrors as Record<string, string[]>;
    }
  }
  return null;
}

export function showTRPCErrorToast(error: unknown, customMessage?: string) {
  const code = getTRPCErrorCode(error);
  // Show appropriate toast based on error code
  toast.error(customMessage ?? "An error occurred");
}
```

## Common Patterns Summary

### Query Pattern
```typescript
const trpc = useTRPC();
return useQuery({
  ...trpc.feature.query.queryOptions({ param }),
  enabled: Boolean(param),
  staleTime: 1000 * 60 * 5,
});
```

### Mutation Pattern
```typescript
const trpc = useTRPC();
return useMutation(
  trpc.feature.mutate.mutationOptions({
    onMutate: async (variables) => { /* optimistic update */ },
    onError: (err, vars, context) => { /* rollback */ },
    onSettled: () => { /* invalidate */ },
  })
);
```

### Server Component Prefetch
```typescript
import { trpc, prefetch } from "@repo/<app>-trpc/server";
prefetch(trpc.feature.query.queryOptions({ param }));
```

### Router Definition
```typescript
export const featureRouter = {
  query: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => { /* ... */ }),

  mutate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),
} satisfies TRPCRouterRecord;
```

## Type Safety

```typescript
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@api/<app>";

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

// Usage
type Item = RouterOutputs["feature"]["list"][number];
type CreateInput = RouterInputs["feature"]["create"];
```

## Best Practices

1. **Always use `queryOptions()`** for consistent query keys
2. **Use `produce` from immer** for optimistic updates
3. **Validate ownership** before mutations in protected procedures
4. **Prefetch critical data** in server components
5. **Set appropriate `staleTime`** per query type
6. **Use `refetchType: "none"`** to avoid triggering Suspense
7. **Handle errors gracefully** with user-friendly messages
8. **Use SuperJSON** for Date/Map/Set serialization
