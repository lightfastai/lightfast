---
date: 2026-04-06T12:00:00+00:00
researcher: claude
git_commit: d1bf11c357a31d186c7ddc781a0436dae30caddf
branch: refactor/route-handlers-to-internal-trpc
topic: "Complete deletion map for Knock notification service"
tags: [research, codebase, knock, notifications, vendor, deletion]
status: complete
last_updated: 2026-04-06
---

# Research: Complete Knock Deletion Map

**Date**: 2026-04-06
**Git Commit**: d1bf11c357a31d186c7ddc781a0436dae30caddf
**Branch**: refactor/route-handlers-to-internal-trpc

## Research Question

Find ALL Knock logic in the codebase and map out what needs to be deleted for complete removal.

## Summary

Knock is used as an in-app notification service with two layers: a server-side Inngest function that triggers Knock workflows for high-significance events, and a client-side React bell icon + popover feed. Everything is abstracted behind `@vendor/knock`. The integration touches 4 workspaces (`vendor/knock`, `vendor/security`, `apps/app`, `api/platform`) plus MCP tooling config. There are no tRPC routers, notification preferences, or settings pages for Knock.

## Complete Deletion Checklist

### 1. Delete the entire `vendor/knock/` package

**Action**: `rm -rf vendor/knock/`

Files:
- `vendor/knock/package.json` — package definition (`@knocklabs/node@^1.29.1`, `@knocklabs/react@^0.11.7`)
- `vendor/knock/src/index.ts` — server-side `notifications` singleton (`new Knock({ apiKey })`)
- `vendor/knock/src/env.ts` — env validation (`KNOCK_API_KEY`, `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY`, `NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID`)
- `vendor/knock/src/components/provider.tsx` — `NotificationsProvider` (wraps `KnockProvider` + `KnockFeedProvider`)
- `vendor/knock/src/components/trigger.tsx` — `NotificationsTrigger` (bell icon + `NotificationFeedPopover`)
- `vendor/knock/src/styles.css` — custom CSS overrides for Knock React components
- `vendor/knock/tsconfig.json`
- `vendor/knock/turbo.json`

### 2. Delete the Inngest notification dispatch function

**Files to modify:**

- **DELETE** `api/platform/src/inngest/functions/platform-notification-dispatch.ts`
  - Entire file: `platformNotificationDispatch` Inngest function that triggers `"observation-captured"` Knock workflow

- **EDIT** `api/platform/src/inngest/index.ts`
  - Line 9: remove comment `* 5. platformNotificationDispatch - High-significance event notifications via Knock`
  - Line 29: remove `import { platformNotificationDispatch } from "./functions/platform-notification-dispatch";`
  - Line 38: remove `platformNotificationDispatch` from the exported array
  - Line 58 (approx): remove `platformNotificationDispatch` from the `serve()` functions array

- **EDIT** `api/platform/package.json`
  - Line 48: remove `"@vendor/knock": "workspace:*"` from dependencies

### 3. Remove Knock from `apps/app` frontend

**Files to modify:**

- **DELETE** `apps/app/src/components/notifications-provider.tsx`
  - Entire file: `ConsoleNotificationsProvider` that fetches `userId` and wraps in `NotificationsProvider`

- **EDIT** `apps/app/src/app/(app)/layout.tsx`
  - Line 7: remove `import { ConsoleNotificationsProvider } from "~/components/notifications-provider";`
  - Lines 22-25: remove `<ConsoleNotificationsProvider>` wrapper (keep children)

- **EDIT** `apps/app/src/components/app-header.tsx`
  - Line 7 (approx): remove `import { NotificationsTrigger } from "@vendor/knock/components/trigger";`
  - Line 54 (approx): remove `<NotificationsTrigger />` render

- **EDIT** `apps/app/src/components/user-page-header.tsx`
  - Line 8 (approx): remove `import { NotificationsTrigger } from "@vendor/knock/components/trigger";`
  - Line 67 (approx): remove `<NotificationsTrigger />` render

- **EDIT** `apps/app/src/env.ts`
  - Line 7: remove `import { env as knockEnv } from "@vendor/knock/env";`
  - Line 17: remove `knockEnv` from the `extends` array in `createEnv`

- **EDIT** `apps/app/src/proxy.ts`
  - Line 6: remove `createKnockCspDirectives` from the import
  - Line 20: remove `createKnockCspDirectives()` from the `composeCspOptions()` call

- **EDIT** `apps/app/next.config.ts`
  - Line 43: remove `"@vendor/knock"` from `transpilePackages`
  - Line 72: remove `"@vendor/knock"` from `experimental.optimizePackageImports`

- **EDIT** `apps/app/turbo.json`
  - Line 15: remove `"NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY"` from `env` array
  - Line 31: remove `"KNOCK_API_KEY"` from `passThroughEnv` array

- **EDIT** `apps/app/package.json`
  - Remove `"@vendor/knock": "workspace:*"` from dependencies

### 4. Remove Knock CSP directives from `vendor/security`

**Files to modify:**

- **DELETE** `vendor/security/src/csp/knock.ts`
  - Entire file: `createKnockCspDirectives()` function

- **EDIT** `vendor/security/src/csp/index.ts`
  - Line 38: remove `export { createKnockCspDirectives } from "./knock";`

### 5. Remove MCP server configuration

**Files to modify:**

- **DELETE** `.mcp/start-knock.sh`
  - Shell script that starts `@knocklabs/agent-toolkit` MCP server

- **EDIT** `.mcp.json`
  - Lines 18-22: remove the `"knock"` server entry

- **EDIT** `.env.mcp.example`
  - Lines 13-15: remove `KNOCK_SERVICE_TOKEN` documentation

### 6. Remove environment variables from Vercel

**Action**: Manual — remove from Vercel dashboard or via `vercel env rm`:

| Variable | Project |
|---|---|
| `KNOCK_API_KEY` | `lightfast-app` |
| `KNOCK_SIGNING_KEY` | `lightfast-app` |
| `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY` | `lightfast-app` |
| `NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID` | `lightfast-app` |

These are cached in `.cache/console-envs.json` (auto-generated, will refresh on next `vercel env pull`).

The `apps/app/.vercel/.env.development.local` file will need lines 26-27 (`KNOCK_API_KEY`, `KNOCK_SIGNING_KEY`) and lines 38-39 (`NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID`, `NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY`) removed — or just re-pull from Vercel after removing them there.

### 7. Run `pnpm install` to update lockfile

After all deletions, run `pnpm install` to regenerate `pnpm-lock.yaml` which currently resolves:
- `@knocklabs/node@1.29.1`
- `@knocklabs/react@0.11.7`
- `@knocklabs/client@0.21.4` (transitive)
- `@knocklabs/react-core@0.13.4` (transitive)
- `@knocklabs/types@0.1.5` (transitive)

## File-Level Impact Summary

| Action | File | What Changes |
|---|---|---|
| DELETE | `vendor/knock/` (entire directory) | Package removal |
| DELETE | `api/platform/src/inngest/functions/platform-notification-dispatch.ts` | Inngest function |
| DELETE | `vendor/security/src/csp/knock.ts` | CSP directives |
| DELETE | `apps/app/src/components/notifications-provider.tsx` | React provider wrapper |
| DELETE | `.mcp/start-knock.sh` | MCP server script |
| EDIT | `api/platform/src/inngest/index.ts` | Remove import + registration |
| EDIT | `api/platform/package.json` | Remove `@vendor/knock` dep |
| EDIT | `apps/app/src/app/(app)/layout.tsx` | Remove provider wrapper |
| EDIT | `apps/app/src/components/app-header.tsx` | Remove bell icon |
| EDIT | `apps/app/src/components/user-page-header.tsx` | Remove bell icon |
| EDIT | `apps/app/src/env.ts` | Remove knock env extension |
| EDIT | `apps/app/src/proxy.ts` | Remove CSP directives |
| EDIT | `apps/app/next.config.ts` | Remove transpile/optimize entries |
| EDIT | `apps/app/turbo.json` | Remove env vars |
| EDIT | `apps/app/package.json` | Remove `@vendor/knock` dep |
| EDIT | `vendor/security/src/csp/index.ts` | Remove re-export |
| EDIT | `.mcp.json` | Remove knock server |
| EDIT | `.env.mcp.example` | Remove KNOCK_SERVICE_TOKEN |
| MANUAL | Vercel dashboard | Remove 4 env vars |
| RUN | `pnpm install` | Update lockfile |

## Architecture Documentation

### Data Flow (what gets removed)

```
platformEventStore (emits "platform/event.stored")
  └─> platformNotificationDispatch (Inngest function)  ← DELETE
        └─> Knock API: workflows.trigger("observation-captured")
              └─> Knock delivers to in-app feed
                    └─> KnockProvider + KnockFeedProvider  ← DELETE
                          └─> NotificationsTrigger (bell icon + popover)  ← DELETE
```

The `"platform/event.stored"` event is still consumed by other Inngest functions (like `platformEntityEmbed`), so the event emission in `platformEventStore` stays untouched.

### What is NOT Knock

- `EventNotification` type in `packages/app-upstash-realtime/` — this is Redis pub/sub for real-time event streaming, unrelated to Knock
- The SSE stream route at `apps/app/src/app/api/gateway/stream/route.ts` — Redis-based, not Knock

## Open Questions

- Does the Knock dashboard have any active workflows or data that should be archived before deletion?
- Is there a replacement notification system planned, or is the feature being removed entirely?
