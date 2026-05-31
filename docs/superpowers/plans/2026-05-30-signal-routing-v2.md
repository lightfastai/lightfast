# Signal Routing V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade signal classification to a v2-only B2B routing contract with first-class signal visibility, creator-only defaults, a hard `needs_review` stop, and the current `people` downstream route.

**Architecture:** Treat visibility as an authorization primitive, not just classifier metadata. New signal rows start as `visibilityScope: "user"`; classification atomically sets `visibilityScope` from the v2 classifier output; read paths expose only `team` signals plus the current creator's own `user` and `needs_review` signals. The AI signal classifier remains the single router pass, but only `team` + `actionable` signals may route to the existing org-scoped people pipeline.

**Tech Stack:** pnpm workspace, TypeScript, Zod, Vitest, Vercel AI SDK structured output, Inngest, Drizzle ORM against PlanetScale MySQL.

---

## Execution Notes

- Run commands from `/Users/jeevanpillay/Code/@lightfastai/lightfast`.
- The worktree has unrelated user changes. Stage only the files listed in each task.
- Use `apply_patch` for manual edits.
- Follow red-green order. Write the failing test first, run it, implement the smallest code change, run it again, then commit that task.
- Do not add memory, knowledge, skill, task, decision, risk, or artifact routes in this plan. Only add `routes.people`.
- Do not keep v1 classification compatibility. This repo is not in production, so `signal.classification.v2` becomes the only accepted signal classification contract.
- Do not hand-write migration SQL. Use `pnpm --filter @db/app db:generate` and stage the generated Drizzle migration files.

## Resolved Decisions

- `visibilityScope` is a real access-control boundary.
- Queued and processing signals are creator-visible only.
- API-key-created signals do not bypass routing; they are creator-visible until classified as `team`.
- `needs_review` remains a visibility scope for this slice and is creator-visible only.
- `classification` is model output/history; `visibilityScope` is current authorization truth.
- Default workspace signal reads show `team` signals plus the current user's own `user` and `needs_review` signals.
- The existing people primitive is org-scoped, so people classification may run only for `team` + `actionable` signals.
- `team` visibility is valid only for `disposition: "actionable"`.
- `needs_context` and `not_actionable` stay `user` or `needs_review`, and all downstream routes must be disabled.
- Signal list/get/create responses include `visibilityScope`.
- Signal list supports `visibilityScopes` filtering after visibility enforcement.
- Review-required signals remain `status: "classified"` with `visibilityScope: "needs_review"`.

## File Structure

### API Contract

- Modify `packages/api-contract/src/schemas/signals.ts`
  - Replace the v1 classification schema with the v2-only contract.
  - Add `signalVisibilityScopeSchema`.
  - Add model-output schema for the AI structured output path.
  - Add v2 invariants: review blocking, team-only-actionable, people-only-team-actionable.
  - Add `visibilityScope` to create/get outputs.
- Modify `packages/api-contract/src/index.ts`
  - Re-export v2 schemas and types.
- Modify `packages/api-contract/src/contract.ts`
  - Update route descriptions from org-scoped to visibility-scoped language.
- Modify `packages/api-contract/src/__tests__/signals.test.ts`
  - Cover valid v2 states and invalid visibility/routing combinations.

### Database

- Modify `db/app/src/schema/tables/signals.ts`
  - Add `visibilityScope` column with default `"user"`.
  - Add a visibility-aware org index.
- Modify `db/app/src/utils/signals.ts`
  - Require `createdByUserId` for visible list queries.
  - Add `visibilityScopes` filtering.
  - Add `getVisibleSignalByPublicId`.
  - Set new rows to `visibilityScope: "user"`.
  - Set `visibilityScope` from classification when marking a signal classified.
- Modify `db/app/src/index.ts`
  - Export the new visible-read helper and params type.
- Modify `db/app/src/__tests__/signals-list.test.ts`
  - Cover creator-visible defaults, visible list params, visible get helper, and classification visibility persistence.
- Generate Drizzle migration files under `db/app/src/migrations/`.

### API App

- Modify `api/app/src/signals/create-signal.ts`
  - Return `visibilityScope: "user"` from create responses.
- Modify `api/app/src/orpc/router/signals.ts`
  - Use `getVisibleSignalByPublicId` for public API reads.
  - Return `visibilityScope`.
- Modify `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`
  - Use `createdByUserId` in list queries.
  - Add `visibilityScopes` list filtering.
  - Use `getVisibleSignalByPublicId` for reads.
- Modify tests:
  - `api/app/src/__tests__/signal-create-service.test.ts`
  - `api/app/src/__tests__/signal-orpc.test.ts`
  - `api/app/src/__tests__/workspace-signals-router.test.ts`

### AI Package

- Modify `ai/src/_internal/agent-graphs/signal-intake.ts`
  - Bump signal classifier schema version to `signal.classification.v2`.
- Modify `ai/src/signal-classifier/schema.ts`
  - Use the v2 model-output schema from the API contract.
- Modify `ai/src/signal-classifier/prompt.ts`
  - Instruct the model to decide visibility, review, and `routes.people`.
  - Explicitly state that people routing is allowed only for team-actionable signals.
- Modify tests:
  - `ai/src/__tests__/signal-classifier/classify.test.ts`
  - `ai/src/__tests__/_internal/agent-graphs/signal-intake.test.ts`
  - `ai/src/__tests__/telemetry/metadata.test.ts`

### Inngest Workflows

- Modify `api/app/src/inngest/workflow/classify-signal.ts`
  - Interpret v2 routing only.
  - Return `visibilityScope` in classified workflow results.
  - Stop downstream routing for `needs_review`, `user`, `needs_context`, and `not_actionable`.
- Modify `api/app/src/inngest/workflow/classify-people.ts`
  - Defensively skip stale people events unless the persisted signal is `team` + `actionable` + `routes.people.shouldRun`.
- Modify tests:
  - `api/app/src/__tests__/signal-workflow.test.ts`
  - `api/app/src/__tests__/people-workflow.test.ts`

---

### Task 1: Add The V2-Only Signal Contract

**Files:**
- Modify: `packages/api-contract/src/schemas/signals.ts`
- Modify: `packages/api-contract/src/index.ts`
- Modify: `packages/api-contract/src/contract.ts`
- Test: `packages/api-contract/src/__tests__/signals.test.ts`

- [ ] **Step 1: Write failing v2 contract tests**

In `packages/api-contract/src/__tests__/signals.test.ts`, replace the existing v1 classification tests with v2-only tests:

```ts
import { describe, expect, it } from "vitest";

import {
  createSignalOutput,
  createSignalInput,
  getSignalOutput,
  SIGNAL_ID_PREFIX,
  signalClassificationModelOutputSchema,
  signalClassificationSchema,
  signalIdSchema,
} from "../schemas/signals";

const baseClassification = {
  schemaVersion: "signal.classification.v2",
  disposition: "actionable",
  title: "Review X profile",
  summary: "The signal mentions an X profile worth engaging.",
  kind: "engage",
  nextAction: "Review the profile and decide whether to reply.",
  priority: "normal",
  rationale: "The input contains a durable social identity.",
  confidence: 0.86,
};

describe("signal schemas", () => {
  it("trims and accepts non-empty signal input", () => {
    expect(
      createSignalInput.parse({ input: "  Run the PR test plan  " })
    ).toEqual({ input: "Run the PR test plan" });
  });

  it("rejects empty signal input", () => {
    expect(() => createSignalInput.parse({ input: "   " })).toThrow();
  });

  it("rejects signal input over 4000 characters", () => {
    expect(() =>
      createSignalInput.parse({ input: "a".repeat(4001) })
    ).toThrow();
  });

  it("accepts generated signal ids", () => {
    expect(
      signalIdSchema.parse("signal_123e4567-e89b-12d3-a456-426614174000")
    ).toBe("signal_123e4567-e89b-12d3-a456-426614174000");
    expect(SIGNAL_ID_PREFIX).toBe("signal_");
  });

  it("rejects legacy sig-prefixed ids", () => {
    expect(() =>
      signalIdSchema.parse("sig_123e4567-e89b-12d3-a456-426614174000")
    ).toThrow("Invalid signal id");
  });

  it("validates create output with creator-only default visibility", () => {
    expect(
      createSignalOutput.parse({
        id: "signal_123e4567-e89b-12d3-a456-426614174000",
        status: "queued",
        visibilityScope: "user",
      })
    ).toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });
  });

  it("validates get output with visibility scope", () => {
    expect(
      getSignalOutput.parse({
        id: "signal_123e4567-e89b-12d3-a456-426614174000",
        input: "Review this profile",
        status: "classified",
        visibilityScope: "team",
        classification: {
          ...baseClassification,
          routing: {
            visibility: {
              scope: "team",
              rationale: "The profile was submitted as shared org context.",
            },
            review: { required: false, reason: null, rationale: null },
            routes: {
              people: {
                shouldRun: true,
                confidence: 0.9,
                rationale: "The input includes https://x.com/jeevanp.",
              },
            },
          },
        },
        createdAt: "2026-05-30T00:00:00.000Z",
        updatedAt: "2026-05-30T00:00:00.000Z",
      })
    ).toMatchObject({
      visibilityScope: "team",
      classification: {
        schemaVersion: "signal.classification.v2",
        routing: { routes: { people: { shouldRun: true } } },
      },
    });
  });

  it("validates an actionable team signal with people routing", () => {
    expect(
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          visibility: {
            scope: "team",
            rationale: "The profile was submitted as shared org context.",
          },
          review: { required: false, reason: null, rationale: null },
          routes: {
            people: {
              shouldRun: true,
              confidence: 0.9,
              rationale: "The input includes https://x.com/jeevanp.",
            },
          },
        },
      })
    ).toMatchObject({
      schemaVersion: "signal.classification.v2",
      routing: {
        visibility: { scope: "team" },
        routes: { people: { shouldRun: true } },
      },
    });
  });

  it("validates an actionable user signal without people routing", () => {
    expect(
      signalClassificationSchema.parse({
        ...baseClassification,
        title: "Follow up privately",
        summary: "The creator wants a private follow-up reminder.",
        kind: "follow_up",
        nextAction: "Remind the creator tomorrow.",
        rationale: "The input describes creator-only follow-up context.",
        routing: {
          visibility: {
            scope: "user",
            rationale: "The signal is only useful to the creator.",
          },
          review: { required: false, reason: null, rationale: null },
          routes: {
            people: {
              shouldRun: false,
              confidence: 0.96,
              rationale: "User-visible signals cannot route to org-scoped people.",
            },
          },
        },
      })
    ).toMatchObject({
      routing: {
        visibility: { scope: "user" },
        routes: { people: { shouldRun: false } },
      },
    });
  });

  it("validates needs_review as a hard route stop", () => {
    expect(
      signalClassificationSchema.parse({
        ...baseClassification,
        disposition: "needs_context",
        title: "Review sensitive claim",
        summary: "The signal may contain sensitive person-related context.",
        kind: "review",
        nextAction: "Ask the creator to review signal visibility.",
        rationale: "The model should not choose visibility by itself.",
        confidence: 0.61,
        routing: {
          visibility: {
            scope: "needs_review",
            rationale: "The signal contains sensitive person-related context.",
          },
          review: {
            required: true,
            reason: "sensitive_person",
            rationale: "The creator should decide whether this can be shared.",
          },
          routes: {
            people: {
              shouldRun: false,
              confidence: 1,
              rationale: "Review blocks all downstream routes.",
            },
          },
        },
      })
    ).toMatchObject({
      routing: {
        visibility: { scope: "needs_review" },
        review: { required: true, reason: "sensitive_person" },
        routes: { people: { shouldRun: false } },
      },
    });
  });

  it("rejects legacy v1 classifications", () => {
    expect(() =>
      signalClassificationSchema.parse({
        schemaVersion: "signal.classification.v1",
        disposition: "actionable",
        title: "Legacy",
        summary: "Legacy classification",
        kind: "review",
        nextAction: "Review it.",
        priority: "normal",
        rationale: "Legacy contract.",
        confidence: 0.9,
      })
    ).toThrow();
  });

  it("rejects needs_review when people routing is enabled", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          visibility: {
            scope: "needs_review",
            rationale: "The signal contains sensitive person-related context.",
          },
          review: {
            required: true,
            reason: "sensitive_person",
            rationale: "The creator should decide whether this can be shared.",
          },
          routes: {
            people: {
              shouldRun: true,
              confidence: 0.7,
              rationale: "This must be rejected because review blocks routes.",
            },
          },
        },
      })
    ).toThrow();
  });

  it("rejects user visibility when people routing is enabled", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          visibility: {
            scope: "user",
            rationale: "This is private creator context.",
          },
          review: { required: false, reason: null, rationale: null },
          routes: {
            people: {
              shouldRun: true,
              confidence: 0.8,
              rationale: "User-visible signals cannot route to org people.",
            },
          },
        },
      })
    ).toThrow();
  });

  it("rejects team visibility for non-actionable dispositions", () => {
    for (const disposition of ["needs_context", "not_actionable"] as const) {
      expect(() =>
        signalClassificationSchema.parse({
          ...baseClassification,
          disposition,
          routing: {
            visibility: {
              scope: "team",
              rationale: "This must be rejected before launch.",
            },
            review: { required: false, reason: null, rationale: null },
            routes: {
              people: {
                shouldRun: false,
                confidence: 0.8,
                rationale: "No people route.",
              },
            },
          },
        })
      ).toThrow();
    }
  });

  it("rejects user and team visibility when review is required", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          visibility: {
            scope: "team",
            rationale: "The profile was submitted as shared org context.",
          },
          review: {
            required: true,
            reason: "ambiguous_scope",
            rationale: "This is inconsistent with team visibility.",
          },
          routes: {
            people: {
              shouldRun: false,
              confidence: 0.5,
              rationale: "No route should run in this invalid state.",
            },
          },
        },
      })
    ).toThrow();
  });

  it("applies the same invariants to model-owned output", () => {
    const modelOutput = {
      disposition: "actionable",
      title: "Review X profile",
      summary: "The signal mentions an X profile worth engaging.",
      kind: "engage",
      nextAction: "Review the profile and decide whether to reply.",
      priority: "normal",
      rationale: "The input contains a durable social identity.",
      confidence: 0.86,
      routing: {
        visibility: {
          scope: "team",
          rationale: "The profile was submitted as shared org context.",
        },
        review: { required: false, reason: null, rationale: null },
        routes: {
          people: {
            shouldRun: true,
            confidence: 0.9,
            rationale: "The input includes https://x.com/jeevanp.",
          },
        },
      },
    };

    expect(signalClassificationModelOutputSchema.parse(modelOutput)).toEqual(
      modelOutput
    );
    expect(() =>
      signalClassificationModelOutputSchema.parse({
        ...modelOutput,
        routing: {
          ...modelOutput.routing,
          visibility: { scope: "user", rationale: "Private." },
        },
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the API contract test and verify RED**

Run:

```bash
pnpm --filter @repo/api-contract test -- src/__tests__/signals.test.ts
```

Expected: FAIL because the v2-only routing fields, visibility schema, and output visibility fields do not exist.

- [ ] **Step 3: Implement the v2-only schemas**

In `packages/api-contract/src/schemas/signals.ts`, replace the classification and output schema block with:

```ts
export const signalVisibilityScopeSchema = z.enum([
  "user",
  "team",
  "needs_review",
]);

export const signalReviewReasonSchema = z.enum([
  "privacy",
  "sensitive_person",
  "authority",
  "low_confidence",
  "ambiguous_scope",
  "other",
]);

export const signalClassificationRouteDecisionSchema = z.object({
  shouldRun: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1),
});

export const signalClassificationRoutingSchema = z.object({
  visibility: z.object({
    scope: signalVisibilityScopeSchema,
    rationale: z.string().trim().min(1),
  }),
  review: z.object({
    required: z.boolean(),
    reason: signalReviewReasonSchema.nullable(),
    rationale: z.string().trim().min(1).nullable(),
  }),
  routes: z.object({
    people: signalClassificationRouteDecisionSchema,
  }),
});

const signalClassificationBaseFields = {
  disposition: signalDispositionSchema,
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1),
  kind: signalKindSchema,
  nextAction: z.string().trim().min(1),
  priority: signalPrioritySchema,
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  routing: signalClassificationRoutingSchema,
};

type SignalClassificationValidationTarget = {
  disposition: z.infer<typeof signalDispositionSchema>;
  routing: z.infer<typeof signalClassificationRoutingSchema>;
};

function validateSignalClassificationV2(
  classification: SignalClassificationValidationTarget,
  ctx: z.RefinementCtx
) {
  const scope = classification.routing.visibility.scope;
  const requiresReview = scope === "needs_review";
  const review = classification.routing.review;
  const peopleRoute = classification.routing.routes.people;

  if (scope === "team" && classification.disposition !== "actionable") {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "visibility", "scope"],
      message: "team visibility requires actionable disposition",
    });
  }

  if (classification.disposition !== "actionable" && peopleRoute.shouldRun) {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "routes", "people", "shouldRun"],
      message: "non-actionable signals must not route people",
    });
  }

  if (peopleRoute.shouldRun && scope !== "team") {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "routes", "people", "shouldRun"],
      message: "people routing requires team visibility",
    });
  }

  if (requiresReview) {
    if (!review.required) {
      ctx.addIssue({
        code: "custom",
        path: ["routing", "review", "required"],
        message: "needs_review requires review.required to be true",
      });
    }
    if (!review.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["routing", "review", "reason"],
        message: "needs_review requires a review reason",
      });
    }
    if (!review.rationale) {
      ctx.addIssue({
        code: "custom",
        path: ["routing", "review", "rationale"],
        message: "needs_review requires a review rationale",
      });
    }
    if (peopleRoute.shouldRun) {
      ctx.addIssue({
        code: "custom",
        path: ["routing", "routes", "people", "shouldRun"],
        message: "needs_review blocks people routing",
      });
    }
    return;
  }

  if (review.required) {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "review", "required"],
      message: "user and team visibility must not require review",
    });
  }
  if (review.reason !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "review", "reason"],
      message: "user and team visibility must use null review reason",
    });
  }
  if (review.rationale !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "review", "rationale"],
      message: "user and team visibility must use null review rationale",
    });
  }
}

export const signalClassificationBaseSchema = z.object({
  schemaVersion: z.literal("signal.classification.v2"),
  ...signalClassificationBaseFields,
});

export const signalClassificationSchema =
  signalClassificationBaseSchema.superRefine(validateSignalClassificationV2);

export const signalClassificationModelOutputSchema =
  signalClassificationBaseSchema
    .omit({ schemaVersion: true })
    .superRefine(validateSignalClassificationV2);

export const createSignalInput = z.object({
  input: z.string().trim().min(1).max(SIGNAL_INPUT_MAX_LENGTH),
});

export const createSignalOutput = z.object({
  id: signalIdSchema,
  status: z.literal("queued"),
  visibilityScope: z.literal("user"),
});

export const getSignalInput = z.object({
  id: signalIdSchema,
});

export const getSignalOutput = z.object({
  id: signalIdSchema,
  input: z.string(),
  status: signalStatusSchema,
  visibilityScope: signalVisibilityScopeSchema,
  classification: signalClassificationSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

Replace the type exports at the bottom of the same file with:

```ts
export type SignalVisibilityScope = z.infer<typeof signalVisibilityScopeSchema>;
export type SignalReviewReason = z.infer<typeof signalReviewReasonSchema>;
export type SignalClassification = z.infer<typeof signalClassificationSchema>;
export type SignalClassificationModelOutput = z.infer<
  typeof signalClassificationModelOutputSchema
>;
export type SignalClassificationRouting = z.infer<
  typeof signalClassificationRoutingSchema
>;
export type SignalStatus = z.infer<typeof signalStatusSchema>;
export type CreateSignalInput = z.infer<typeof createSignalInput>;
export type CreateSignalOutput = z.infer<typeof createSignalOutput>;
export type GetSignalInput = z.infer<typeof getSignalInput>;
export type GetSignalOutput = z.infer<typeof getSignalOutput>;
```

- [ ] **Step 4: Re-export v2 contract names**

In `packages/api-contract/src/index.ts`, update the signal export block to include:

```ts
  type SignalClassificationModelOutput,
  type SignalReviewReason,
  type SignalVisibilityScope,
  signalClassificationBaseSchema,
  signalClassificationModelOutputSchema,
  signalClassificationRouteDecisionSchema,
  signalReviewReasonSchema,
  signalVisibilityScopeSchema,
```

- [ ] **Step 5: Update API route descriptions**

In `packages/api-contract/src/contract.ts`, update the signal descriptions:

```ts
description:
  "Creates a creator-visible signal from raw text and queues asynchronous classification.",
```

```ts
description:
  "Returns a visible signal and its current classification state.",
```

- [ ] **Step 6: Run API contract tests and typecheck**

Run:

```bash
pnpm --filter @repo/api-contract test -- src/__tests__/signals.test.ts
pnpm --filter @repo/api-contract typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the contract change**

Run:

```bash
git add packages/api-contract/src/schemas/signals.ts packages/api-contract/src/index.ts packages/api-contract/src/contract.ts packages/api-contract/src/__tests__/signals.test.ts
git commit -m "feat: define signal visibility contract"
```

---

### Task 2: Add Signal Visibility Storage And Read Helpers

**Files:**
- Modify: `db/app/src/schema/tables/signals.ts`
- Modify: `db/app/src/utils/signals.ts`
- Modify: `db/app/src/index.ts`
- Test: `db/app/src/__tests__/signals-list.test.ts`
- Generate: `db/app/src/migrations/*`

- [ ] **Step 1: Write failing database utility tests**

In `db/app/src/__tests__/signals-list.test.ts`:

1. Update `makeSignal` to include `visibilityScope: "team"` and a v2 classification.
2. Update every `listSignals` call to include `createdByUserId: "user_test"`.
3. Add tests for creator-only create defaults and classification visibility persistence:

```ts
import {
  createSignal,
  getVisibleSignalByPublicId,
  listSignals,
  markSignalClassified,
} from "../utils/signals";
```

```ts
function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 1,
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    createdByApiKeyId: "key_test",
    createdByUserId: "user_test",
    visibilityScope: "team",
    input: "Customer asked for migration help",
    status: "classified",
    classification: {
      schemaVersion: "signal.classification.v2",
      confidence: 0.91,
      disposition: "actionable",
      kind: "follow_up",
      nextAction: "Reply with migration plan",
      priority: "high",
      rationale: "The customer is asking for help.",
      summary: "Customer asked for migration help.",
      title: "Follow up on migration",
      routing: {
        visibility: {
          scope: "team",
          rationale: "This is shared customer work.",
        },
        review: { required: false, reason: null, rationale: null },
        routes: {
          people: {
            shouldRun: false,
            confidence: 0.9,
            rationale: "No durable identity is present.",
          },
        },
      },
    },
    errorCode: null,
    errorMessage: null,
    createdAt: new Date("2026-05-27T01:00:00.000Z"),
    updatedAt: new Date("2026-05-27T01:01:00.000Z"),
    ...overrides,
  };
}
```

```ts
it("accepts visible list inputs with creator and visibility filters", async () => {
  const rows = [makeSignal({ visibilityScope: "team" })];
  const { db, spies } = makeListDb(rows);

  await expect(
    listSignals(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      limit: 2,
      visibilityScopes: ["team"],
    })
  ).resolves.toEqual({
    items: rows,
    nextCursor: null,
  });
  expect(spies.where).toHaveBeenCalledOnce();
});
```

```ts
it("creates queued signals as creator-visible", async () => {
  const { db, spies } = makeCreateDb();

  await createSignal(db, {
    clerkOrgId: "org_test",
    createdByApiKeyId: null,
    createdByUserId: "user_test",
    input: "Create a user-facing signal",
  });

  expect(spies.values).toHaveBeenCalledWith(
    expect.objectContaining({
      visibilityScope: "user",
    })
  );
});
```

Add an update mock and test for `markSignalClassified`:

```ts
function makeUpdateDb() {
  const spies = {
    set: vi.fn(() => ({
      where: vi.fn(() => ({ rowsAffected: 1 })),
    })),
  };
  const db = {
    update: () => ({
      set: spies.set,
    }),
  };
  return { db: db as unknown as Database, spies };
}
```

```ts
it("persists visibility scope from the v2 classification", async () => {
  const { db, spies } = makeUpdateDb();
  const classification = makeSignal().classification;
  if (!classification) {
    throw new Error("classification fixture missing");
  }

  await expect(
    markSignalClassified(db, {
      classification,
      clerkOrgId: "org_test",
      publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    })
  ).resolves.toBe(true);

  expect(spies.set).toHaveBeenCalledWith(
    expect.objectContaining({
      classification,
      visibilityScope: "team",
    })
  );
});
```

Add a visible get smoke test:

```ts
it("loads a signal through the visible get helper", async () => {
  const row = makeSignal();
  const { db } = makeCreateDb();

  await expect(
    getVisibleSignalByPublicId(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      publicId: row.publicId,
    })
  ).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run database tests and verify RED**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/signals-list.test.ts
```

Expected: FAIL because `visibilityScope`, `visibilityScopes`, `getVisibleSignalByPublicId`, and classification visibility persistence do not exist.

- [ ] **Step 3: Add the visibility column**

In `db/app/src/schema/tables/signals.ts`, update the imports:

```ts
import {
  SIGNAL_ID_PREFIX,
  type SignalClassification,
  type SignalStatus,
  type SignalVisibilityScope,
} from "@repo/api-contract";
```

Add the column after `createdByApiKeyId`:

```ts
    visibilityScope: varchar("visibility_scope", {
      length: CODE_LENGTH,
    })
      .$type<SignalVisibilityScope>()
      .notNull()
      .default("user"),
```

Add this index in the table index block:

```ts
    orgVisibilityCreatedIdx: index("signals_org_visibility_created_idx").on(
      table.clerkOrgId,
      table.visibilityScope,
      table.createdAt,
      table.id
    ),
```

- [ ] **Step 4: Implement visible reads and visibility persistence**

In `db/app/src/utils/signals.ts`, update imports:

```ts
import type {
  SignalClassification,
  SignalVisibilityScope,
} from "@repo/api-contract";
```

Update `ListSignalsParams`:

```ts
export interface ListSignalsParams {
  clerkOrgId: string;
  createdByUserId: string;
  cursor?: ListCursor | null;
  dispositions?: SignalClassification["disposition"][];
  kinds?: SignalClassification["kind"][];
  limit?: number;
  peopleRouted?: boolean;
  priorities?: SignalClassification["priority"][];
  search?: string;
  status?: Signal["status"];
  statuses?: Signal["status"][];
  visibilityScopes?: SignalVisibilityScope[];
}
```

In `listSignals`, add the visibility conditions:

```ts
    or(
      eq(signals.visibilityScope, "team"),
      eq(signals.createdByUserId, input.createdByUserId)
    ),
    input.visibilityScopes?.length
      ? inArray(signals.visibilityScope, input.visibilityScopes)
      : undefined,
```

Replace the `peopleRouted` JSON path with the v2 route path:

```ts
    input.peopleRouted === true
      ? eq(jsonString("$.routing.routes.people.shouldRun"), "true")
      : undefined,
```

In `createSignal`, set the default explicitly:

```ts
    visibilityScope: "user",
```

Add a visible read helper below `getSignalByPublicId`:

```ts
export interface GetVisibleSignalByPublicIdParams
  extends GetSignalByPublicIdParams {
  createdByUserId: string;
}

export async function getVisibleSignalByPublicId(
  db: Database,
  input: GetVisibleSignalByPublicIdParams
): Promise<Signal | undefined> {
  const [row] = await db
    .select()
    .from(signals)
    .where(
      and(
        eq(signals.publicId, input.publicId),
        eq(signals.clerkOrgId, input.clerkOrgId),
        or(
          eq(signals.visibilityScope, "team"),
          eq(signals.createdByUserId, input.createdByUserId)
        )
      )
    )
    .limit(1);
  return row;
}
```

In `markSignalClassified`, set visibility from classification:

```ts
      visibilityScope: input.classification.routing.visibility.scope,
```

- [ ] **Step 5: Export the visible read helper**

In `db/app/src/index.ts`, add these exports to the signals utils export block:

```ts
  type GetVisibleSignalByPublicIdParams,
  getVisibleSignalByPublicId,
```

- [ ] **Step 6: Generate migration**

Run:

```bash
pnpm --filter @db/app db:generate
```

Expected: Drizzle generates a migration under `db/app/src/migrations/` adding `visibility_scope` and the visibility index. Do not manually edit generated SQL.

- [ ] **Step 7: Run database tests and typecheck**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/signals-list.test.ts
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit the database change**

Run:

```bash
git status --short db/app/src/migrations
git add db/app/src/schema/tables/signals.ts db/app/src/utils/signals.ts db/app/src/index.ts db/app/src/__tests__/signals-list.test.ts db/app/src/migrations
git commit -m "feat: store signal visibility scope"
```

---

### Task 3: Enforce Visibility In Signal APIs

**Files:**
- Modify: `api/app/src/signals/create-signal.ts`
- Modify: `api/app/src/orpc/router/signals.ts`
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`
- Test: `api/app/src/__tests__/signal-create-service.test.ts`
- Test: `api/app/src/__tests__/signal-orpc.test.ts`
- Test: `api/app/src/__tests__/workspace-signals-router.test.ts`

- [ ] **Step 1: Write failing API visibility tests**

In `api/app/src/__tests__/signal-create-service.test.ts`, update the create mock and expected output:

```ts
  createSignalMock.mockResolvedValue({
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    status: "queued",
    visibilityScope: "user",
  });
```

```ts
    }).resolves.toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });
```

In `api/app/src/__tests__/signal-orpc.test.ts`, replace `getSignalByPublicIdMock` with `getVisibleSignalByPublicIdMock` and update the DB mock:

```ts
const getVisibleSignalByPublicIdMock = vi.fn();
```

```ts
vi.mock("@db/app", () => ({
  createSignal: createSignalMock,
  getVisibleSignalByPublicId: getVisibleSignalByPublicIdMock,
  isOrgBound: isOrgBoundMock,
  markSignalFailed: markSignalFailedMock,
}));
```

Update create expectations:

```ts
    expect(result).toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });
```

Update the get row fixture to include `visibilityScope: "team"` and v2 classification routing:

```ts
  getVisibleSignalByPublicIdMock.mockResolvedValueOnce({
    id: 1,
    publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    createdByUserId: "user_test",
    createdByApiKeyId: "key_test",
    visibilityScope: "team",
    input: "Run the test plan",
    status: "classified",
    classification: {
      schemaVersion: "signal.classification.v2",
      disposition: "actionable",
      title: "Run the test plan",
      summary: "The user needs to finish a validation task.",
      kind: "review",
      nextAction: "Run the PR test plan.",
      priority: "high",
      rationale: "The input describes unfinished validation work.",
      confidence: 0.95,
      routing: {
        visibility: {
          scope: "team",
          rationale: "This is shared validation work.",
        },
        review: { required: false, reason: null, rationale: null },
        routes: {
          people: {
            shouldRun: false,
            confidence: 0.9,
            rationale: "No durable identity is present.",
          },
        },
      },
    },
    errorCode: null,
    errorMessage: null,
    createdAt: new Date("2026-05-21T00:00:00.000Z"),
    updatedAt: new Date("2026-05-21T00:01:00.000Z"),
  });
```

Update the get assertion:

```ts
    expect(getVisibleSignalByPublicIdMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
      }
    );
    expect(result).toMatchObject({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      input: "Run the test plan",
      status: "classified",
      visibilityScope: "team",
      classification: { kind: "review" },
      createdAt: "2026-05-21T00:00:00.000Z",
      updatedAt: "2026-05-21T00:01:00.000Z",
    });
```

In `api/app/src/__tests__/workspace-signals-router.test.ts`, replace `getSignalByPublicIdMock` with `getVisibleSignalByPublicIdMock`, add `visibilityScope: "team"` to `signalRow`, and update `signalRow.classification` to v2 routing:

```ts
const signalRow: Signal = {
  id: 7,
  publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_test",
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  visibilityScope: "team",
  input: "Customer asked for migration help",
  status: "classified",
  classification: {
    schemaVersion: "signal.classification.v2",
    confidence: 0.91,
    disposition: "actionable",
    kind: "follow_up",
    nextAction: "Reply with migration plan",
    priority: "high",
    rationale: "The customer is asking for help.",
    summary: "Customer asked for migration help.",
    title: "Follow up on migration",
    routing: {
      visibility: {
        scope: "team",
        rationale: "This is shared customer work.",
      },
      review: { required: false, reason: null, rationale: null },
      routes: {
        people: {
          shouldRun: false,
          confidence: 0.9,
          rationale: "No durable identity is present.",
        },
      },
    },
  },
  errorCode: null,
  errorMessage: null,
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
};
```

Update the list forwarding test:

```ts
    await expect(
      caller().signals.list({
        cursor: { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 },
        dispositions: ["actionable"],
        kinds: ["follow_up", "fix"],
        limit: 25,
        peopleRouted: true,
        priorities: ["high", "urgent"],
        search: "migration",
        status: "classified",
        visibilityScopes: ["team"],
      })
    ).resolves.toEqual({
      items: [signalRow],
      nextCursor: { createdAt: signalRow.createdAt, id: signalRow.id },
    });

    expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      cursor: { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 },
      dispositions: ["actionable"],
      kinds: ["follow_up", "fix"],
      limit: 25,
      peopleRouted: true,
      priorities: ["high", "urgent"],
      search: "migration",
      status: "classified",
      visibilityScopes: ["team"],
    });
```

Update all other `listSignalsMock` expectations to include:

```ts
      createdByUserId: "user_test",
      visibilityScopes: undefined,
```

Update get expectations:

```ts
    expect(getVisibleSignalByPublicIdMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        publicId: signalRow.publicId,
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
      }
    );
```

- [ ] **Step 2: Run API app tests and verify RED**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-create-service.test.ts src/__tests__/signal-orpc.test.ts src/__tests__/workspace-signals-router.test.ts
```

Expected: FAIL because create responses do not include `visibilityScope`, routers still use org-only reads, and workspace list does not pass creator visibility params.

- [ ] **Step 3: Return visibility from signal creation**

In `api/app/src/signals/create-signal.ts`, update the return:

```ts
  return {
    id: signal.publicId,
    status: "queued",
    visibilityScope: "user",
  };
```

- [ ] **Step 4: Use visible reads in public oRPC**

In `api/app/src/orpc/router/signals.ts`, replace the import:

```ts
import { getVisibleSignalByPublicId } from "@db/app";
```

Update the get handler:

```ts
    const signal = await getVisibleSignalByPublicId(db, {
      publicId: getInput.id,
      clerkOrgId: context.auth.identity.orgId,
      createdByUserId: context.auth.identity.userId,
    });
```

Add `visibilityScope` to the returned object:

```ts
      visibilityScope: signal.visibilityScope,
```

- [ ] **Step 5: Use visible reads and visibility filters in workspace tRPC**

In `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`, replace the DB import:

```ts
import { getVisibleSignalByPublicId, listSignals } from "@db/app";
```

Add the schema import:

```ts
  signalVisibilityScopeSchema,
```

Add the list input field:

```ts
  visibilityScopes: z.array(signalVisibilityScopeSchema).max(3).optional(),
```

Pass creator and filter params to list:

```ts
      createdByUserId: ctx.auth.identity.userId,
      visibilityScopes: input.visibilityScopes?.length
        ? input.visibilityScopes
        : undefined,
```

Use the visible get helper:

```ts
      const signal = await getVisibleSignalByPublicId(ctx.db, {
        publicId: input.publicId,
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
      });
```

- [ ] **Step 6: Run API app tests and typecheck**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-create-service.test.ts src/__tests__/signal-orpc.test.ts src/__tests__/workspace-signals-router.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the API visibility change**

Run:

```bash
git add api/app/src/signals/create-signal.ts api/app/src/orpc/router/signals.ts 'api/app/src/router/(pending-not-allowed)/workspace-signals.ts' api/app/src/__tests__/signal-create-service.test.ts api/app/src/__tests__/signal-orpc.test.ts api/app/src/__tests__/workspace-signals-router.test.ts
git commit -m "feat: enforce signal visibility in APIs"
```

---

### Task 4: Upgrade Signal Classifier To Emit V2 Routing

**Files:**
- Modify: `ai/src/_internal/agent-graphs/signal-intake.ts`
- Modify: `ai/src/signal-classifier/schema.ts`
- Modify: `ai/src/signal-classifier/prompt.ts`
- Modify: `ai/src/__tests__/signal-classifier/classify.test.ts`
- Modify: `ai/src/__tests__/_internal/agent-graphs/signal-intake.test.ts`
- Modify: `ai/src/__tests__/telemetry/metadata.test.ts`

- [ ] **Step 1: Write failing classifier tests**

In `ai/src/__tests__/signal-classifier/classify.test.ts`, update imports:

```ts
import type {
  SignalClassification,
  SignalClassificationModelOutput,
} from "@repo/api-contract";
```

Replace `modelOwnedClassification` with:

```ts
const modelOwnedClassification = {
  disposition: "actionable",
  title: "Review X profile",
  summary: "The signal mentions an X profile worth engaging.",
  kind: "engage",
  nextAction: "Review the profile and decide whether to reply.",
  priority: "normal",
  rationale: "The input contains a durable social identity.",
  confidence: 0.95,
  routing: {
    visibility: {
      scope: "team",
      rationale: "The profile was submitted as shared org context.",
    },
    review: {
      required: false,
      reason: null,
      rationale: null,
    },
    routes: {
      people: {
        shouldRun: true,
        confidence: 0.9,
        rationale: "The input includes https://x.com/jeevanp.",
      },
    },
  },
} satisfies SignalClassificationModelOutput;
```

Replace the `classification` fixture with:

```ts
const classification = {
  schemaVersion: "signal.classification.v2",
  ...modelOwnedClassification,
} satisfies SignalClassification;
```

Replace the prompt assertion test with:

```ts
  it("instructs the model to decide visibility, review, and team-only people routing", () => {
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("routing.visibility");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("needs_review");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("routing.review");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("routing.routes.people");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("team-actionable");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not extract people");
  });
```

Update the strict schema test:

```ts
  it("requires model-owned v2 routing for strict structured output", () => {
    expect(
      signalClassificationModelSchema.parse(modelOwnedClassification)
    ).toEqual(modelOwnedClassification);
    expect(() =>
      signalClassificationModelSchema.parse({
        ...modelOwnedClassification,
        routing: {
          ...modelOwnedClassification.routing,
          visibility: { scope: "user", rationale: "Private." },
        },
      })
    ).toThrow();
  });
```

Update the live E2E assertion:

```ts
          schemaVersion: "signal.classification.v2",
```

- [ ] **Step 2: Update metadata tests to expect RED**

In `ai/src/__tests__/_internal/agent-graphs/signal-intake.test.ts` and `ai/src/__tests__/telemetry/metadata.test.ts`, change expected signal classifier schema versions from:

```ts
"signal.classification.v1"
```

to:

```ts
"signal.classification.v2"
```

- [ ] **Step 3: Run AI tests and verify RED**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/signal-classifier/classify.test.ts src/__tests__/_internal/agent-graphs/signal-intake.test.ts src/__tests__/telemetry/metadata.test.ts
```

Expected: FAIL because the classifier still stamps v1 and the prompt/schema do not require the v2 routing contract.

- [ ] **Step 4: Bump graph schema version**

In `ai/src/_internal/agent-graphs/signal-intake.ts`, change the signal classifier node:

```ts
      schemaVersion: "signal.classification.v2",
```

- [ ] **Step 5: Use the v2 model-facing schema**

Replace `ai/src/signal-classifier/schema.ts` with:

```ts
import { signalClassificationModelOutputSchema } from "@repo/api-contract";

// `schemaVersion` is a fixed, code-owned literal. The model owns only the
// classification fields; runtime code stamps the schema version after parsing.
//
// The model-facing schema still enforces the v2 routing invariants so invalid
// visibility/route combinations fail before persistence.
export const signalClassificationModelSchema =
  signalClassificationModelOutputSchema;
```

- [ ] **Step 6: Update the signal classifier prompt**

Replace `ai/src/signal-classifier/prompt.ts` with:

```ts
export const SIGNAL_CLASSIFIER_SYSTEM_PROMPT = `You are the Lightfast signal classifier.

You receive one raw text input submitted by an external automation or user.
Your job is to decide whether the input describes a useful signal for the creator or team to act on, and how the pipeline should route it.

A signal is a possible action worth considering. It may be a task, reminder, follow-up, review item, reply opening, investigation lead, memory candidate, or anything else that could be useful work.

Do not execute the action.
Do not browse the web.
Do not invent facts not present in the input.
Do not assume private context that was not provided.
Preserve uncertainty.
Do not extract people, emails, handles, profile URLs, memories, knowledge, tasks, skills, risks, decisions, or artifacts yourself. Only decide routing.

Field rules:
- title: short, human-readable, max 80 characters.
- summary: one sentence describing the signal.
- kind: the kind of signal: one of "engage", "follow_up", "review", "fix", "investigate", "remember", or "other".
- nextAction: one concrete action the creator could take next.
- rationale: brief explanation of why this classification was chosen.
- confidence: number from 0 to 1.
- Use disposition "actionable" only when the input contains enough safe context for a creator or team action.
- Use disposition "needs_context" when the input might be useful but lacks enough detail.
- Use disposition "not_actionable" when the input is noise, spam, purely descriptive, or has no plausible creator or team action.
- Use priority "urgent" only when the input implies immediate time sensitivity or blocking impact.

Visibility rules:
- Always include routing.visibility.
- routing.visibility.scope must be "user", "team", or "needs_review".
- Use "user" when the signal is primarily private to the creator: personal reminders, habits, preferences, working style, individual availability, individual workload, creator-only notes, needs_context inputs, or not_actionable inputs.
- Use "team" only when the signal is actionable, safe, and useful for the organization: shared work decisions, operational facts, owners, blockers, runbooks, project state, public contacts, or trusted org automation input.
- Do not use "team" for needs_context or not_actionable signals.
- Use "needs_review" when the model should not decide visibility alone: ambiguous scope, sensitive person-related claims, low-confidence durable writes, authoritative company knowledge, privacy-sensitive content, secrets, or possible wrong-audience submissions.

Review rules:
- Always include routing.review.
- If routing.visibility.scope is "needs_review", routing.review.required must be true, routing.review.reason must be one of "privacy", "sensitive_person", "authority", "low_confidence", "ambiguous_scope", or "other", and routing.review.rationale must explain what the creator needs to review.
- If routing.visibility.scope is "user" or "team", routing.review.required must be false, routing.review.reason must be null, and routing.review.rationale must be null.
- needs_review is a hard pipeline stop. No downstream route should run when review is required.

People route rules:
- Always include routing.routes.people.
- routing.routes.people.shouldRun may be true only for team-actionable signals.
- routing.routes.people.shouldRun must be false when routing.visibility.scope is "user" or "needs_review".
- routing.routes.people.shouldRun must be false when disposition is "needs_context" or "not_actionable".
- routing.routes.people.shouldRun must be true only when the team-actionable signal plausibly contains durable social or contact identity material worth a dedicated people extraction pass.
- Durable identity material means a specific email address, supported social handle, or person profile URL.
- Name-only mentions are not durable identity material.
- routing.routes.people.confidence is the confidence in the people routing decision, not confidence in an extracted person.
- routing.routes.people.rationale is a brief reason for the routing decision.`;
```

- [ ] **Step 7: Run AI tests and typecheck**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/signal-classifier/classify.test.ts src/__tests__/_internal/agent-graphs/signal-intake.test.ts src/__tests__/telemetry/metadata.test.ts
pnpm --filter @repo/ai typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit the AI classifier change**

Run:

```bash
git add ai/src/_internal/agent-graphs/signal-intake.ts ai/src/signal-classifier/schema.ts ai/src/signal-classifier/prompt.ts ai/src/__tests__/signal-classifier/classify.test.ts ai/src/__tests__/_internal/agent-graphs/signal-intake.test.ts ai/src/__tests__/telemetry/metadata.test.ts
git commit -m "feat: route signals with visibility v2"
```

---

### Task 5: Gate Signal And People Workflows On Visibility

**Files:**
- Modify: `api/app/src/inngest/workflow/classify-signal.ts`
- Modify: `api/app/src/inngest/workflow/classify-people.ts`
- Test: `api/app/src/__tests__/signal-workflow.test.ts`
- Test: `api/app/src/__tests__/people-workflow.test.ts`

- [ ] **Step 1: Add v2 signal workflow fixtures**

In `api/app/src/__tests__/signal-workflow.test.ts`, replace the v1 `classification` fixture with these v2 fixtures:

```ts
const teamPeopleClassification = {
  schemaVersion: "signal.classification.v2",
  disposition: "actionable",
  title: "Review X profile",
  summary: "The signal mentions an X profile worth engaging.",
  kind: "engage",
  nextAction: "Review the profile and decide whether to reply.",
  priority: "normal",
  rationale: "The input contains a durable social identity.",
  confidence: 0.95,
  routing: {
    visibility: {
      scope: "team",
      rationale: "The profile was submitted as shared org context.",
    },
    review: { required: false, reason: null, rationale: null },
    routes: {
      people: {
        shouldRun: true,
        confidence: 0.9,
        rationale: "The signal contains a durable profile URL.",
      },
    },
  },
};

const userClassification = {
  ...teamPeopleClassification,
  routing: {
    visibility: {
      scope: "user",
      rationale: "The signal is private to the creator.",
    },
    review: { required: false, reason: null, rationale: null },
    routes: {
      people: {
        shouldRun: false,
        confidence: 1,
        rationale: "User-visible signals cannot route to org-scoped people.",
      },
    },
  },
};

const reviewRequiredClassification = {
  ...teamPeopleClassification,
  disposition: "needs_context",
  title: "Review sensitive claim",
  summary: "The signal may contain sensitive person-related context.",
  kind: "review",
  nextAction: "Ask the creator to review signal visibility.",
  rationale: "The model should not choose visibility by itself.",
  confidence: 0.61,
  routing: {
    visibility: {
      scope: "needs_review",
      rationale: "The signal contains sensitive person-related context.",
    },
    review: {
      required: true,
      reason: "sensitive_person",
      rationale: "The creator should decide whether this can be shared.",
    },
    routes: {
      people: {
        shouldRun: false,
        confidence: 1,
        rationale: "Review blocks all downstream routes.",
      },
    },
  },
};
```

Change the default mock setup:

```ts
  classifySignalInputMock.mockResolvedValue(teamPeopleClassification);
```

Update the main classified workflow expectation:

```ts
    await expect(runWorkflow(step)).resolves.toEqual({
      status: "classified",
      visibilityScope: "team",
      reviewRequired: false,
      routedPeople: true,
    });
```

Update `markSignalClassifiedMock` expectations to use `teamPeopleClassification`:

```ts
    expect(markSignalClassifiedMock).toHaveBeenCalledWith(db, {
      classification: teamPeopleClassification,
      clerkOrgId: "org_test",
      publicId: signalId,
    });
```

- [ ] **Step 2: Add failing signal workflow route-block tests**

Add these tests before the failure tests in `api/app/src/__tests__/signal-workflow.test.ts`:

```ts
  it("does not queue people classification for user-visible signals", async () => {
    const step = createStep();
    classifySignalInputMock.mockResolvedValueOnce(userClassification);

    await expect(runWorkflow(step)).resolves.toEqual({
      status: "classified",
      visibilityScope: "user",
      reviewRequired: false,
      routedPeople: false,
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("does not queue people classification when v2 routing requires review", async () => {
    const step = createStep();
    classifySignalInputMock.mockResolvedValueOnce(reviewRequiredClassification);

    await expect(runWorkflow(step)).resolves.toEqual({
      status: "classified",
      visibilityScope: "needs_review",
      reviewRequired: true,
      routedPeople: false,
    });

    expect(markSignalClassifiedMock).toHaveBeenCalledWith(db, {
      classification: reviewRequiredClassification,
      clerkOrgId: "org_test",
      publicId: signalId,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("does not queue people classification when a retry sees an already classified review-required signal", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce({
      ...signal,
      status: "classified",
      classification: reviewRequiredClassification,
    });

    await expect(runWorkflow(step)).resolves.toEqual({
      status: "classified",
      visibilityScope: "needs_review",
      reviewRequired: true,
      routedPeople: false,
    });

    expect(claimSignalForClassificationMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Add failing people workflow stale-event tests**

In `api/app/src/__tests__/people-workflow.test.ts`, replace the v1 `signalClassification` fixture with a v2 team-actionable classification:

```ts
const signalClassification = {
  schemaVersion: "signal.classification.v2",
  disposition: "actionable",
  title: "Engage profile",
  summary: "The signal includes an X profile.",
  kind: "engage",
  nextAction: "Review the X profile.",
  priority: "normal",
  rationale: "The signal has a social identity.",
  confidence: 0.9,
  routing: {
    visibility: {
      scope: "team",
      rationale: "The profile was submitted as shared org context.",
    },
    review: { required: false, reason: null, rationale: null },
    routes: {
      people: {
        shouldRun: true,
        confidence: 0.9,
        rationale: "The input includes https://x.com/jeevanp.",
      },
    },
  },
};
```

Add `visibilityScope: "team"` to the `signal` fixture:

```ts
const signal = {
  id: 1,
  publicId: signalId,
  clerkOrgId: "org_test",
  visibilityScope: "team",
  input: "Interesting post by https://x.com/jeevanp",
  status: "classified",
  classification: signalClassification,
};
```

Add this test:

```ts
  it("skips stale people events for non-team-visible signals", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce({
      ...signal,
      visibilityScope: "user",
      classification: {
        ...signalClassification,
        routing: {
          visibility: {
            scope: "user",
            rationale: "The signal is private to the creator.",
          },
          review: { required: false, reason: null, rationale: null },
          routes: {
            people: {
              shouldRun: false,
              confidence: 1,
              rationale: "User-visible signals cannot route people.",
            },
          },
        },
      },
    });

    await expect(runWorkflow(step)).resolves.toEqual({ status: "skipped" });

    expect(step.ai.wrap).not.toHaveBeenCalled();
    expect(upsertPeopleFromCandidatesMock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 4: Run workflow tests and verify RED**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-workflow.test.ts src/__tests__/people-workflow.test.ts
```

Expected: FAIL because workflows still understand v1 routing and people workflow does not guard stale events by visibility.

- [ ] **Step 5: Implement signal workflow routing helpers**

In `api/app/src/inngest/workflow/classify-signal.ts`, add imports:

```ts
import type {
  SignalClassification,
  SignalVisibilityScope,
} from "@repo/api-contract";
```

Replace `shouldClassifyPeople` with:

```ts
function getVisibilityScope(
  classification: SignalClassification
): SignalVisibilityScope {
  return classification.routing.visibility.scope;
}

function requiresSignalReview(classification: SignalClassification): boolean {
  return (
    classification.routing.visibility.scope === "needs_review" &&
    classification.routing.review.required === true
  );
}

function shouldClassifyPeople(
  classification: SignalClassification | null
): boolean {
  return (
    classification?.schemaVersion === "signal.classification.v2" &&
    classification.disposition === "actionable" &&
    classification.routing.visibility.scope === "team" &&
    classification.routing.routes.people.shouldRun === true
  );
}

function classifiedResult(classification: SignalClassification, routedPeople: boolean) {
  const visibilityScope = getVisibilityScope(classification);
  return {
    status: "classified",
    visibilityScope,
    reviewRequired: requiresSignalReview(classification),
    routedPeople,
  };
}
```

Use `classifiedResult` in the already-classified branch and after persistence:

```ts
    if (signal.status === "classified" && signal.classification) {
      if (shouldClassifyPeople(signal.classification)) {
        await step.run("queue people classification", () =>
          inngest.send({
            name: "app/people.classification.requested",
            data: {
              clerkOrgId,
              signalId,
            },
          })
        );
        return classifiedResult(signal.classification, true);
      }

      return classifiedResult(signal.classification, false);
    }
```

```ts
    if (shouldClassifyPeople(classification)) {
      await step.run("queue people classification", () =>
        inngest.send({
          name: "app/people.classification.requested",
          data: {
            clerkOrgId,
            signalId,
          },
        })
      );

      return classifiedResult(classification, true);
    }

    return classifiedResult(classification, false);
```

- [ ] **Step 6: Defensively gate people workflow**

In `api/app/src/inngest/workflow/classify-people.ts`, add:

```ts
function shouldProcessPeopleSignal(signal: {
  visibilityScope?: string;
  classification?: {
    schemaVersion?: string;
    disposition?: string;
    routing?: {
      visibility?: { scope?: string };
      routes?: { people?: { shouldRun?: boolean } };
    };
  } | null;
}): boolean {
  return (
    signal.visibilityScope === "team" &&
    signal.classification?.schemaVersion === "signal.classification.v2" &&
    signal.classification.disposition === "actionable" &&
    signal.classification.routing?.visibility?.scope === "team" &&
    signal.classification.routing?.routes?.people?.shouldRun === true
  );
}
```

After the existing status/classification check, add:

```ts
    if (!shouldProcessPeopleSignal(signal)) {
      return { status: "skipped" };
    }
```

- [ ] **Step 7: Run workflow tests and typecheck**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-workflow.test.ts src/__tests__/people-workflow.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit the workflow change**

Run:

```bash
git add api/app/src/inngest/workflow/classify-signal.ts api/app/src/inngest/workflow/classify-people.ts api/app/src/__tests__/signal-workflow.test.ts api/app/src/__tests__/people-workflow.test.ts
git commit -m "feat: gate signal routes on visibility"
```

---

### Task 6: Final Verification

**Files:**
- Verify only; no source edits expected.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @repo/api-contract test -- src/__tests__/signals.test.ts
pnpm --filter @db/app test -- src/__tests__/signals-list.test.ts
pnpm --filter @repo/ai test -- src/__tests__/signal-classifier/classify.test.ts src/__tests__/_internal/agent-graphs/signal-intake.test.ts src/__tests__/telemetry/metadata.test.ts
pnpm --filter @api/app test -- src/__tests__/signal-create-service.test.ts src/__tests__/signal-orpc.test.ts src/__tests__/workspace-signals-router.test.ts src/__tests__/signal-workflow.test.ts src/__tests__/people-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused typechecks**

Run:

```bash
pnpm --filter @repo/api-contract typecheck
pnpm --filter @db/app typecheck
pnpm --filter @repo/ai typecheck
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 3: Run workspace checks**

Run:

```bash
pnpm check
pnpm typecheck
```

Expected: PASS. If unrelated dirty-worktree changes cause failures, capture the failing file paths and errors before deciding whether they belong to this plan.

- [ ] **Step 4: Confirm final diff is scoped**

Run:

```bash
git status --short
git diff --stat
```

Expected: The committed changes for this plan touch only `packages/api-contract`, `db/app`, `ai`, and `api/app` files listed above. Existing unrelated worktree changes may still appear but should not be staged or reverted.
