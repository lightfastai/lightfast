# Project Specification
See @SPEC.md for business goals and product vision.

# Common Commands

## Build, Lint, and Typecheck
```bash
# App-specific build commands (NEVER use pnpm build for all packages)
pnpm build:www      # Build www app only
pnpm build:auth     # Build auth app only
pnpm build:cloud    # Build cloud app only
pnpm build:darkarmy # Build darkarmy app only

# Linting and formatting (global commands)
pnpm lint           # Lint all packages
pnpm lint:fix       # Fix linting issues
pnpm typecheck      # Run TypeScript type checking
pnpm format         # Check formatting
pnpm format:fix     # Fix formatting issues

# Development servers
pnpm dev            # Start development servers
pnpm dev:www        # Start www app only (port 4101)
pnpm dev:darkarmy   # Start darkarmy app (port 4102)

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
# Chat application environment sync (in submodules/chat)
pnpm env:sync:chat              # Sync env vars for chat app from root
pnpm env:sync:chat:auto         # Auto-sync with Vercel pull + Convex sync

# From within submodules/chat directory
cd submodules/chat
pnpm env:sync                   # Manual sync to Convex
pnpm env:sync:auto              # Auto-sync with Vercel pull + Convex sync
pnpm env:check                  # Check Convex environment variables

# Vercel commands (run from submodules/chat)
vercel pull  # Pull env vars from Vercel
vercel env ls                   # List environment variables

# Repository Structure
- **Monorepo**: pnpm workspace with Turbo
- **Apps**:
  - `apps/www` - Marketing site (port 4101)
  - `apps/darkarmy` - Binary matrix display app (port 4102)
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
pnpm dev:darkarmy > /tmp/darkarmy-dev.log 2>&1 &

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
