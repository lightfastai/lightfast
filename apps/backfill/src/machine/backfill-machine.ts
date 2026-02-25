import { setup } from "xstate";
import { z } from "zod";

// ── Context ────────────────────────────────────────────────────────────────

export const backfillContextSchema = z.object({
  installationId: z.string(),
  provider: z.string(),
  orgId: z.string(),
  entityTypes: z.array(z.string()),
  currentEntityIndex: z.number(),
  cursor: z.unknown().nullable(),
  pageNum: z.number(),
  eventsProduced: z.number(),
  eventsDispatched: z.number(),
  rateLimit: z
    .object({
      remaining: z.number(),
      resetAt: z.string(), // ISO string — serializable
      limit: z.number(),
    })
    .nullable(),
  error: z.string().nullable(),
  startedAt: z.string().nullable(), // ISO string
  completedAt: z.string().nullable(), // ISO string
});

export type BackfillContext = z.infer<typeof backfillContextSchema>;

// ── Events ─────────────────────────────────────────────────────────────────

export type BackfillEvent =
  | { type: "START"; installationId: string; provider: string; orgId: string; entityTypes: string[] }
  | { type: "VALIDATION_DONE" }
  | { type: "PAGE_FETCHED"; rawCount: number; rateLimit?: { remaining: number; resetAt: string; limit: number } | null }
  | { type: "PAGE_DISPATCHED"; count: number }
  | { type: "CHECKPOINTED"; nextCursor: unknown }
  | { type: "NEXT_ENTITY" }
  | { type: "RATE_LIMIT_CLEARED" }
  | { type: "COMPLETE" }
  | { type: "CANCEL" }
  | { type: "ERROR"; message: string };

// ── Machine ────────────────────────────────────────────────────────────────

/**
 * XState v5 backfill lifecycle machine.
 *
 * Used for state definition and validation only — NOT as a per-step checkpoint
 * (which would double Inngest step count). The Inngest orchestrator creates actors
 * ephemerally to transition state, then memoizes the snapshot via step.run().
 *
 * States: idle → validating → fetching → completed | failed | cancelled
 */
export const backfillMachine = setup({
  types: {
    context: {} as BackfillContext,
    events: {} as BackfillEvent,
  },
  guards: {
    hasNextPage: ({ context }) => context.cursor !== null,
    hasMoreEntities: ({ context }) =>
      context.currentEntityIndex < context.entityTypes.length - 1,
    needsRateLimit: ({ context }) =>
      context.rateLimit !== null &&
      context.rateLimit.remaining < context.rateLimit.limit * 0.1,
  },
}).createMachine({
  id: "backfill",
  initial: "idle",
  context: {
    installationId: "",
    provider: "",
    orgId: "",
    entityTypes: [],
    currentEntityIndex: 0,
    cursor: null,
    pageNum: 1,
    eventsProduced: 0,
    eventsDispatched: 0,
    rateLimit: null,
    error: null,
    startedAt: null,
    completedAt: null,
  },
  states: {
    idle: {
      on: {
        START: {
          target: "validating",
          actions: ({ context, event }) => {
            context.installationId = event.installationId;
            context.provider = event.provider;
            context.orgId = event.orgId;
            context.entityTypes = event.entityTypes;
            context.startedAt = new Date().toISOString();
          },
        },
      },
    },
    validating: {
      on: {
        VALIDATION_DONE: { target: "fetching" },
        ERROR: {
          target: "failed",
          actions: ({ context, event }) => {
            context.error = event.message;
            context.completedAt = new Date().toISOString();
          },
        },
        CANCEL: { target: "cancelled" },
      },
    },
    fetching: {
      on: {
        PAGE_FETCHED: {
          actions: ({ context, event }) => {
            context.eventsProduced += event.rawCount;
            if (event.rateLimit) {
              context.rateLimit = event.rateLimit;
            }
          },
        },
        PAGE_DISPATCHED: {
          actions: ({ context, event }) => {
            context.eventsDispatched += event.count;
          },
        },
        CHECKPOINTED: [
          {
            guard: "hasNextPage",
            actions: ({ context, event }) => {
              context.cursor = event.nextCursor;
              context.pageNum += 1;
            },
          },
          {
            guard: "hasMoreEntities",
            target: "fetching",
            actions: ({ context }) => {
              context.currentEntityIndex += 1;
              context.cursor = null;
              context.pageNum = 1;
            },
          },
          {
            target: "completed",
            actions: ({ context }) => {
              context.completedAt = new Date().toISOString();
            },
          },
        ],
        ERROR: {
          target: "failed",
          actions: ({ context, event }) => {
            context.error = event.message;
            context.completedAt = new Date().toISOString();
          },
        },
        CANCEL: { target: "cancelled" },
      },
    },
    completed: {
      type: "final",
    },
    failed: {
      type: "final",
    },
    cancelled: {
      type: "final",
    },
  },
});
