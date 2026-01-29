---
date: 2026-01-29T10:30:00+08:00
researcher: Claude
git_commit: 7f4be19dce56084d0b5d45b7a54ab38680b158e8
branch: main
repository: lightfast
topic: "Next.js Upgrade Strategy for apps/www Only"
tags: [research, nextjs, upgrade, pnpm-catalogs, monorepo]
status: complete
last_updated: 2026-01-29
last_updated_by: Claude
---

# Research: Next.js Upgrade Strategy for apps/www Only

**Date**: 2026-01-29T10:30:00+08:00
**Researcher**: Claude
**Git Commit**: 7f4be19dce56084d0b5d45b7a54ab38680b158e8
**Branch**: main
**Repository**: lightfast

## Research Question
How to upgrade Next.js to the latest version for `apps/www` only while keeping other apps on the current version, using pnpm catalog named versions.

## Summary

The Lightfast monorepo currently uses **Next.js 15.5.7** via the pnpm catalog. The latest stable Next.js version is **16.1.6** (released January 16, 2026). Upgrading only `apps/www` is achievable using pnpm's named catalogs feature, which the codebase already uses for Tailwind and Zod versioning.

**Key findings:**
1. **15 packages** currently use `next: "catalog:"` and would be affected by a global upgrade
2. Named catalogs (like `catalog:next16`) allow per-app version targeting
3. **11 shared packages** used by `apps/www` have Next.js dependencies that need compatibility verification
4. Next.js 16 has significant **breaking changes** around async APIs that require code modifications

## Detailed Findings

### Current State

#### Next.js Version in Monorepo
- **File:** `pnpm-workspace.yaml:24`
- **Current Version:** `next: ^15.5.7`
- **Resolved:** `15.5.7` (in lockfile line 108-110)

#### Apps Using Next.js (all via `catalog:`)
| App | Location | Port |
|-----|----------|------|
| console | `apps/console/package.json:75` | 4107 |
| www | `apps/www/package.json:59` | 4101 |
| auth | `apps/auth/package.json:44` | 4104 |
| docs | `apps/docs/package.json:40` | 4105 |
| chat | `apps/chat/package.json:81` | 4106 |

### Target Version: Next.js 16.1.6

**Release Date:** January 16, 2026 (Next.js 16 major: October 21, 2025)

#### Key New Features
1. **Turbopack Stable & Default** - Rust-based bundler production-ready, 10x faster cold starts
2. **Build Adapters API** - Easier deployment beyond Vercel
3. **React 19 Full Support** - Complete integration with React 19 features
4. **Partial Prerendering (PPR)** - Static shells with dynamic streaming

#### Breaking Changes from 15.x to 16.x

| Change | Impact | Migration Required |
|--------|--------|-------------------|
| **Async Request APIs** | `cookies()`, `headers()`, `draftMode()` must be awaited | Yes - code changes |
| **Async Parameters** | `params` and `searchParams` must be awaited | Yes - code changes |
| **next/image Defaults** | New default behavior | Review required |
| **AMP Support Removed** | Complete removal | N/A (not used) |
| **`next lint` Removed** | Use ESLint directly | Already using ESLint |
| **`devIndicators` Removed** | Config options removed | Review config |
| **Caching Semantics** | `fetch()` not cached by default | Explicit opt-in needed |
| **Turbopack by Default** | Custom webpack configs may fail | Already using Turbopack |

**Critical Code Change Example:**
```javascript
// Before (Next.js 15.x)
const cookieStore = cookies()

// After (Next.js 16.x)
const cookieStore = await cookies()
```

### Implementation Strategy: pnpm Named Catalogs

#### Current Catalog Pattern (already in use)
```yaml
# pnpm-workspace.yaml lines 62-71
catalogs:
  tailwind4:
    tailwindcss: 4.1.11
    postcss: 8.5.6
  zod3:
    zod: ^3.25.76
  zod4:
    zod: ^4.0.0
```

#### Proposed Addition
```yaml
catalogs:
  tailwind4: {...}
  zod3: {...}
  zod4: {...}
  # NEW: Named catalogs for Next.js versioning
  next15:
    next: ^15.5.7
  next16:
    next: ^16.1.6
```

#### Package.json Changes

**apps/www/package.json (upgrade to 16.x):**
```json
{
  "dependencies": {
    "next": "catalog:next16"  // Was: "catalog:"
  }
}
```

**Other apps (stay on 15.x):**
```json
{
  "dependencies": {
    "next": "catalog:next15"  // Was: "catalog:"
  }
}
```

### Shared Package Compatibility Analysis

#### High Impact (Direct Next.js API Usage)

| Package | Next.js APIs Used | Action Required |
|---------|-------------------|-----------------|
| `@vendor/next` | `NextConfig`, Sentry, BetterStack wrappers | **Verify 16.x compatibility** |
| `@repo/url-utils` | `NextRequest`, `NextResponse` from `next/server` | **Verify types** |
| `@repo/console-trpc` | `headers()` from `next/headers` | **Must await in 16.x** |
| `@vendor/analytics` | `usePathname`, `useSearchParams` from `next/navigation` | Likely compatible |
| `@vendor/cms` | `next/image`, `next/link` | Review `next/image` defaults |

#### Medium Impact (Dependency Compatibility)

| Package | Dependency | Action Required |
|---------|------------|-----------------|
| `@vendor/clerk` | `@clerk/nextjs: 6.33.5` | Verify Next.js 16 support |
| `@vendor/seo` | `Metadata` type from `next` | Likely compatible |
| `@vendor/security` | `@arcjet/next`, `@nosecone/next` | Verify compatibility |

#### Low Impact (Minimal/No Direct Usage)

- `@vendor/upstash-workflow` - Has Next.js export but minimal API usage
- `@repo/ui` - Only uses `next-themes` (community package)
- `@vendor/email`, `@vendor/inngest`, `@vendor/observability` - No direct Next.js usage

### Option A: Shared Packages Stay on Peer Dependencies

If shared packages declare `next` as a **peer dependency** instead of direct dependency:

1. Each app provides its own Next.js version
2. pnpm creates separate dependency resolutions:
   ```
   node_modules/.pnpm
   ├── @vendor/next@1.0.0_next@15.5.7   # For console, auth, docs, chat
   └── @vendor/next@1.0.0_next@16.1.6   # For www
   ```
3. Increased `node_modules` size but isolated versions

**Current state:** Most vendor packages have `next` as direct dependency, not peer.

### Option B: Dual-Export Shared Packages

Create version-specific exports in shared packages:

```json
// @vendor/next/package.json
{
  "exports": {
    "./next-config-builder": "./src/next-config-builder.ts",
    "./next-config-builder-16": "./src/next-config-builder-16.ts"
  }
}
```

**Drawback:** Increased maintenance burden.

### Option C: Single Shared Package Version (Recommended)

Ensure shared packages work with **both** Next.js 15.x and 16.x:

1. Use feature detection or conditional imports where APIs differ
2. Keep shared packages on the `catalog:` default (15.x) initially
3. Progressively update shared packages to be 16-compatible

**Example conditional pattern:**
```typescript
// @repo/console-trpc/src/server.tsx
import { headers } from 'next/headers';

export async function getHeaders() {
  // Works in both 15.x (sync) and 16.x (async)
  const headerStore = await headers();
  return headerStore;
}
```

## Recommended Migration Steps

### Phase 1: Catalog Setup
1. Add `next15` and `next16` named catalogs to `pnpm-workspace.yaml`
2. Update all apps to use explicit catalog references (`catalog:next15`)
3. Verify monorepo still builds

### Phase 2: Shared Package Audit
1. Audit all `@vendor/*` and `@repo/*` packages for Next.js API usage
2. Update async API calls in shared packages to work with both versions
3. Verify `@clerk/nextjs` and other third-party packages support 16.x

### Phase 3: apps/www Upgrade
1. Change `apps/www/package.json` to use `catalog:next16`
2. Update all `cookies()`, `headers()`, `params`, `searchParams` calls to async
3. Review `next.config.ts` for deprecated options
4. Test thoroughly

### Phase 4: Gradual Rollout
1. Monitor `apps/www` in production
2. Upgrade other apps as confidence builds

## Code References

- `pnpm-workspace.yaml:24` - Current Next.js version definition
- `pnpm-workspace.yaml:62-71` - Existing named catalog examples (tailwind4, zod3, zod4)
- `apps/www/package.json:59` - www's Next.js dependency
- `apps/www/next.config.ts:1-75` - www's Next.js configuration
- `vendor/next/src/next-config-builder.ts` - Shared config builder
- `packages/console-trpc/src/server.tsx` - tRPC server using `next/headers`
- `packages/url-utils/src/cors.ts` - CORS utilities using `next/server`

## Third-Party Compatibility Links

- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16)
- [pnpm Catalogs Documentation](https://pnpm.io/catalogs)
- [Clerk Next.js SDK](https://clerk.com/docs/references/nextjs/overview) - Verify 16.x support
- [@sentry/nextjs](https://docs.sentry.io/platforms/javascript/guides/nextjs/) - Verify 16.x support

## Open Questions

1. Does `@clerk/nextjs: 6.33.5` support Next.js 16.x?
2. Does `@sentry/nextjs: ^10.20.0` support Next.js 16.x?
3. Should shared packages move to peer dependencies for Next.js?
4. What's the disk space impact of maintaining two Next.js versions?
