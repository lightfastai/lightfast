# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Project Specification
See @SPEC.md for business goals and product vision.

# Monorepo Overview

Lightfast is a comprehensive pnpm workspace monorepo with Turborepo orchestration containing:

## Applications (6)
- **apps/www** (port 4101) - Marketing website with Next.js 15 + App Router
- **apps/console** (port 4107) - Workflow orchestration platform with tRPC
- **apps/auth** - Centralized Clerk authentication service
- **apps/docs** - Documentation site built with Fumadocs

### Independant Application
- **apps/chat** (port 4106) - Indepdent AI chat demo with Convex real-time backend + tRPC

For the core implementation of Lightfast, we refer to our application with the prefix `console`. Note: apps/chat is independant application and only should be referenced
if the developer request explicity.

## Package Organization (40+ packages)

### Vendor Layer (@vendor/*) - 12 packages
Third-party service abstractions for easy swapping:
- `@vendor/analytics` - PostHog + Vercel Analytics
- `@vendor/clerk` - Authentication (server + client)
- `@vendor/db` - Database layer (Drizzle + PlanetScale)
- `@vendor/email` - Email services with Resend
- `@vendor/inngest` - Background job processing
- `@vendor/next` - Next.js configuration utilities
- `@vendor/observability` - Sentry + BetterStack monitoring
- `@vendor/security` - Arcjet rate limiting and security
- `@vendor/storage` - Vercel Blob file storage
- `@vendor/upstash` - Redis, KV, and QStash
- `@vendor/vercel` - Vercel platform utilities
- `@vendor/zod` - Zod validation extensions

### Shared Packages (@repo/*) - 19+ packages
Shared libraries and utilities:
- `@repo/ui` - 200+ shadcn/ui components with Tailwind CSS v4
- `@repo/lib` - Shared utilities and helper functions
- `@repo/ai` - Vercel AI SDK integrations
- `@repo/ai-tools` - AI browser automation with Browserbase
- `@repo/email` - Email templates and utilities
- `@repo/site-config` - Site configuration utilities
- `@repo/url-utils` - URL manipulation and validation
- `@repo/vercel-config` - Vercel deployment configurations
- `@repo/chat-trpc` - tRPC client utilities for chat app
- `@repo/console-trpc` - tRPC client utilities for console app
- Plus: billing, i18n, markdown, and more

### API Layer (@api/*) - 2 packages
tRPC backend servers:
- `@api/chat` - Chat application tRPC router
- `@api/console` - Console application tRPC router

### Database Layer (@db/*) - 2 packages
Drizzle ORM schemas and migrations:
- `@db/chat` - Chat application database schemas
- `@db/console` - Console application database schemas

### Core Framework (core/*) - 1 package
- `core/lightfast` - AI agent framework and execution engine

### Internal Tooling (@repo/*-config) - 3 packages
- `@repo/eslint-config` - ESLint configurations
- `@repo/prettier-config` - Prettier configurations
- `@repo/typescript-config` - TypeScript configurations

## Key Technologies

**Build System:**
- pnpm 10.5.2 (enforced by packageManager)
- Turborepo 2.5+ with intelligent caching
- Node.js >= 22.0.0 (enforced by engines)

**Frontend:**
- Next.js 15+ with App Router and React 19
- TypeScript 5.9+ with strict type checking
- Tailwind CSS v4 via `@repo/ui`
- tRPC 11+ for type-safe APIs (chat, console apps)

**Backend:**
- Drizzle ORM with PlanetScale (MySQL)
- Convex (chat app real-time backend)
- Upstash Redis for caching and queuing

**AI/ML:**
- Vercel AI SDK 5.0+ (streaming, tool calling)
- Anthropic Claude Sonnet 4 and Haiku
- OpenAI GPT-4o and GPT-4o-mini
- Browserbase (browser automation)
- Exa (AI-powered search)
- BrainTrust (evaluation metrics)

## Dependency Management

**Workspace Protocol:**
Internal packages use `workspace:*`:
```json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@vendor/db": "workspace:*"
  }
}
```

**Catalog Feature:**
Consistent versioning via pnpm catalogs:
```yaml
catalog:
  next: ^15.5.5
  react: 19.1.0
  typescript: ^5.8.2
```

Reference in packages:
```json
{
  "dependencies": {
    "next": "catalog:",
    "react": "catalog:"
  }
}
```

**Adding Dependencies:**
```bash
# Add to specific app/package
pnpm add package-name --filter @lightfast/www

# Run script in specific package
pnpm --filter @lightfast/www run script-name
```

## Common Commands

## Build, Lint, and Typecheck
```bash
# App-specific build commands (NEVER use global pnpm build)
pnpm build:www          # Build www app only
pnpm build:auth         # Build auth app only
pnpm build:console      # Build console app only
pnpm build:docs         # Build docs app only

# Linting and formatting (global commands)
pnpm lint           # Lint all packages with Turbo caching
pnpm lint:fix       # Fix linting issues automatically
pnpm lint:ws        # Check workspace dependencies with Sherif
pnpm typecheck      # Run TypeScript type checking
pnpm format         # Check formatting with Prettier
pnpm format:fix     # Fix formatting issues automatically

# Development servers
pnpm dev            # Start main dev servers (www, docs, auth, chat)
pnpm dev:www        # Start www app only (port 4101)
pnpm dev:search     # Start www-search app only
pnpm dev:auth       # Start auth app only
pnpm dev:chat       # Start chat app only (port 4106)
pnpm dev:console    # Start console app only (port 4107)
pnpm dev:docs       # Start docs app only
pnpm dev:email      # Start email development server

# Other useful commands
pnpm clean          # Clean all build artifacts and caches
pnpm clean:workspaces # Clean Turbo workspaces only
pnpm ui             # Manage shadcn/ui components
pnpm brain          # Run evaluation scripts (BrainTrust)
```

## Database Commands

Note: root folder to run these commands are in `db/console`

```bash
pnpm db:migrate     # Run database migrations
pnpm db:migrate:generate # Generate migration files
pnpm db:studio      # Open database studio
```

## Environment Variable Management

**Environment Files:**
Each app uses typed environment variables via `@t3-oss/env-nextjs` (see each app's `src/env.ts`).

**Development Environment:**
```bash
# Environment files typically stored in:
apps/<app>/.vercel/.env.development.local

```

**Validation:**
- All environment variables are validated at build time via Zod schemas
- Server-only variables are never exposed to the client
- Type-safe access through `~/env` imports

## Repository Structure
- **Monorepo**: pnpm workspace with Turborepo orchestration
- **Apps** (`apps/`): 6 Next.js applications
  - `www` (4101) - Marketing site
  - `chat` (4106) - AI chat with Convex + tRPC
  - `console` (4107) - Workflow orchestration with tRPC
  - `auth` - Authentication service
  - `docs` - Documentation with Fumadocs
- **Packages** (`packages/`): 19+ shared libraries (@repo/*)
- **Vendor** (`vendor/`): 12 third-party abstractions (@vendor/*)
- **API** (`api/`): 2 tRPC backend servers (@api/*)
- **Database** (`db/`): 2 Drizzle schema packages (@db/*)
- **Core** (`core/`): AI agent framework (core/lightfast)
- **Internal** (`internal/`): Dev tooling configs (@repo/*-config)

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

# Architectural Patterns

## Package Dependency Layers

Follow this dependency flow to maintain clean architecture:

```
Applications (@lightfast/*)
    ↓
tRPC API + Database Schemas (@api/*, @db/*)
    ↓
Shared Packages (@repo/*) + Vendor Abstractions (@vendor/*)
    ↓
External Services (Claude, OpenAI, PlanetScale, Clerk, etc.)
```

**Key Rules:**
1. **Never** import vendor packages directly in apps - use `@vendor/*` abstractions
2. **Never** have circular dependencies between layers
3. **Always** use `workspace:*` for internal package dependencies
4. **Always** use catalog versions for shared external dependencies

## Type Safety Chain

The codebase maintains end-to-end type safety:

```
TypeScript → Zod Validation → tRPC → Database Schema Generation → API Response
```

**Pattern:**
1. Define Zod schemas for validation (`*.schema.ts`)
2. Use in tRPC procedures for input validation
3. Generate TypeScript types from Drizzle schemas
4. Infer types from tRPC routers for client-side usage

## Vendor Package Pattern

All third-party integrations are abstracted in `@vendor/*` packages:

**Benefits:**
- Easy to swap providers (e.g., PlanetScale → Neon)
- Consistent API across the monorepo
- Centralized configuration and error handling
- Better testing with mocked vendor packages

**Example:**
```typescript
// ❌ Don't import directly
import { sql } from "@planetscale/database";

// ✅ Use vendor abstraction
import { db } from "@vendor/db/client";
```

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
- **Flat structure**: All components at root level of components directory
- **Prefix grouping**: Related components share common prefix (e.g., `blog-`, `search-`, `early-access-`)
- **Concise naming**: Use generic, descriptive names without vendor/brand prefixes
- **Separation of concerns**: Keep schemas, actions, and hooks as separate files with clear suffixes

#### File Naming Conventions
- **Components**: `feature-name.tsx` (e.g., `search-input.tsx`, `blog-breadcrumbs.tsx`)
- **Schemas**: `feature-name.schema.ts` (e.g., `early-access-form.schema.ts`)
- **Actions**: `feature-actions.ts` (e.g., `early-access-actions.ts`)
- **Hooks**: `use-feature-name.ts` (e.g., `use-early-access-params.ts`)
- **Providers**: `feature-provider.tsx` (e.g., `early-access-form-provider.tsx`)

Example flat structure:
```
components/
├── app-footer.tsx                    # App-wide footer
├── app-navbar.tsx                    # App-wide navbar
├── blog-breadcrumbs.tsx             # Blog breadcrumb navigation
├── blog-category-nav.tsx            # Blog category navigation
├── blog-social-share.tsx            # Blog social sharing
├── early-access-form.tsx            # Early access form component
├── early-access-form.schema.ts      # Form validation schema
├── early-access-actions.ts          # Server actions for form
├── search-input.tsx                 # Search input component
├── search-results.tsx               # Search results display
├── image-viewer.tsx                 # Generic image viewer
├── confetti-wrapper.tsx             # Reusable confetti effect
└── faq-section.tsx                  # FAQ display component
```

#### Component Patterns
- Use `"use client"` directive for client components
- Implement proper loading and error states
- Use React Hook Form for forms with Zod validation
- Implement analytics tracking for user interactions
- Keep component names generic and reusable where possible

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

## Critical Pattern: Prefetch + HydrateClient + useSuspenseQuery

**⚠️ IMPORTANT:** When using `prefetch()` with `useSuspenseQuery`, the order of operations is critical to prevent UNAUTHORIZED errors and unnecessary client-side fetches.

### ❌ Wrong Pattern (causes UNAUTHORIZED)

```typescript
// ❌ Parent Layout - HydrateClient wraps before prefetch
export default async function Layout({ children }) {
  return (
    <HydrateClient>
      {children}  {/* prefetch happens here, AFTER hydration */}
    </HydrateClient>
  );
}

// Child Page - prefetch happens too late
export default async function Page() {
  prefetch(trpc.feature.query.queryOptions({}));
  return <ClientComponent />;
}
```

**Why this fails:**
1. Parent layout's `HydrateClient` dehydrates query client (empty at this point)
2. Child page's `prefetch` executes (adds data to server query client)
3. Data never gets serialized for hydration
4. Client receives empty cache
5. `useSuspenseQuery` makes client-side request
6. Client-side request fails with UNAUTHORIZED (no Clerk session in client context)

### ✅ Correct Pattern

```typescript
// Parent Layout - No HydrateClient
export default async function Layout({ children }) {
  return <div>{children}</div>;
}

// Page Component - prefetch THEN wrap in HydrateClient
export default async function Page() {
  // 1. Prefetch data first
  prefetch(trpc.feature.query.queryOptions({}));

  // 2. THEN wrap in HydrateClient to dehydrate with data
  return (
    <HydrateClient>
      <ClientComponent />
    </HydrateClient>
  );
}

// Client Component - prevent refetch on mount
"use client";
export function ClientComponent() {
  const { data } = useSuspenseQuery({
    ...trpc.feature.query.queryOptions({}),
    refetchOnMount: false,        // Use prefetched server data
    refetchOnWindowFocus: false,  // Don't refetch on window focus
  });
}
```

### Why This Works

1. **Server:** `prefetch()` adds data to query client
2. **Server:** `HydrateClient` dehydrates query client WITH data
3. **Client:** Hydrates query client from serialized state
4. **Client:** `useSuspenseQuery` finds data in cache (no fetch!)
5. **Client:** `refetchOnMount: false` prevents unnecessary refetch

### Key Rules

1. ✅ **Call `prefetch()` BEFORE rendering `HydrateClient`**
2. ✅ **Wrap each page's content in its own `HydrateClient`**
3. ✅ **Always use `refetchOnMount: false` with `useSuspenseQuery`**
4. ✅ **Always use `refetchOnWindowFocus: false` with `useSuspenseQuery`**
5. ❌ **Never put `HydrateClient` in parent layout when children do prefetch**

### Multiple Pages with Prefetch

Each page should follow the same pattern:

```typescript
// pages/page1.tsx
export default async function Page1() {
  prefetch(trpc.feature1.query.queryOptions({}));
  return <HydrateClient><Component1 /></HydrateClient>;
}

// pages/page2.tsx
export default async function Page2() {
  prefetch(trpc.feature2.query.queryOptions({}));
  return <HydrateClient><Component2 /></HydrateClient>;
}
```

This ensures each page's prefetch data is properly dehydrated for hydration.

## Development Server Issues

### Port already in use (4101, 4106, 4107, etc.)
**Cause:** Previous dev server still running
**Solution:**
```bash
# Kill all Next.js dev servers
pkill -f "next dev"

# Or kill specific port
lsof -ti:4101 | xargs kill -9
```

### Changes not reflecting in browser
**Cause:** Turbo watch mode not detecting changes or browser cache
**Solution:**
```bash
# 1. Hard refresh browser (Cmd+Shift+R)

# 2. Restart dev server with cache clear
pnpm clean:workspaces && pnpm dev:www
```

### "Module not found" after adding new package
**Cause:** Package not in dependencies or dev server needs restart
**Solution:**
```bash
# 1. Verify package is in package.json
cat apps/www/package.json | grep "package-name"

# 2. Reinstall and restart
pnpm install
# Kill and restart dev server
```

## tRPC Issues

### UNAUTHORIZED errors on client-side
**Cause:** Wrong prefetch/HydrateClient pattern (see tRPC guide above)
**Solution:** Ensure prefetch runs BEFORE HydrateClient wrapping

### Type errors with tRPC client
**Cause:** API and client using different router types
**Solution:**
```bash
# Rebuild API package
pnpm --filter @api/chat build

# Restart dev server for chat app
pkill -f "next dev" && pnpm dev:chat
```

## Database Issues

### "Cannot connect to database"
**Cause:** Missing or invalid DATABASE_URL
**Solution:**
```bash
# Check environment variable
echo $DATABASE_URL

# Verify .env.development.local exists
cat apps/chat/.vercel/.env.development.local
```

### "Table does not exist"
**Cause:** Migrations not run
**Solution:**
```bash
pnpm db:migrate
```

## Environment Variable Issues

### "Invalid environment variables" error
**Cause:** Zod validation failed in env.ts
**Solution:**
```bash
# 1. Check which variables are required
cat apps/www/src/env.ts

# 2. Verify .env.development.local has all required vars
cat apps/www/.vercel/.env.development.local

# 3. Copy from example if needed
cp apps/www/.env.example apps/www/.vercel/.env.development.local
```

### Environment variables not loading
**Cause:** Wrong file location or not using pnpm with-env
**Solution:**
```bash
# Verify env file location matches dual.config.yml
cat dual.config.yml

# Use pnpm with-env for custom env file
pnpm with-env next dev
```

## Workspace Issues

### Sherif warnings after pnpm install
**Cause:** Inconsistent dependencies across workspace
**Solution:**
```bash
# Fix automatically
pnpm lint:ws

# Manually check for duplicates
pnpm list package-name
```

### Turbo not detecting changes
**Cause:** Turbo's file watcher not working or incorrect turbo.json config
**Solution:**
```bash
# 1. Check turbo.json inputs include your files
cat turbo.json

# 2. Use --force to bypass cache
pnpm build:www --force

# 3. Clear cache and rebuild
pnpm clean:workspaces && pnpm build:www
```

## Performance Issues

### Slow builds
**Cause:** No Turbo cache or too many packages building
**Solution:**
```bash
# 1. Use app-specific builds (NOT pnpm build)
pnpm build:www  # Only builds www and dependencies

# 2. Enable remote caching
pnpm vercel:link

# 3. Check for unnecessary rebuilds
turbo run build --dry-run
```

### Slow type checking
**Cause:** TypeScript checking all node_modules
**Solution:**
```bash
# Use per-app typecheck instead of global
pnpm --filter @lightfast/www typecheck
```

## Quick Diagnostics

Run these commands to diagnose issues:

```bash
# Check workspace health
pnpm lint:ws

# Verify all packages install correctly
pnpm install --force

# Check for outdated packages
pnpm outdated

# Verify Node.js and pnpm versions
node --version  # Should be >= 22.0.0
pnpm --version  # Should be 10.5.2

# Check Turbo cache
turbo daemon status

# View Turbo logs
cat .turbo/turbo-*.log
```

# For Inngest & Upstash Workflow

  1. Use npx with @latest for both CLI tools to avoid local package
   corruption
  2. Turbo persistent tasks properly handle long-running dev
  servers
  3. No local dependencies needed - npx downloads and caches
  automatically
  4. Clear npx cache (rm -rf ~/.npm/_npx) if you encounter issues

  Next Steps:

