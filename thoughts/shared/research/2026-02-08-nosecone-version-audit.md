---
date: 2026-02-08T16:48:19+0000
researcher: jeevan
git_commit: 7a914dbdd8c448787d7ceca59557b04c6e40f7b3
branch: main
repository: lightfast
topic: "Nosecone Package Version Audit - Find All Versions and Document pnpm Workspace Strategy"
tags: [research, codebase, dependencies, nosecone, security, pnpm-workspace]
status: complete
last_updated: 2026-02-08
last_updated_by: jeevan
---

# Research: Nosecone Package Version Audit

**Date**: 2026-02-08T16:48:19+0000
**Researcher**: jeevan
**Git Commit**: 7a914dbdd8c448787d7ceca59557b04c6e40f7b3
**Branch**: main
**Repository**: lightfast

## Research Question

Find all versions of nosecone packages across the monorepo and document how they should be maintained in `pnpm-workspace.yaml` to ensure version consistency.

## Summary

The codebase currently uses **two nosecone packages** (`nosecone` and `@nosecone/next`) across **two locations** (`apps/console` and `vendor/security`). There are **version inconsistencies** that need to be addressed:

**Current State:**
- `apps/console/package.json`: `@nosecone/next@1.1.0` (dependencies), `nosecone@1.0.0-beta.15` (devDependencies)
- `vendor/security/package.json`: `@nosecone/next@1.0.0-beta.15` (dependencies), `nosecone@1.0.0-beta.15` (devDependencies)

**Latest Available Versions:**
- `nosecone@1.1.0` (stable release)
- `@nosecone/next@1.1.0` (stable release)

**Usage Pattern:**
- `nosecone` provides **type definitions only** (`Source`, CSP types) - used in devDependencies
- `@nosecone/next` provides **runtime middleware** and default configurations - used in dependencies
- `@vendor/security` is the abstraction layer that re-exports nosecone functionality
- Apps (`console`, `www`, `auth`) consume nosecone **indirectly** through `@vendor/security`

**Recommendation for pnpm-workspace.yaml:**
Nosecone packages should be added to the `catalog:` section to enforce version consistency across the monorepo, since they are foundational security packages used by multiple apps.

## Detailed Findings

### Package Locations and Versions

#### 1. apps/console/package.json

**File**: `apps/console/package.json:31,107`

```json
{
  "dependencies": {
    "@nosecone/next": "1.1.0"
  },
  "devDependencies": {
    "nosecone": "1.0.0-beta.15"
  }
}
```

**Status**: Inconsistent - runtime package upgraded to `1.1.0` but types package still on beta version

#### 2. vendor/security/package.json

**File**: `vendor/security/package.json:33-34,41-42`

```json
{
  "dependencies": {
    "@nosecone/next": "1.0.0-beta.15"
  },
  "devDependencies": {
    "nosecone": "1.0.0-beta.15"
  }
}
```

**Status**: Both packages on beta version, needs upgrade to stable `1.1.0`

### Available NPM Versions

**nosecone package:**
```
1.0.0-beta.15
1.0.0-beta.16
1.0.0-beta.17
1.0.0-beta.18
1.0.0           ← First stable release
1.1.0-rc        ← Release candidate
1.1.0           ← Latest stable
```

**@nosecone/next package:**
```
1.0.0-beta.15
1.0.0-beta.16
1.0.0-beta.17
1.0.0-beta.18
1.0.0           ← First stable release
1.1.0-rc        ← Release candidate
1.1.0           ← Latest stable
```

Both packages are synchronized in their versioning strategy and have stable `1.1.0` releases available.

### Usage Architecture

#### @vendor/security Package Structure

The `@vendor/security` package serves as the **abstraction layer** for nosecone across the monorepo. It provides:

1. **CSP Directive Composition** (`vendor/security/src/csp/compose.ts`)
   - `composeCspOptions()` - Merges multiple CSP configurations
   - Uses `@nosecone/next` `Options` type and `defaults` export
   - Implements selective merge strategy (replace scriptSrc/styleSrc, merge others)

2. **Service-Specific CSP Configurations** (`vendor/security/src/csp/*.ts`)
   - `createClerkCspDirectives()` - Clerk authentication CSP rules
   - `createNextjsCspDirectives()` - Next.js runtime CSP rules
   - `createAnalyticsCspDirectives()` - Vercel Analytics + PostHog CSP rules
   - `createKnockCspDirectives()` - Knock notifications CSP rules
   - `createSentryCspDirectives()` - Sentry monitoring CSP rules
   - All return `PartialCspDirectives` using `Source` type from `nosecone`

3. **Middleware Re-exports** (`vendor/security/src/middleware.ts`)
   - Re-exports `createMiddleware` from `@nosecone/next` as `securityMiddleware`
   - Provides default `noseconeOptions` configuration

4. **Type Definitions** (`vendor/security/src/csp/types.ts`)
   - `CspDirective` - Alias for `Source[]` from `nosecone`
   - `CspDirectives` - Interface for all CSP directive types
   - `PartialCspDirectives` - Partial configuration for composition

#### Application Usage

**apps/console** (`apps/console/src/middleware.ts:2-25`)
```typescript
import {
  composeCspOptions,
  createClerkCspDirectives,
  createAnalyticsCspDirectives,
  createKnockCspDirectives,
  createSentryCspDirectives,
  createNextjsCspDirectives,
} from "@vendor/security/csp";
import { securityMiddleware } from "@vendor/security/middleware";

const securityHeaders = securityMiddleware(
  composeCspOptions(
    createNextjsCspDirectives(),
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createKnockCspDirectives(),
    createSentryCspDirectives(),
  ),
);
```

**apps/www** (`apps/www/src/middleware.ts:1-24`)
```typescript
// Same pattern, but excludes Knock (not used in marketing site)
const securityHeaders = securityMiddleware(
  composeCspOptions(
    createNextjsCspDirectives(),
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createSentryCspDirectives(),
  ),
);
```

**apps/auth** (`apps/auth/src/middleware.ts:2-26`)
```typescript
// Same pattern, excludes Knock (not used in auth flows)
const securityHeaders = securityMiddleware(
  composeCspOptions(
    createNextjsCspDirectives(),
    createClerkCspDirectives(),
    createAnalyticsCspDirectives(),
    createSentryCspDirectives(),
  ),
);
```

### Package Roles

#### nosecone (devDependency)
- **Purpose**: Type definitions for CSP directives
- **Key Exports**: `Source` type (string | nonce function)
- **Usage**: Type-only imports (`import type { Source } from "nosecone"`)
- **Location**: devDependencies because types are compile-time only

#### @nosecone/next (dependency)
- **Purpose**: Runtime middleware for Next.js security headers
- **Key Exports**:
  - `createMiddleware()` - Generate security header middleware
  - `Options` type - Configuration interface
  - `defaults` - Default security header configuration
- **Usage**: Runtime execution in Next.js middleware
- **Location**: dependencies because it runs in production

### Indirect Consumption Pattern

Apps do **not** directly depend on nosecone packages in their `package.json`. Instead:

1. `@vendor/security` declares the nosecone dependencies
2. Apps depend on `@vendor/security` (workspace protocol)
3. Apps import from `@vendor/security/csp` and `@vendor/security/middleware`
4. pnpm hoists nosecone packages to the root `node_modules/`

This pattern ensures:
- **Single source of truth** for nosecone configuration
- **Version consistency** enforced at the vendor package level
- **Simplified upgrades** (only update `vendor/security/package.json`)

### Current Workspace Configuration

**File**: `pnpm-workspace.yaml`

The nosecone packages are **NOT currently in the catalog section**. This means:
- Each package.json specifies its own version
- Allows version drift (as evidenced by console having `1.1.0` while vendor has `1.0.0-beta.15`)
- No centralized version management

## Code References

- `apps/console/package.json:31` - `@nosecone/next@1.1.0` dependency
- `apps/console/package.json:107` - `nosecone@1.0.0-beta.15` devDependency
- `vendor/security/package.json:41` - `@nosecone/next@1.0.0-beta.15` dependency
- `vendor/security/package.json:33` - `nosecone@1.0.0-beta.15` devDependency
- `vendor/security/src/csp/types.ts:1-35` - Type definitions using `nosecone`
- `vendor/security/src/csp/compose.ts:1-173` - CSP composition using `@nosecone/next`
- `vendor/security/src/middleware.ts:1-13` - Middleware re-exports
- `apps/console/src/middleware.ts:2-25` - Console app usage
- `apps/www/src/middleware.ts:1-24` - Marketing site usage
- `apps/auth/src/middleware.ts:2-26` - Auth app usage

## Architecture Documentation

### Vendor Abstraction Pattern

The monorepo follows a **vendor abstraction pattern** for third-party security dependencies:

```
┌─────────────────────────────────────────────────────────────┐
│ Apps (console, www, auth)                                   │
│   - Import from @vendor/security                            │
│   - Compose service-specific CSP configs                    │
│   - Apply via securityMiddleware()                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ @vendor/security (abstraction layer)                        │
│   - Re-exports @nosecone/next middleware                    │
│   - Provides CSP composition utilities                      │
│   - Defines service-specific CSP factories                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ nosecone + @nosecone/next (third-party packages)            │
│   - nosecone: Type definitions (devDep)                     │
│   - @nosecone/next: Runtime middleware (dep)                │
└─────────────────────────────────────────────────────────────┘
```

### CSP Composition Strategy

The codebase uses a **selective merge strategy** inspired by next-forge:

1. **Replace Strategy** (scriptSrc, styleSrc)
   - User config **replaces** nosecone defaults
   - Removes nonce functions in favor of `'unsafe-inline'`
   - Allows Next.js development mode to work

2. **Merge Strategy** (all other directives)
   - User config **extends** nosecone defaults
   - Preserves security headers for fonts, connections, images, etc.
   - Adds service-specific domains (Clerk, PostHog, Sentry, etc.)

### pnpm Workspace Strategy

**Current Reality:**
- No catalog entry for nosecone packages
- Direct version specifications in consuming packages
- Version drift between `apps/console` (1.1.0) and `vendor/security` (beta.15)

**CLAUDE.md Guidance** (`CLAUDE.md:2`):
> **Workspace protocol**: Use `workspace:*` for internal deps, `catalog:` for shared externals

Nosecone qualifies as a "shared external" because:
- Used by foundational `@vendor/security` package
- Consumed (indirectly) by 3+ apps
- Critical security infrastructure
- Should have synchronized versions

## Proposed pnpm-workspace.yaml Configuration

To maintain nosecone versions in the workspace catalog, the following should be added to `pnpm-workspace.yaml`:

```yaml
catalog:
  # Existing entries...
  '@nosecone/next': ^1.1.0
  nosecone: ^1.1.0  # Note: For type definitions only
```

This would enable consuming packages to use:

```json
{
  "dependencies": {
    "@nosecone/next": "catalog:"
  },
  "devDependencies": {
    "nosecone": "catalog:"
  }
}
```

**Benefits:**
- Single source of truth for nosecone versions
- Automatic synchronization across all consuming packages
- Clear upgrade path (change catalog once, all packages update)
- Follows existing monorepo patterns (see `@clerk/*`, `@trpc/*`, `@ai-sdk/*` in catalog)

**Note:** The `^1.1.0` range allows patch updates but prevents major/minor version drift.

## Historical Context (from thoughts/)

No previous research documents found related to nosecone version management or security header configuration.

## Related Research

No related research documents in `thoughts/shared/research/`.

## Open Questions

1. **Migration Strategy**: Should we update `vendor/security` first, then remove direct nosecone deps from `apps/console`?
2. **Testing Impact**: Do the CSP changes between beta.15 and 1.1.0 require regression testing?
3. **Other Apps**: Are there other apps (docs, chat) that need nosecone integration?
4. **Breaking Changes**: What changed between `1.0.0-beta.15` and `1.1.0` that requires validation?
