# Fix Connections Build Errors — Linear Provider Type Safety

## Overview

Fix 2 TypeScript errors in `apps/connections/src/providers/impl/linear.ts` where optional env vars (`LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`) are used where `string` is required.

## Current State Analysis

- `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET` are defined as `z.string().min(1).optional()` in `packages/console-linear/src/env.ts:6-7`, typed as `string | undefined`
- `LinearProvider` is only instantiated when both vars exist (guarded at `apps/connections/src/providers/index.ts:32`)
- But TypeScript can't infer that guarantee inside the class methods, so 2 call sites fail:
  - **Line 28**: `url.searchParams.set("client_id", env.LINEAR_CLIENT_ID)` — `.set()` requires `string`
  - **Lines 44-46**: `new URLSearchParams({ client_id: env.LINEAR_CLIENT_ID, ... })` — requires `Record<string, string>`

### Key Discoveries:
- GitHub/Vercel env vars are required (not optional), so their providers don't have this issue
- Sentry has the same optional pattern but doesn't error because it uses template literals and `JSON.stringify` which accept `undefined`
- The runtime guard in `providers/index.ts:32` makes this safe at runtime, just not at the type level

## What We're NOT Doing

- Not changing the env vars from optional to required (would break other consumers)
- Not fixing Sentry provider (no type errors there, even though same optional pattern)
- Not refactoring the provider architecture

## Implementation Approach

Add a constructor to `LinearProvider` that captures the env vars as required class properties with a runtime assertion. This is the cleanest DRY approach — assert once, use typed properties everywhere.

## Phase 1: Add Constructor with Runtime Assertions

### Overview
Add private class properties and a constructor that narrows the types from `string | undefined` to `string`.

### Changes Required:

#### 1. `apps/connections/src/providers/impl/linear.ts`

Add constructor and private properties after line 24:

```typescript
export class LinearProvider implements ConnectionProvider {
  readonly name = "linear" as const;
  readonly requiresWebhookRegistration = true as const;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor() {
    if (!env.LINEAR_CLIENT_ID || !env.LINEAR_CLIENT_SECRET) {
      throw new Error(
        "LinearProvider requires LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET",
      );
    }
    this.clientId = env.LINEAR_CLIENT_ID;
    this.clientSecret = env.LINEAR_CLIENT_SECRET;
  }
```

Then replace the 3 usages:
- Line 28: `env.LINEAR_CLIENT_ID` → `this.clientId`
- Line 45: `env.LINEAR_CLIENT_ID` → `this.clientId`
- Line 46: `env.LINEAR_CLIENT_SECRET` → `this.clientSecret`

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `cd apps/connections && pnpm typecheck`
- [x] Build succeeds: `pnpm build:connections`
- [x] Tests pass: `cd apps/connections && pnpm test`
- [x] Linting passes: `cd apps/connections && pnpm lint`

#### Manual Verification:
- [ ] N/A — pure type-level fix with no behavioral change

## References

- Error source: `apps/connections/src/providers/impl/linear.ts:28,44`
- Env definition: `packages/console-linear/src/env.ts:6-7`
- Runtime guard: `apps/connections/src/providers/index.ts:32`
