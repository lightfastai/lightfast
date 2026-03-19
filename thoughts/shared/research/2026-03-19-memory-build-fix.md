---
date: 2026-03-19
topic: "Build-time module evaluation fix for apps/memory"
tags: [research, memory, build, lazy-initialization, pinecone, redis]
status: complete
---

# Build-Time Module Evaluation Fix

## Problem

`pnpm build:memory` crashes on `/api/inngest` route because SDK clients are constructed at module scope before env vars exist.

## Crash Chains

### Chain 1: Pinecone (fatal)
`route.ts` → `inngest/index.ts` → `memory-entity-embed.ts` → `@repo/console-pinecone` → `vendor/pinecone/src/client.ts:366`
**Root cause**: `export const pineconeClient = new PineconeClient()` at module scope

### Chain 2: Redis + Realtime
`inngest/index.ts` → `ingest-delivery.ts` → `@repo/console-upstash-realtime` → `vendor/upstash/src/index.ts:5`
**Root cause**: `export const redis = new Redis({...})` at module scope

### Chain 3: Knock (env validation)
`inngest/index.ts` → `memory-notification-dispatch.ts` → `@vendor/knock` → `vendor/knock/src/env.ts`
**Root cause**: `createEnv()` runs at import time

## Why Console Doesn't Crash

Console's Inngest route only registers `recordActivity`, which has NO transitive imports to Pinecone, Redis Realtime, or Knock. Structural avoidance, not a different pattern.

## Fix Options

### Option A: Fix in vendor/package files (broader, more work)
Convert module-scope singletons to getter functions:
- `vendor/pinecone/src/client.ts` → `getPineconeClient()`
- `packages/console-pinecone/src/client.ts` → `getConsolePineconeClient()`
- `vendor/upstash/src/index.ts` → `getRedis()`
- `packages/console-upstash-realtime/src/index.ts` → `getRealtime()`

Changes export API — requires updating all call sites across the codebase.

### Option B: Fix in consuming Inngest files only (minimal, targeted)
Move SDK imports inside `step.run()` closures using dynamic `import()`:

```ts
async function embedStep() {
  "use step";
  const { consolePineconeClient } = await import("@repo/console-pinecone");
  // use consolePineconeClient
}
```

Only changes the 3 affected Inngest function files. No vendor API changes.

### Option C: Route-level dynamic import (intermediate)
Make the inngest route handler use dynamic imports:

```ts
// apps/memory/src/app/api/inngest/route.ts
export async function POST(req) {
  const { createInngestRouteContext } = await import("@api/memory/inngest");
  const handlers = createInngestRouteContext();
  return handlers.POST(req);
}
```

This defers ALL function imports to runtime. But Inngest needs to discover functions at startup via GET, so this may not work with Inngest's registration protocol.

## Recommendation

**Option B** is the safest — it's targeted, doesn't change shared package APIs, and follows the Next.js guidance of keeping SDK initialization inside runtime-only code paths. The 3 files that need changes:
1. `memory-entity-embed.ts` — dynamic import `@repo/console-pinecone` and `@repo/console-embed`
2. `ingest-delivery.ts` — dynamic import `@repo/console-upstash-realtime`
3. `memory-notification-dispatch.ts` — dynamic import `@vendor/knock`
