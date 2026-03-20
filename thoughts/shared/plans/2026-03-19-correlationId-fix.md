---
title: "Add Missing correlationId to Backfill Cancel Event"
status: draft
priority: P2
estimated_effort: trivial
---

# correlationId Fix

## Objective

The `backfill.cancel` procedure omits `correlationId` from its input schema and event data. The `trigger` procedure already forwards `correlationId` (sourced from `backfillTriggerPayload` in `@repo/app-providers/contracts`), but `cancel` uses a hand-rolled inline schema that was never updated. This breaks trace correlation for cancel operations.

## Implementation

**File**: `api/memory/src/router/memory/backfill.ts`

### Current (lines 117-143):

```ts
cancel: serviceProcedure
  .input(
    z.object({
      installationId: z.string().min(1),
    })
  )
  .mutation(async ({ input }) => {
    // ...
    await inngest.send({
      name: "memory/backfill.run.cancelled",
      data: {
        installationId: input.installationId,
      },
    });
    // ...
  }),
```

### Change:

1. Add `correlationId` to the inline input schema (line 119-120):

```ts
z.object({
  installationId: z.string().min(1),
  correlationId: z.string().max(128).optional(),
})
```

2. Forward it in the event data (line 140-142):

```ts
data: {
  installationId: input.installationId,
  correlationId: input.correlationId,
},
```

The `.max(128)` constraint matches the convention used for correlation IDs elsewhere in the codebase, preventing abuse via oversized trace IDs.

## Verification

- `pnpm --filter @api/platform typecheck`
