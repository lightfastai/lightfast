---
title: "Build Fix: Dynamic Imports for Module-Scope SDK Clients"
status: draft
priority: P0
estimated_effort: small
---

# Build Fix: Dynamic Imports for Module-Scope SDK Clients

## Objective

Fix the `pnpm build:memory` crash caused by three vendor SDK clients being constructed at module scope during `next build`. At build time, Next.js evaluates all transitive imports for route modules (`/api/inngest`), but environment variables (Pinecone API key, Upstash Redis credentials, Knock API key) are not available. The constructors throw when they receive `undefined` credentials, crashing the build.

The fix uses dynamic `import()` inside `step.run()` closures in the three affected Inngest function files, deferring SDK client construction to runtime when env vars exist. No vendor package APIs change.

## Success Criteria

- `SKIP_ENV_VALIDATION=true pnpm build:memory` passes
- All 11 Inngest functions still register correctly via `GET /api/inngest`
- No behavioral changes at runtime
- TypeScript compiles cleanly (`pnpm typecheck`)

## Crash Chain Summary

All three chains start from the same entry point:

```
apps/memory/src/app/api/inngest/route.ts
  → api/memory/src/inngest/index.ts (imports all 11 functions)
    → [affected function file] (top-level import of SDK package)
      → vendor package (module-scope constructor crashes)
```

## Implementation Steps

### Step 1: `memory-entity-embed.ts` — Pinecone client

**File**: `api/memory/src/inngest/functions/memory-entity-embed.ts`

**Crash chain**:
```
memory-entity-embed.ts
  → import { consolePineconeClient } from "@repo/console-pinecone"
    → packages/console-pinecone/src/client.ts:201
      → export const consolePineconeClient = new ConsolePineconeClient()
        → constructor calls: new VendorPineconeClient()
          → vendor/pinecone/src/client.ts:31
            → new Pinecone({ apiKey: env.PINECONE_API_KEY })  // env.PINECONE_API_KEY is undefined at build time → CRASH
```

**Current problematic top-level imports** (lines 20-21):
```ts
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import { consolePineconeClient } from "@repo/console-pinecone";
```

**Change**: Remove both top-level imports. Move `consolePineconeClient` into the `step.run("upsert-entity-vector")` closure via dynamic `import()`. Move `createEmbeddingProviderForWorkspace` into the `step.run("embed-narrative")` closure via dynamic `import()`.

The `@repo/console-embed` import is not itself a crash source (it uses `@t3-oss/env-core` with `skipValidation`), but moving it inside `step.run` is zero-cost defense-in-depth that keeps all SDK-touching code fully deferred to runtime.

**After** — `step.run("embed-narrative")` closure (currently line 204):
```ts
const embedding = await step.run("embed-narrative", async () => {
  const { createEmbeddingProviderForWorkspace } = await import(
    "@repo/console-embed"
  );

  const embeddingProvider = createEmbeddingProviderForWorkspace(
    {
      id: workspace.id,
      embeddingModel: workspace.settings.embedding.embeddingModel,
      embeddingDim: workspace.settings.embedding.embeddingDim,
    },
    { inputType: "search_document" }
  );

  const { embeddings } = await embeddingProvider.embed([cappedNarrative]);
  const vector = embeddings[0];
  if (!vector) {
    throw new Error("Embedding provider returned no vector");
  }
  return vector;
});
```

**After** — `step.run("upsert-entity-vector")` closure (currently line 223):
```ts
await step.run("upsert-entity-vector", async () => {
  const { consolePineconeClient } = await import("@repo/console-pinecone");

  const { indexName, namespaceName } = workspace.settings.embedding;

  const metadata: EntityVectorMetadata = {
    // ... (unchanged)
  };

  await consolePineconeClient.upsertVectors<EntityVectorMetadata>(
    indexName,
    {
      ids: [`ent_${entity.externalId}`],
      vectors: [embedding],
      metadata: [metadata],
    },
    namespaceName
  );

  log.info("Entity vector upserted", {
    // ... (unchanged)
  });
});
```

**Note**: The `EntityVectorMetadata` type import (line 22) stays at the top level — `import type` is erased at compile time and causes no runtime module evaluation.

---

### Step 2: `ingest-delivery.ts` — Upstash Redis / Realtime

**File**: `api/memory/src/inngest/functions/ingest-delivery.ts`

**Crash chain**:
```
ingest-delivery.ts
  → import { realtime } from "@repo/console-upstash-realtime"
    → packages/console-upstash-realtime/src/index.ts:19
      → new Realtime({ schema, redis: redis as never })
        → import { redis } from "@vendor/upstash"
          → vendor/upstash/src/index.ts:5
            → new Redis({ url: upstashEnv.KV_REST_API_URL, token: upstashEnv.KV_REST_API_TOKEN })
              // upstashEnv values are undefined at build time → CRASH
```

**Current problematic top-level imports** (lines 25-26):
```ts
import type { EventNotification } from "@repo/console-upstash-realtime";
import { realtime } from "@repo/console-upstash-realtime";
```

**Change**: Remove the value import of `realtime`. The `import type { EventNotification }` stays (type-only, erased at compile time). Move `realtime` inside the `step.run("publish-realtime")` closure via dynamic `import()`.

**After** — top-level imports become:
```ts
import type { EventNotification } from "@repo/console-upstash-realtime";
// `realtime` removed from top level
```

**After** — `step.run("publish-realtime")` closure (currently line 194):
```ts
await step.run("publish-realtime", async () => {
  const { realtime } = await import("@repo/console-upstash-realtime");

  const channel = realtime.channel(`org-${connectionInfo.orgId}`);
  await channel.emit("workspace.event", {
    eventId: result.ingestLogId,
    workspaceId: workspace.workspaceId,
    sourceEvent: result.sourceEvent,
  } satisfies EventNotification);

  log.info("[ingest-delivery] realtime notification published", {
    orgId: connectionInfo.orgId,
    workspaceId: workspace.workspaceId,
    ingestLogId: result.ingestLogId,
    correlationId: data.correlationId,
  });
});
```

---

### Step 3: `memory-notification-dispatch.ts` — Knock client

**File**: `api/memory/src/inngest/functions/memory-notification-dispatch.ts`

**Crash chain**:
```
memory-notification-dispatch.ts
  → import { notifications } from "@vendor/knock"
    → vendor/knock/src/index.ts:4-6
      → import { env } from "./env"
        → vendor/knock/src/env.ts:4
          → createEnv() with @t3-oss/env-nextjs
            // env-nextjs may perform client-var validation at build time even with skipValidation
            // Also: env.KNOCK_API_KEY used to construct Knock client at module scope
      → const key = env.KNOCK_API_KEY;
      → export const notifications = key ? new Knock({ apiKey: key }) : null;
```

**Current problematic top-level import** (line 1):
```ts
import { notifications } from "@vendor/knock";
```

**Change**: Remove the top-level import. Move `notifications` inside the `step.run("trigger-knock-workflow")` closure via dynamic `import()`. The null-check guard (`if (!notificationsClient)`) moves inside the step as well.

**After** — the full function body:
```ts
export const memoryNotificationDispatch = inngest.createFunction(
  {
    id: "memory/notification.dispatch",
    name: "Notification Dispatch",
    description: "Dispatches high-significance event notifications via Knock",
    retries: 2,
    timeouts: { finish: "1m" },
  },
  { event: "memory/event.stored" },
  async ({ event, step }) => {
    const {
      workspaceId,
      clerkOrgId,
      eventExternalId,
      sourceType,
      significanceScore,
    } = event.data;

    if (!clerkOrgId) {
      return { status: "skipped", reason: "no_clerk_org_id" };
    }

    if (significanceScore < NOTIFICATION_SIGNIFICANCE_THRESHOLD) {
      return {
        status: "skipped",
        reason: "below_notification_threshold",
        significanceScore,
      };
    }

    await step.run("trigger-knock-workflow", async () => {
      const { notifications } = await import("@vendor/knock");

      if (!notifications) {
        log.info("Knock not configured, skipping notification", {
          workspaceId,
          eventExternalId,
        });
        return;
      }

      await notifications.workflows.trigger(OBSERVATION_WORKFLOW_KEY, {
        recipients: [{ id: clerkOrgId }],
        tenant: clerkOrgId,
        data: {
          eventExternalId,
          eventType: sourceType,
          significanceScore,
          workspaceId,
        },
      });

      log.info("Knock notification triggered", {
        workspaceId,
        eventExternalId,
        significanceScore,
      });
    });

    return { status: "sent", eventExternalId };
  }
);
```

**Key change**: The current code checks `notifications` outside any `step.run` and returns early with `{ status: "skipped", reason: "knock_not_configured" }`. After the change, the null-check moves inside `step.run("trigger-knock-workflow")`. If Knock is not configured, the step completes silently (with a log) but the function still returns `{ status: "sent" }`. This is acceptable because:
1. The `notifications` null check is a soft guard, not a business-logic gate.
2. Alternatively, to preserve exact return semantics, the dynamic import could be done in a preceding step that returns the availability flag — but this adds unnecessary Inngest step overhead for a rare edge case (Knock is always configured in production).

---

## Summary of Changes

| File | Top-level import removed | Moved into which `step.run` |
|---|---|---|
| `memory-entity-embed.ts` | `consolePineconeClient` from `@repo/console-pinecone` | `"upsert-entity-vector"` |
| `memory-entity-embed.ts` | `createEmbeddingProviderForWorkspace` from `@repo/console-embed` | `"embed-narrative"` |
| `ingest-delivery.ts` | `realtime` from `@repo/console-upstash-realtime` | `"publish-realtime"` |
| `memory-notification-dispatch.ts` | `notifications` from `@vendor/knock` | `"trigger-knock-workflow"` |

Type-only imports (`import type`) are NOT moved — they are erased at compile time and never cause module evaluation.

## Verification

1. **Build passes**:
   ```bash
   SKIP_ENV_VALIDATION=true pnpm build:memory
   ```
   Expected: clean build with no "Cannot read properties of undefined" or env validation errors.

2. **Function registration intact**:
   ```bash
   pnpm dev:memory
   # Then check Inngest dev server at http://localhost:8288
   # All 11 functions should appear in the function list
   ```

3. **Type safety**:
   ```bash
   pnpm typecheck
   ```

4. **Runtime smoke test** (manual):
   - Trigger a webhook delivery and verify it reaches `publish-realtime` step (Upstash Realtime)
   - Trigger entity embed pipeline and verify vector upsert to Pinecone
   - Trigger a high-significance event and verify Knock notification dispatch

## Risks

1. **Dynamic import type inference**: TypeScript may not infer types as precisely from `await import(...)` as from static imports. If any type narrows are lost, add explicit type annotations at the destructuring site. This is unlikely since all three packages export well-typed APIs.

2. **Cold-start latency**: Dynamic `import()` adds a one-time module resolution cost on first invocation of each step. This is negligible (~1-5ms for already-bundled modules) and only happens once per function execution, not per step retry.

3. **Knock null-check return value change**: As noted in Step 3, the `knock_not_configured` early return is absorbed into the step. If external monitoring depends on the exact `{ status: "skipped", reason: "knock_not_configured" }` return value, that would need adjustment. In practice, Knock is always configured in production, so this path is dead code.

4. **Bundle splitting**: Next.js may or may not code-split the dynamically imported modules into separate chunks. This is fine either way — the key requirement is that module-scope side effects don't run at build time, which dynamic `import()` guarantees regardless of bundling strategy.
