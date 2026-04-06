---
date: 2026-04-05T12:00:00+08:00
researcher: claude
git_commit: 6dd708ceef6aa11f45ed82f4001f9138a74b0e50
branch: main
topic: "Env validation patterns across apps/, api/, and vendor/ layers"
tags: [research, codebase, env, t3-env, inngest, createEnv, extends]
status: complete
last_updated: 2026-04-05
---

# Research: Env Validation Patterns Across apps/, api/, and vendor/ Layers

**Date**: 2026-04-05
**Git Commit**: 6dd708ceef6aa11f45ed82f4001f9138a74b0e50
**Branch**: main

## Research Question

Document how env.ts files are structured across apps/, api/, and vendor/ layers — specifically:
1. `apps/platform/src/env.ts` has Inngest vars declared as `.optional()`
2. `api/platform/src/env.ts` does not follow the same patterns as `api/app/src/env.ts`
3. No app or api layer imports `@vendor/inngest/src/env.ts` (except `apps/www`)
4. Whether apps/platform and apps/app use the `extends` primitive to compose their api-layer env

## Summary

There are 23 env.ts files across the codebase. The two primary app+api pairs (`app` and `platform`) each maintain independent, non-hierarchical env.ts files — neither apps-layer file imports or extends its corresponding api-layer env. The `@api/app/env` and `@api/platform/env` subpath exports exist in package.json but are consumed by zero external packages. `@vendor/inngest/env` is only imported by `apps/www/src/env.ts`; neither `apps/platform` nor `api/platform` use it despite both running Inngest.

## Detailed Findings

### 1. apps/platform/src/env.ts — Inngest Vars as Optional

`apps/platform/src/env.ts:23-25` declares Inngest vars directly in `server:`:

```ts
INNGEST_EVENT_KEY: z.string().min(1).optional(),
INNGEST_SIGNING_KEY: z.string().min(1).optional(),
```

These are declared inline rather than composed from `@vendor/inngest/env`. By contrast, `@vendor/inngest/src/env.ts` also marks `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` as optional, but additionally requires `INNGEST_APP_NAME` (non-optional, must start with `"lightfast-"`).

The platform app declares these Inngest vars without using the vendor env module, and notably omits `INNGEST_APP_NAME` entirely. Meanwhile `api/platform/src/inngest/client.ts` hardcodes the app name as `"lightfast-memory"` rather than reading it from env.

### 2. api/platform/src/env.ts — Diverges from api/app Pattern

| Aspect | `api/app/src/env.ts` | `api/platform/src/env.ts` |
|---|---|---|
| **`extends` array** | 5 entries: `vercel()`, `clerkEnvBase`, `sentryEnv`, `githubEnv`, `vercelEnv` | **None** — no `extends` at all |
| **`ENCRYPTION_KEY` validation** | Full dual-refine: hex/base64 format + all-zeros rejection (verbose form) | Full dual-refine: hex/base64 format + `"0".repeat(64)` rejection (condensed form) |
| **`NODE_ENV`** | Not declared (absent) | Declared in `server:` block (not `shared:`) |
| **`NEXT_PUBLIC_VERCEL_ENV`** | Declared in `client:` | Declared in `client:` |
| **Other server vars** | `ENCRYPTION_KEY` only | `SERVICE_JWT_SECRET`, `ENCRYPTION_KEY`, `NODE_ENV` |
| **`experimental__runtimeEnv`** | Empty `{}` | `NEXT_PUBLIC_VERCEL_ENV` only |

Key divergence: `api/platform/src/env.ts` is fully standalone with zero `extends` entries. It imports nothing from `@vendor/*` or `@repo/*` packages. `api/app/src/env.ts` composes five vendor/repo env presets via `extends`.

### 3. @vendor/inngest/env Import Map

`@vendor/inngest/env` exports a `createEnv` object validating:
- `INNGEST_APP_NAME` — required, `z.string().min(1).startsWith("lightfast-")`
- `INNGEST_EVENT_KEY` — optional
- `INNGEST_SIGNING_KEY` — optional, must start with `"signkey-"`

**Consumers:**

| Consumer | How |
|---|---|
| `apps/www/src/env.ts:4,20` | Imported as `inngestEnv`, spread into `extends` array |
| `api/app/src/inngest/client/client.ts:3,9-10` | Imported as `env`, reads `.INNGEST_APP_NAME` and `.INNGEST_EVENT_KEY` directly |

**Non-consumers (despite using Inngest):**

| Package | What they do instead |
|---|---|
| `apps/platform/src/env.ts` | Redeclares `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` inline in `server:` (no `INNGEST_APP_NAME`) |
| `api/platform/src/env.ts` | Does not declare any Inngest vars at all |
| `api/platform/src/inngest/client.ts` | Hardcodes app name as `"lightfast-memory"` |
| `apps/app/src/env.ts` | Does not declare any Inngest vars |

### 4. apps Layer Does Not Extend api Layer Env

Neither `apps/app/src/env.ts` nor `apps/platform/src/env.ts` imports or extends its corresponding api-layer env.

**apps/app/src/env.ts extends (9 entries):**
- `vercel()`, `clerkEnvBase`, `knockEnv`, `dbEnv`, `sentryEnv`, `betterstackEnv`, `githubEnv`, `vercelEnv`, `upstashEnv`

**apps/platform/src/env.ts extends (5 entries):**
- `vercel()`, `sentryEnv`, `betterstackEnv`, `upstashEnv`, `providerEnv`

Both api packages export `./env` in their package.json:
- `api/app/package.json` — `"./env": { "types": "./src/env.ts", "default": "./src/env.ts" }`
- `api/platform/package.json` — `"./env": { "types": "./src/env.ts", "default": "./src/env.ts" }`

Zero external consumers import `@api/app/env` or `@api/platform/env` anywhere in the monorepo. The api-layer env objects are consumed only internally within their own packages:
- `api/app/src/env.ts` → used by `api/app/src/lib/token-vault.ts`
- `api/platform/src/env.ts` → used by `api/platform/src/lib/encryption.ts`, `jwt.ts`, `related-projects.ts`

### 5. Reference Pattern: apps/www

`apps/www/src/env.ts` demonstrates the most complete `extends` composition:
- `vercel()`, `betterstackEnv`, `sentryEnv`, `securityEnv`, `emailEnv`, `inngestEnv`, `nextEnv`

It has no corresponding api/ layer. It is the **only** app that imports `@vendor/inngest/env`.

### 6. ENCRYPTION_KEY Validation Comparison

| File | Validation |
|---|---|
| `apps/app/src/env.ts:42-73` | `.min(44)` + refine hex/base64 + refine reject all-zeros (verbose) |
| `api/app/src/env.ts:21-52` | `.min(44)` + refine hex/base64 + refine reject all-zeros (verbose, identical to apps/app) |
| `api/platform/src/env.ts:7-24` | `.min(44)` + refine hex/base64 + refine reject `"0".repeat(64)` (condensed) |
| `apps/platform/src/env.ts:21` | `.min(44)` only — **no refine validators** |

## Code References

- `apps/app/src/env.ts:1-88` — App-layer env with 9 extends, full ENCRYPTION_KEY validation
- `apps/platform/src/env.ts:1-40` — Platform app-layer env with 5 extends, minimal ENCRYPTION_KEY, inline Inngest vars
- `apps/www/src/env.ts:1-71` — WWW env, only consumer of `@vendor/inngest/env` via extends
- `api/app/src/env.ts:1-60` — API app-layer env with 5 extends, full ENCRYPTION_KEY validation
- `api/platform/src/env.ts:1-41` — API platform-layer env, zero extends, standalone
- `vendor/inngest/src/env.ts:1-20` — Inngest env module (INNGEST_APP_NAME, EVENT_KEY, SIGNING_KEY)
- `api/app/src/inngest/client/client.ts:3,9-10` — Direct consumer of `@vendor/inngest/env`
- `api/platform/src/inngest/client.ts:8` — Hardcodes `"lightfast-memory"` instead of using env
- `api/app/package.json:12-15` — Exports `./env` subpath (unused externally)
- `api/platform/package.json:12-15` — Exports `./env` subpath (unused externally)

## Architecture Documentation

### Current Env Composition Pattern

```
vendor/    ──┐
packages/  ──┤── extends[] ──▶  apps/{app,platform,www}/src/env.ts
db/        ──┘                       (Next.js runtime env)

vendor/    ──┐
packages/  ──┤── extends[] ──▶  api/{app}/src/env.ts
              │                      (API-layer env)
              │
              └── (nothing) ──▶  api/platform/src/env.ts
                                     (standalone, no extends)
```

The intended pattern is: vendor and package env modules are composed into app-layer env via `extends`. The api-layer envs are **parallel** to the app-layer envs — they redeclare shared vars (`ENCRYPTION_KEY`) independently rather than inheriting.

### All 23 env.ts Files in the Codebase

**apps/**
- `apps/app/src/env.ts`
- `apps/platform/src/env.ts`
- `apps/www/src/env.ts`

**api/**
- `api/app/src/env.ts`
- `api/platform/src/env.ts`

**vendor/** (13 files)
- `vendor/analytics/src/env.ts`
- `vendor/clerk/src/env.ts`
- `vendor/db/src/env.ts`
- `vendor/email/src/env.ts`
- `vendor/embed/src/env.ts`
- `vendor/inngest/src/env.ts`
- `vendor/knock/src/env.ts`
- `vendor/next/src/env.ts`
- `vendor/pinecone/src/env.ts`
- `vendor/security/src/env.ts`
- `vendor/seo/src/env.ts`
- `vendor/upstash/src/env.ts`
- `vendor/vercel-flags/src/env.ts`

**packages/** (4 files)
- `packages/app-clerk-m2m/src/env.ts`
- `packages/app-octokit-github/src/env.ts`
- `packages/app-providers/src/env.ts`
- `packages/app-providers/src/runtime/env.ts`

**db/**
- `db/app/src/env.ts`

**core/**
- `core/cli/src/env.ts`

## Open Questions

1. Should `api/platform/src/env.ts` use `extends` to compose vendor envs (sentry, betterstack, etc.) like `api/app/src/env.ts` does? Currently it's fully standalone.
2. Should `apps/platform/src/env.ts` and `apps/app/src/env.ts` extend their corresponding `@api/platform/env` and `@api/app/env` to eliminate the duplicated `ENCRYPTION_KEY` and `SERVICE_JWT_SECRET` declarations?
3. Should `apps/platform/src/env.ts` import `@vendor/inngest/env` via `extends` (like `apps/www` does) instead of redeclaring Inngest vars inline — which would also add the missing `INNGEST_APP_NAME` validation?
