# Signal People Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-stage signal-to-people pipeline that routes classified signals into a dedicated people classifier and auto-creates one-table, organization-scoped People from durable identities.

**Architecture:** `classify-signal` stays responsible for signal triage and emits a generic routing hint. `classify-people` owns people extraction and delegates durable identity normalization/upsert to `@db/app`. `@repo/ai` exposes noun-based AI capabilities, with shared AI SDK object-classification mechanics hidden under `_internal`.

**Tech Stack:** pnpm workspace, TypeScript, Vitest, Zod, Vercel AI SDK, Inngest, Drizzle ORM, PlanetScale MySQL/Vitess.

---

## Execution Notes

- Run commands from `/Users/jeevanpillay/Code/@lightfastai/lightfast` unless a step says otherwise.
- The current worktree has unrelated user changes. During execution, stage only files listed in the current task.
- Use `apply_patch` for manual edits.
- Follow the red-green order in each task. Do not write implementation before the failing test in that task.
- `db/app` migrations must be generated with `pnpm --filter @db/app db:generate`; do not hand-write migration SQL.

## File Structure

### API Contract

- Modify `packages/api-contract/src/schemas/signals.ts`
  - Adds `signalClassificationRoutingSchema`.
  - Adds optional `routing.classifyPeople.shouldRun` to persisted signal classification JSON.
- Modify `packages/api-contract/src/index.ts`
  - Re-exports the routing schema and type.
- Modify `packages/api-contract/src/__tests__/signals.test.ts`
  - Covers routing presence and backward-compatible absence.

### AI Package

- Create `ai/src/_internal/object-classification/telemetry.ts`
  - Shared model-name, finish-reason, and usage formatting helpers.
- Create `ai/src/_internal/object-classification/run-object-classification.ts`
  - Shared AI SDK `generateText` object-output runner.
- Create `ai/src/_internal/object-classification/run-object-classification.test.ts`
  - Verifies structured output, telemetry privacy, and error logging.
- Modify `ai/package.json`
  - Adds `./people-classifier` export.
  - Adds direct `zod` dependency for internal schemas.
- Modify `ai/src/signal-classifier/schema.ts`
  - Keeps model-owned output schema in sync with the optional routing hint.
- Modify `ai/src/signal-classifier/prompt.ts`
  - Instructs routing only; no people extraction.
- Modify `ai/src/signal-classifier/classify.ts`
  - Uses the internal runner.
- Modify `ai/src/signal-classifier/classify.test.ts`
  - Covers routing hint and preserves existing classifier behavior.
- Create `ai/src/people-classifier/constants.ts`
- Create `ai/src/people-classifier/errors.ts`
- Create `ai/src/people-classifier/prompt.ts`
- Create `ai/src/people-classifier/schema.ts`
- Create `ai/src/people-classifier/classify.ts`
- Create `ai/src/people-classifier/index.ts`
- Create `ai/src/people-classifier/classify.test.ts`

### Database

- Create `db/app/src/schema/tables/people.ts`
  - Defines `lightfast_people`.
- Modify `db/app/package.json`
  - Adds a package-local Vitest test script and dev dependencies.
- Create `db/app/vitest.config.ts`
  - Uses the shared Vitest config in node environment.
- Modify `db/app/src/schema/tables/index.ts`
  - Exports People schema and types.
- Modify `db/app/src/index.ts`
  - Exports People helpers.
- Create `db/app/src/utils/people-identities.ts`
  - Normalizes candidate identities and creates identity keys.
- Create `db/app/src/utils/people.ts`
  - Upserts People with race-safe MySQL duplicate handling.
- Create `db/app/src/utils/people.test.ts`
  - Covers normalization, identity key stability, and retry-safe seen count behavior.
- Generate new migration files under `db/app/src/migrations/`.

### Inngest API

- Modify `api/app/src/inngest/schemas/app.ts`
  - Adds `app/people.classification.requested`.
- Create `api/app/src/inngest/workflow/classify-people.ts`
  - Loads signal, runs people classifier, and upserts People.
- Modify `api/app/src/inngest/index.ts`
  - Registers `classifyPeople`.
- Modify `api/app/src/inngest/workflow/classify-signal.ts`
  - Emits people classification event when routing says to run.
  - Re-emits the people event when a retry sees an already classified signal with routing enabled.
- Modify `api/app/src/__tests__/signal-workflow.test.ts`
  - Covers routing event emission and retry behavior.
- Create `api/app/src/__tests__/people-workflow.test.ts`
  - Covers people workflow behavior.

---

## Task 1: Add Signal Routing Contract

**Files:**
- Modify: `packages/api-contract/src/schemas/signals.ts`
- Modify: `packages/api-contract/src/index.ts`
- Test: `packages/api-contract/src/__tests__/signals.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add these tests to `packages/api-contract/src/__tests__/signals.test.ts` inside `describe("signal schemas", ...)`:

```ts
  it("accepts a signal classification routing hint for people classification", () => {
    expect(
      signalClassificationSchema.parse({
        schemaVersion: "signal.classification.v1",
        disposition: "actionable",
        title: "Talk to Jeevan",
        summary: "The signal mentions an X profile worth engaging.",
        kind: "engage",
        nextAction: "Review the profile and decide whether to reply.",
        priority: "normal",
        rationale: "The input contains a durable social identity.",
        confidence: 0.86,
        routing: {
          classifyPeople: {
            shouldRun: true,
            rationale: "The input includes https://x.com/jeevanp.",
          },
        },
      })
    ).toMatchObject({
      routing: {
        classifyPeople: {
          shouldRun: true,
        },
      },
    });
  });

  it("rejects an empty people routing rationale", () => {
    expect(() =>
      signalClassificationSchema.parse({
        schemaVersion: "signal.classification.v1",
        disposition: "actionable",
        title: "Talk to Jeevan",
        summary: "The signal mentions an X profile worth engaging.",
        kind: "engage",
        nextAction: "Review the profile and decide whether to reply.",
        priority: "normal",
        rationale: "The input contains a durable social identity.",
        confidence: 0.86,
        routing: {
          classifyPeople: {
            shouldRun: true,
            rationale: "   ",
          },
        },
      })
    ).toThrow();
  });
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```bash
pnpm --filter @repo/api-contract test -- src/__tests__/signals.test.ts
```

Expected: FAIL because `routing` is stripped or not present in the parsed classification result.

- [ ] **Step 3: Implement the routing schema**

In `packages/api-contract/src/schemas/signals.ts`, add this schema after `signalPrioritySchema`:

```ts
export const signalClassificationRoutingSchema = z.object({
  classifyPeople: z
    .object({
      shouldRun: z.boolean(),
      rationale: z.string().trim().min(1),
    })
    .optional(),
});
```

Then add the optional field to `signalClassificationSchema`:

```ts
export const signalClassificationSchema = z.object({
  schemaVersion: z.literal("signal.classification.v1"),
  disposition: signalDispositionSchema,
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1),
  kind: signalKindSchema,
  nextAction: z.string().trim().min(1),
  priority: signalPrioritySchema,
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  routing: signalClassificationRoutingSchema.optional(),
});
```

Add this type near the existing type exports:

```ts
export type SignalClassificationRouting = z.infer<
  typeof signalClassificationRoutingSchema
>;
```

- [ ] **Step 4: Export the routing schema and type**

In `packages/api-contract/src/index.ts`, add these exports to the `./schemas/signals` export block:

```ts
  type SignalClassificationRouting,
  signalClassificationRoutingSchema,
```

- [ ] **Step 5: Run the contract test and verify GREEN**

Run:

```bash
pnpm --filter @repo/api-contract test -- src/__tests__/signals.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add packages/api-contract/src/schemas/signals.ts packages/api-contract/src/index.ts packages/api-contract/src/__tests__/signals.test.ts
git commit -m "feat(contract): add signal routing hint"
```

---

## Task 2: Extract Shared AI Object Classification Runner

**Files:**
- Create: `ai/src/_internal/object-classification/telemetry.ts`
- Create: `ai/src/_internal/object-classification/run-object-classification.ts`
- Create: `ai/src/_internal/object-classification/run-object-classification.test.ts`
- Modify: `ai/package.json`

- [ ] **Step 1: Write failing internal runner tests**

Create `ai/src/_internal/object-classification/run-object-classification.test.ts`:

```ts
import { z } from "zod";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runObjectClassification } from "./run-object-classification";

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
};

const usage = {
  inputTokens: { total: 4, noCache: 4, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 8, text: 8, reasoning: undefined },
};

function modelReturning(text: string) {
  return new MockLanguageModelV3({
    provider: "openai",
    modelId: "gpt-5.4-nano",
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    }),
  });
}

beforeEach(() => {
  logger.info.mockReset();
  logger.warn.mockReset();
});

describe("runObjectClassification", () => {
  it("runs structured output with metadata-only telemetry", async () => {
    const model = modelReturning(JSON.stringify({ title: "Engage profile" }));

    await expect(
      runObjectClassification({
        failureMessage: "[test] failed",
        getFailure: (error) => ({
          errorCode: "FAILED",
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
        logger,
        maxOutputTokens: 128,
        metadata: {
          clerkOrgId: "org_test",
          promptId: "test-classifier",
          signalId: "sig_123",
        },
        model,
        prompt: "Classify the input",
        schema: z.object({ title: z.string() }),
        successMessage: "[test] completed",
        system: "You are a classifier.",
        timeoutMs: 10_000,
        telemetryFunctionId: "test.classifier",
      })
    ).resolves.toEqual({ title: "Engage profile" });

    expect(model.doGenerateCalls[0]).toEqual(
      expect.objectContaining({
        maxOutputTokens: 128,
        responseFormat: expect.objectContaining({ type: "json" }),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "[test] completed",
      expect.objectContaining({
        clerkOrgId: "org_test",
        model: "openai/gpt-5.4-nano",
        promptId: "test-classifier",
        signalId: "sig_123",
        usage: expect.objectContaining({
          inputTokens: 4,
          outputTokens: 8,
          totalTokens: 12,
        }),
      })
    );
    expect(logger.info.mock.calls[0]?.[1]).not.toHaveProperty("prompt");
    expect(logger.info.mock.calls[0]?.[1]).not.toHaveProperty("output");
  });

  it("logs durable failure metadata and rethrows", async () => {
    const model = modelReturning(JSON.stringify({ missing: true }));

    await expect(
      runObjectClassification({
        failureMessage: "[test] failed",
        getFailure: () => ({
          errorCode: "INVALID_OUTPUT",
          errorMessage: "invalid output",
        }),
        logger,
        maxOutputTokens: 128,
        metadata: {
          clerkOrgId: "org_test",
          promptId: "test-classifier",
          signalId: "sig_123",
        },
        model,
        prompt: "Classify the input",
        schema: z.object({ title: z.string() }),
        successMessage: "[test] completed",
        system: "You are a classifier.",
        timeoutMs: 10_000,
        telemetryFunctionId: "test.classifier",
      })
    ).rejects.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      "[test] failed",
      expect.objectContaining({
        errorCode: "INVALID_OUTPUT",
        errorMessage: "invalid output",
        promptId: "test-classifier",
      })
    );
  });
});
```

- [ ] **Step 2: Run the internal runner test and verify RED**

Run:

```bash
pnpm --filter @repo/ai test -- src/_internal/object-classification/run-object-classification.test.ts
```

Expected: FAIL with a module resolution error for `./run-object-classification`.

- [ ] **Step 3: Add `zod` as a direct AI package dependency**

In `ai/package.json`, add `zod` to `dependencies`:

```json
  "dependencies": {
    "@repo/api-contract": "workspace:*",
    "ai": "catalog:",
    "server-only": "^0.0.1",
    "zod": "catalog:"
  },
```

- [ ] **Step 4: Sync the lockfile for the AI dependency change**

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` records the `@repo/ai` importer dependency on `zod`.

- [ ] **Step 5: Implement telemetry helpers**

Create `ai/src/_internal/object-classification/telemetry.ts`:

```ts
import type { LanguageModel, LanguageModelUsage } from "ai";

export function getModelName(model: LanguageModel): string {
  if (typeof model === "string") {
    return model;
  }

  return `${model.provider}/${model.modelId}`;
}

export function formatFinishReason(finishReason: unknown): string {
  if (typeof finishReason === "string") {
    return finishReason;
  }

  if (
    finishReason &&
    typeof finishReason === "object" &&
    "unified" in finishReason &&
    typeof finishReason.unified === "string"
  ) {
    return finishReason.unified;
  }

  return String(finishReason);
}

export function formatUsage(usage: LanguageModelUsage): Record<string, number> {
  const inputTokens = readTokenTotal(usage.inputTokens);
  const outputTokens = readTokenTotal(usage.outputTokens);

  return Object.fromEntries(
    Object.entries({
      inputTokens,
      outputTokens,
      totalTokens:
        typeof inputTokens === "number" && typeof outputTokens === "number"
          ? inputTokens + outputTokens
          : usage.totalTokens,
    }).filter(([, value]) => typeof value === "number")
  ) as Record<string, number>;
}

function readTokenTotal(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "total" in value &&
    typeof value.total === "number"
  ) {
    return value.total;
  }

  return undefined;
}
```

- [ ] **Step 6: Implement the shared runner**

Create `ai/src/_internal/object-classification/run-object-classification.ts`:

```ts
import { generateText, type LanguageModel, Output } from "ai";
import type { ZodType } from "zod";

import {
  formatFinishReason,
  formatUsage,
  getModelName,
} from "./telemetry";

type LogMetadata = Record<string, unknown>;

export interface ObjectClassificationLogger {
  info(message: string, metadata: LogMetadata): void;
  warn(message: string, metadata: LogMetadata): void;
}

export interface ClassificationFailure {
  errorCode: string;
  errorMessage: string;
}

export interface RunObjectClassificationInput<T> {
  failureMessage: string;
  getFailure(error: unknown): ClassificationFailure;
  logger: ObjectClassificationLogger;
  maxOutputTokens: number;
  metadata: LogMetadata;
  model: LanguageModel;
  prompt: string;
  schema: ZodType<T>;
  successMessage: string;
  system: string;
  telemetryFunctionId: string;
  timeoutMs: number;
}

export async function runObjectClassification<T>({
  failureMessage,
  getFailure,
  logger,
  maxOutputTokens,
  metadata,
  model,
  prompt,
  schema,
  successMessage,
  system,
  telemetryFunctionId,
  timeoutMs,
}: RunObjectClassificationInput<T>): Promise<T> {
  const fullMetadata = {
    ...metadata,
    model: getModelName(model),
  };

  try {
    const { finishReason, output, usage, warnings } = await generateText({
      model,
      output: Output.object({ schema }),
      system,
      prompt,
      maxOutputTokens,
      maxRetries: 0,
      timeout: { totalMs: timeoutMs },
      experimental_telemetry: {
        functionId: telemetryFunctionId,
        isEnabled: true,
        metadata: fullMetadata,
        recordInputs: false,
        recordOutputs: false,
      },
    });

    logger.info(successMessage, {
      ...fullMetadata,
      finishReason: formatFinishReason(finishReason),
      usage: formatUsage(usage),
      warnings: warnings?.length ?? 0,
    });

    return output;
  } catch (error) {
    const failure = getFailure(error);

    logger.warn(failureMessage, {
      ...fullMetadata,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
    });

    throw error;
  }
}
```

- [ ] **Step 7: Run the internal runner test and verify GREEN**

Run:

```bash
pnpm --filter @repo/ai test -- src/_internal/object-classification/run-object-classification.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add ai/package.json pnpm-lock.yaml ai/src/_internal/object-classification
git commit -m "refactor(ai): add shared object classification runner"
```

---

## Task 3: Update Signal Classifier Routing and Shared Runner Usage

**Files:**
- Modify: `ai/src/signal-classifier/schema.ts`
- Modify: `ai/src/signal-classifier/prompt.ts`
- Modify: `ai/src/signal-classifier/classify.ts`
- Modify: `ai/src/signal-classifier/classify.test.ts`

- [ ] **Step 1: Write failing signal classifier routing tests**

In `ai/src/signal-classifier/classify.test.ts`, update `modelOwnedClassification` to include routing:

```ts
const modelOwnedClassification = {
  disposition: "actionable",
  title: "Review X profile",
  summary: "The user found an X profile worth engaging.",
  kind: "engage",
  nextAction: "Review the profile and decide whether to reply.",
  priority: "normal",
  rationale: "The input contains a durable social identity.",
  confidence: 0.95,
  routing: {
    classifyPeople: {
      shouldRun: true,
      rationale: "The input includes https://x.com/jeevanp.",
    },
  },
} satisfies Omit<SignalClassification, "schemaVersion">;
```

Add this test:

```ts
  it("instructs the model to route people classification without extracting people", () => {
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("routing.classifyPeople");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("shouldRun");
    expect(SIGNAL_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not extract people");
  });
```

- [ ] **Step 2: Run the signal classifier test and verify RED**

Run:

```bash
pnpm --filter @repo/ai test -- src/signal-classifier/classify.test.ts
```

Expected: FAIL because the current prompt does not mention `routing.classifyPeople` and the model schema does not yet accept the routing field.

- [ ] **Step 3: Update the model schema**

In `ai/src/signal-classifier/schema.ts`, keep the omit behavior and rely on the updated contract schema:

```ts
import { signalClassificationSchema } from "@repo/api-contract";

// `schemaVersion` is a fixed, code-owned literal. The model owns only the
// classification fields; runtime code stamps the schema version after parsing.
export const signalClassificationModelSchema =
  signalClassificationSchema.omit({
    schemaVersion: true,
  });
```

- [ ] **Step 4: Update the signal classifier prompt**

In `ai/src/signal-classifier/prompt.ts`, append these field rules before the final priority rule:

```ts
- routing.classifyPeople.shouldRun: true only when the input plausibly contains durable social or contact identity material worth a dedicated people extraction pass.
- routing.classifyPeople.rationale: brief reason for the routing decision.
- Do not extract people, emails, handles, or profile URLs yourself. Only decide whether the dedicated people classifier should run.
```

- [ ] **Step 5: Refactor `classifySignalInput` to use the shared runner**

In `ai/src/signal-classifier/classify.ts`, remove the local `generateText`, `Output`, `LanguageModelUsage`, `formatUsage`, `formatFinishReason`, and `getModelName` logic. Import the shared runner:

```ts
import {
  runObjectClassification,
  type ObjectClassificationLogger,
} from "../_internal/object-classification/run-object-classification";
```

Keep the existing exported interfaces and `buildSignalClassificationRequest`. Replace the body of `classifySignalInput` with:

```ts
export async function classifySignalInput(
  {
    clerkOrgId,
    deploymentEnvironment,
    inputLength,
    model,
    prompt,
    signalId,
    system,
  }: SignalClassificationRequest,
  { logger = noopLogger }: ClassifySignalInputOptions = {}
): Promise<SignalClassification> {
  const output = await runObjectClassification({
    failureMessage: "[signals] classification failed",
    getFailure: getSignalClassificationFailure,
    logger,
    maxOutputTokens: SIGNAL_CLASSIFIER_MAX_OUTPUT_TOKENS,
    metadata: {
      clerkOrgId,
      deploymentEnvironment,
      feature: SIGNAL_CLASSIFIER_FEATURE,
      inputLength,
      promptId: SIGNAL_CLASSIFIER_PROMPT_ID,
      schemaVersion: SIGNAL_CLASSIFICATION_SCHEMA_VERSION,
      signalId,
      workflow: SIGNAL_CLASSIFIER_WORKFLOW,
    },
    model,
    prompt,
    schema: signalClassificationModelSchema,
    successMessage: "[signals] classification completed",
    system,
    telemetryFunctionId: SIGNAL_CLASSIFIER_TELEMETRY_FUNCTION_ID,
    timeoutMs: SIGNAL_CLASSIFIER_TIMEOUT_MS,
  });

  return { ...output, schemaVersion: SIGNAL_CLASSIFICATION_SCHEMA_VERSION };
}
```

The local `SignalClassifierLogger` type can become:

```ts
export type SignalClassifierLogger = ObjectClassificationLogger;
```

- [ ] **Step 6: Run the signal classifier test and verify GREEN**

Run:

```bash
pnpm --filter @repo/ai test -- src/signal-classifier/classify.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add ai/src/signal-classifier/schema.ts ai/src/signal-classifier/prompt.ts ai/src/signal-classifier/classify.ts ai/src/signal-classifier/classify.test.ts
git commit -m "feat(ai): add signal people routing hint"
```

---

## Task 4: Add People Classifier AI Capability

**Files:**
- Modify: `ai/package.json`
- Create: `ai/src/people-classifier/constants.ts`
- Create: `ai/src/people-classifier/errors.ts`
- Create: `ai/src/people-classifier/prompt.ts`
- Create: `ai/src/people-classifier/schema.ts`
- Create: `ai/src/people-classifier/classify.ts`
- Create: `ai/src/people-classifier/index.ts`
- Create: `ai/src/people-classifier/classify.test.ts`

- [ ] **Step 1: Write failing people classifier tests**

Create `ai/src/people-classifier/classify.test.ts`:

```ts
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
  PEOPLE_CLASSIFIER_MODEL,
  PEOPLE_CLASSIFIER_PROMPT_ID,
  PEOPLE_CLASSIFIER_SYSTEM_PROMPT,
  PEOPLE_CLASSIFIER_WORKFLOW,
  buildPeopleClassificationRequest,
  classifyPeopleFromSignal,
  getPeopleClassificationFailure,
  peopleClassificationSchema,
} from "./index";

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
};

const signalId = "sig_123e4567-e89b-12d3-a456-426614174000";

const modelOwnedClassification = {
  candidates: [
    {
      displayName: "Jeevan Pillay",
      identityProvider: "x",
      identityType: "handle",
      identityValue: "@jeevanp",
      rationale: "The signal includes a durable X handle.",
      confidence: 0.91,
    },
  ],
};

const usage = {
  inputTokens: { total: 24, noCache: 24, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 52, text: 52, reasoning: undefined },
};

function createClassifierModel(text: string) {
  return new MockLanguageModelV3({
    provider: "openai",
    modelId: "gpt-5.4-nano",
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    }),
  });
}

beforeEach(() => {
  logger.info.mockReset();
  logger.warn.mockReset();
});

describe("classifyPeopleFromSignal", () => {
  it("builds a people classification request with signal context", () => {
    const request = buildPeopleClassificationRequest({
      classification: {
        schemaVersion: "signal.classification.v1",
        disposition: "actionable",
        title: "Engage profile",
        summary: "The signal includes an X profile.",
        kind: "engage",
        nextAction: "Review the X profile.",
        priority: "normal",
        rationale: "The signal has a social identity.",
        confidence: 0.9,
        routing: {
          classifyPeople: {
            shouldRun: true,
            rationale: "The input includes https://x.com/jeevanp.",
          },
        },
      },
      clerkOrgId: "org_test",
      deploymentEnvironment: "development",
      input: "Interesting post by https://x.com/jeevanp",
      signalId,
    });

    expect(PEOPLE_CLASSIFIER_MODEL).toBe("openai/gpt-5.4-nano");
    expect(PEOPLE_CLASSIFIER_WORKFLOW).toBe("classify-people");
    expect(PEOPLE_CLASSIFIER_PROMPT_ID).toBe("people-classifier");
    expect(request).toEqual(
      expect.objectContaining({
        clerkOrgId: "org_test",
        deploymentEnvironment: "development",
        inputLength: "Interesting post by https://x.com/jeevanp".length,
        model: PEOPLE_CLASSIFIER_MODEL,
        signalId,
        system: PEOPLE_CLASSIFIER_SYSTEM_PROMPT,
      })
    );
    expect(request.prompt).toContain("Interesting post by https://x.com/jeevanp");
    expect(request.prompt).toContain("Engage profile");
  });

  it("uses structured output and stamps people schema version", async () => {
    const model = createClassifierModel(JSON.stringify(modelOwnedClassification));
    const request = {
      ...buildPeopleClassificationRequest({
        classification: {
          schemaVersion: "signal.classification.v1",
          disposition: "actionable",
          title: "Engage profile",
          summary: "The signal includes an X profile.",
          kind: "engage",
          nextAction: "Review the X profile.",
          priority: "normal",
          rationale: "The signal has a social identity.",
          confidence: 0.9,
        },
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        input: "Interesting post by @jeevanp",
        signalId,
      }),
      model,
    };

    await expect(classifyPeopleFromSignal(request, { logger })).resolves.toEqual({
      schemaVersion: "people.classification.v1",
      ...modelOwnedClassification,
    });

    expect(logger.info).toHaveBeenCalledWith(
      "[people] classification completed",
      expect.objectContaining({
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        feature: "people",
        promptId: "people-classifier",
        signalId,
        workflow: "classify-people",
      })
    );
  });

  it("rejects unsupported unknown providers", () => {
    expect(() =>
      peopleClassificationSchema.parse({
        schemaVersion: "people.classification.v1",
        candidates: [
          {
            identityProvider: "unknown",
            identityType: "handle",
            identityValue: "@someone",
            rationale: "Unsupported provider",
            confidence: 0.4,
          },
        ],
      })
    ).toThrow();
  });

  it("maps invalid output to a durable people failure code", async () => {
    const model = createClassifierModel(JSON.stringify({ candidates: [{ identityProvider: "unknown" }] }));
    const request = {
      ...buildPeopleClassificationRequest({
        classification: {
          schemaVersion: "signal.classification.v1",
          disposition: "actionable",
          title: "Engage profile",
          summary: "The signal includes an X profile.",
          kind: "engage",
          nextAction: "Review the X profile.",
          priority: "normal",
          rationale: "The signal has a social identity.",
          confidence: 0.9,
        },
        clerkOrgId: "org_test",
        deploymentEnvironment: "preview",
        input: "Interesting post by @jeevanp",
        signalId,
      }),
      model,
    };

    const failure = await classifyPeopleFromSignal(request, { logger }).catch(
      (error) => getPeopleClassificationFailure(error)
    );

    expect(failure.errorCode).toBe(
      PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE
    );
  });

  it("instructs the model to avoid name-only candidates", () => {
    expect(PEOPLE_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not create name-only candidates");
    expect(PEOPLE_CLASSIFIER_SYSTEM_PROMPT).toContain("Do not browse");
    expect(PEOPLE_CLASSIFIER_SYSTEM_PROMPT).toContain("durable identity");
  });
});
```

- [ ] **Step 2: Run people classifier tests and verify RED**

Run:

```bash
pnpm --filter @repo/ai test -- src/people-classifier/classify.test.ts
```

Expected: FAIL with a module resolution error for `./index`.

- [ ] **Step 3: Export the people classifier subpath**

In `ai/package.json`, add the `./people-classifier` export:

```json
    "./people-classifier": {
      "types": "./src/people-classifier/index.ts",
      "default": "./src/people-classifier/index.ts"
    }
```

- [ ] **Step 4: Add people classifier constants**

Create `ai/src/people-classifier/constants.ts`:

```ts
export const PEOPLE_CLASSIFICATION_SCHEMA_VERSION =
  "people.classification.v1";
export const PEOPLE_CLASSIFIER_MAX_OUTPUT_TOKENS = 768;
export const PEOPLE_CLASSIFIER_MODEL = "openai/gpt-5.4-nano";
export const PEOPLE_CLASSIFIER_FEATURE = "people";
export const PEOPLE_CLASSIFIER_PROMPT_ID = "people-classifier";
export const PEOPLE_CLASSIFIER_WORKFLOW = "classify-people";
export const PEOPLE_CLASSIFIER_TELEMETRY_FUNCTION_ID =
  "app.inngest.classify-people";
export const PEOPLE_CLASSIFIER_TIMEOUT_MS = 30_000;

export const PEOPLE_CLASSIFICATION_FAILED_ERROR_CODE =
  "PEOPLE_CLASSIFICATION_FAILED";
export const PEOPLE_CLASSIFICATION_PROVIDER_ERROR_CODE =
  "PEOPLE_CLASSIFICATION_PROVIDER_ERROR";
export const PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE =
  "PEOPLE_CLASSIFICATION_INVALID_OUTPUT";
export const PEOPLE_CLASSIFICATION_TIMEOUT_ERROR_CODE =
  "PEOPLE_CLASSIFICATION_TIMEOUT";

export type PeopleClassificationFailureCode =
  | typeof PEOPLE_CLASSIFICATION_FAILED_ERROR_CODE
  | typeof PEOPLE_CLASSIFICATION_PROVIDER_ERROR_CODE
  | typeof PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE
  | typeof PEOPLE_CLASSIFICATION_TIMEOUT_ERROR_CODE;
```

- [ ] **Step 5: Add people classifier schema**

Create `ai/src/people-classifier/schema.ts`:

```ts
import { z } from "zod";

export const peopleIdentityProviderSchema = z.enum([
  "email",
  "x",
  "linkedin",
  "github",
  "website",
]);

export const peopleIdentityTypeSchema = z.enum([
  "email",
  "handle",
  "profile_url",
]);

export const peopleCandidateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  identityProvider: peopleIdentityProviderSchema,
  identityType: peopleIdentityTypeSchema,
  identityValue: z.string().trim().min(1).max(2000),
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
});

export const peopleClassificationSchema = z.object({
  schemaVersion: z.literal("people.classification.v1"),
  candidates: z.array(peopleCandidateSchema).max(10),
});

export const peopleClassificationModelSchema =
  peopleClassificationSchema.omit({
    schemaVersion: true,
  });

export type PeopleIdentityProvider = z.infer<
  typeof peopleIdentityProviderSchema
>;
export type PeopleIdentityType = z.infer<typeof peopleIdentityTypeSchema>;
export type PeopleCandidate = z.infer<typeof peopleCandidateSchema>;
export type PeopleClassification = z.infer<typeof peopleClassificationSchema>;
```

- [ ] **Step 6: Add people classifier error mapping**

Create `ai/src/people-classifier/errors.ts`:

```ts
import { APICallError, NoObjectGeneratedError, RetryError } from "ai";

import {
  PEOPLE_CLASSIFICATION_FAILED_ERROR_CODE,
  PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
  PEOPLE_CLASSIFICATION_PROVIDER_ERROR_CODE,
  PEOPLE_CLASSIFICATION_TIMEOUT_ERROR_CODE,
  type PeopleClassificationFailureCode,
} from "./constants";

export interface PeopleClassificationFailure {
  errorCode: PeopleClassificationFailureCode;
  errorMessage: string;
}

export function getPeopleClassificationFailure(
  error: unknown
): PeopleClassificationFailure {
  const message = getErrorMessage(error);

  if (isTimeoutError(error)) {
    return {
      errorCode: PEOPLE_CLASSIFICATION_TIMEOUT_ERROR_CODE,
      errorMessage: message,
    };
  }

  if (isInvalidOutputError(error)) {
    return {
      errorCode: PEOPLE_CLASSIFICATION_INVALID_OUTPUT_ERROR_CODE,
      errorMessage: message,
    };
  }

  if (isProviderError(error)) {
    return {
      errorCode: PEOPLE_CLASSIFICATION_PROVIDER_ERROR_CODE,
      errorMessage: message,
    };
  }

  return {
    errorCode: PEOPLE_CLASSIFICATION_FAILED_ERROR_CODE,
    errorMessage: message,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isProviderError(error: unknown): boolean {
  return (
    APICallError.isInstance(error) ||
    hasErrorName(error, "AI_APICallError") ||
    hasErrorName(error, "GatewayError") ||
    hasCauseMatching(error, isProviderError)
  );
}

function isInvalidOutputError(error: unknown): boolean {
  return (
    NoObjectGeneratedError.isInstance(error) ||
    hasErrorName(error, "AI_NoObjectGeneratedError") ||
    hasCauseMatching(error, isInvalidOutputError)
  );
}

function isTimeoutError(error: unknown): boolean {
  return (
    hasErrorName(error, "AbortError") ||
    hasErrorName(error, "TimeoutError") ||
    (RetryError.isInstance(error) && error.reason === "abort") ||
    hasCauseMatching(error, isTimeoutError)
  );
}

function hasErrorName(error: unknown, name: string): boolean {
  return (
    error instanceof Error &&
    (error.name === name || error.name.includes(name))
  );
}

function hasCauseMatching(
  error: unknown,
  predicate: (error: unknown) => boolean
): boolean {
  if (!(error instanceof Error) || !("cause" in error)) {
    return false;
  }

  return predicate(error.cause);
}
```

- [ ] **Step 7: Add people classifier prompt**

Create `ai/src/people-classifier/prompt.ts`:

```ts
export const PEOPLE_CLASSIFIER_SYSTEM_PROMPT = `You are the Lightfast people classifier.

You receive a raw signal input and the persisted signal classification.
Your job is to extract durable people candidates that Lightfast can store for the organization.

Do not execute the action.
Do not browse the web.
Do not infer identities that are not present in the signal input or persisted classification.
Do not create name-only candidates.
Preserve uncertainty.

A durable person identity is one of:
- email: a specific email address.
- handle: a specific social handle for a supported provider.
- profile_url: a specific person profile URL.

Supported identityProvider values:
- email
- x
- linkedin
- github
- website

Supported identityType values:
- email
- handle
- profile_url

Rules:
- Return an empty candidates array when no durable person identity is present.
- Return no candidate when you cannot assign a supported provider and identity type.
- Prefer email and profile_url over loose handles when both appear.
- Profile URLs and handles must identify a person profile, not a company page or generic domain.
- identityValue should preserve the raw durable value from the input.
- displayName is optional and must only be included when present or strongly implied by the signal text.
- confidence is a number from 0 to 1.`;
```

- [ ] **Step 8: Add people classifier request builder and runtime**

Create `ai/src/people-classifier/classify.ts`:

```ts
import "server-only";

import type { SignalClassification } from "@repo/api-contract";
import type { LanguageModel } from "ai";

import {
  runObjectClassification,
  type ObjectClassificationLogger,
} from "../_internal/object-classification/run-object-classification";
import {
  PEOPLE_CLASSIFICATION_SCHEMA_VERSION,
  PEOPLE_CLASSIFIER_FEATURE,
  PEOPLE_CLASSIFIER_MAX_OUTPUT_TOKENS,
  PEOPLE_CLASSIFIER_MODEL,
  PEOPLE_CLASSIFIER_PROMPT_ID,
  PEOPLE_CLASSIFIER_TELEMETRY_FUNCTION_ID,
  PEOPLE_CLASSIFIER_TIMEOUT_MS,
  PEOPLE_CLASSIFIER_WORKFLOW,
} from "./constants";
import { getPeopleClassificationFailure } from "./errors";
import { PEOPLE_CLASSIFIER_SYSTEM_PROMPT } from "./prompt";
import {
  peopleClassificationModelSchema,
  type PeopleClassification,
} from "./schema";

const noopLogger: ObjectClassificationLogger = {
  info: () => undefined,
  warn: () => undefined,
};

export type DeploymentEnvironment = "development" | "preview" | "production";

export interface PeopleClassificationRequest {
  classification: SignalClassification;
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  inputLength: number;
  model: LanguageModel;
  prompt: string;
  signalId: string;
  system: string;
}

export interface BuildPeopleClassificationRequestInput {
  classification: SignalClassification;
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  input: string;
  signalId: string;
}

export interface ClassifyPeopleFromSignalOptions {
  logger?: ObjectClassificationLogger;
}

export function buildPeopleClassificationRequest({
  classification,
  clerkOrgId,
  deploymentEnvironment,
  input,
  signalId,
}: BuildPeopleClassificationRequestInput): PeopleClassificationRequest {
  return {
    classification,
    clerkOrgId,
    deploymentEnvironment,
    inputLength: input.length,
    model: PEOPLE_CLASSIFIER_MODEL,
    prompt: [
      "Extract durable people candidates from this signal.",
      "",
      "Signal input:",
      input,
      "",
      "Signal classification:",
      JSON.stringify(classification),
    ].join("\n"),
    signalId,
    system: PEOPLE_CLASSIFIER_SYSTEM_PROMPT,
  };
}

export async function classifyPeopleFromSignal(
  {
    clerkOrgId,
    deploymentEnvironment,
    inputLength,
    model,
    prompt,
    signalId,
    system,
  }: PeopleClassificationRequest,
  { logger = noopLogger }: ClassifyPeopleFromSignalOptions = {}
): Promise<PeopleClassification> {
  const output = await runObjectClassification({
    failureMessage: "[people] classification failed",
    getFailure: getPeopleClassificationFailure,
    logger,
    maxOutputTokens: PEOPLE_CLASSIFIER_MAX_OUTPUT_TOKENS,
    metadata: {
      clerkOrgId,
      deploymentEnvironment,
      feature: PEOPLE_CLASSIFIER_FEATURE,
      inputLength,
      promptId: PEOPLE_CLASSIFIER_PROMPT_ID,
      schemaVersion: PEOPLE_CLASSIFICATION_SCHEMA_VERSION,
      signalId,
      workflow: PEOPLE_CLASSIFIER_WORKFLOW,
    },
    model,
    prompt,
    schema: peopleClassificationModelSchema,
    successMessage: "[people] classification completed",
    system,
    telemetryFunctionId: PEOPLE_CLASSIFIER_TELEMETRY_FUNCTION_ID,
    timeoutMs: PEOPLE_CLASSIFIER_TIMEOUT_MS,
  });

  return { ...output, schemaVersion: PEOPLE_CLASSIFICATION_SCHEMA_VERSION };
}
```

- [ ] **Step 9: Add people classifier barrel exports**

Create `ai/src/people-classifier/index.ts`:

```ts
export * from "./classify";
export * from "./constants";
export * from "./errors";
export * from "./prompt";
export * from "./schema";
```

- [ ] **Step 10: Run people classifier tests and verify GREEN**

Run:

```bash
pnpm --filter @repo/ai test -- src/people-classifier/classify.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit Task 4**

```bash
git add ai/package.json ai/src/people-classifier
git commit -m "feat(ai): add people classifier"
```

---

## Task 5: Add People Schema and Identity Normalization

**Files:**
- Modify: `db/app/package.json`
- Create: `db/app/vitest.config.ts`
- Create: `db/app/src/schema/tables/people.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Create: `db/app/src/utils/people-identities.ts`
- Create: `db/app/src/utils/people.test.ts`

- [ ] **Step 1: Add DB package test infrastructure**

In `db/app/package.json`, add a `test` script:

```json
    "test": "vitest run --passWithNoTests",
```

In `db/app/package.json`, add these dev dependencies:

```json
    "@repo/vitest-config": "workspace:*",
    "vitest": "catalog:"
```

Create `db/app/vitest.config.ts`:

```ts
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      environment: "node",
    },
  })
);
```

- [ ] **Step 2: Sync the lockfile for the DB test dependencies**

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` records the `@db/app` importer dev dependencies on `@repo/vitest-config` and `vitest`.

- [ ] **Step 3: Write failing People identity tests**

Create `db/app/src/utils/people.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  createPersonIdentityKey,
  normalizePersonIdentityCandidate,
  shouldIncrementSeenCount,
} from "./people-identities";

describe("people identity normalization", () => {
  it("normalizes email identities", () => {
    expect(
      normalizePersonIdentityCandidate({
        identityProvider: "email",
        identityType: "email",
        identityValue: "  Jeevan@SomeDomain.com ",
      })
    ).toEqual({
      identityProvider: "email",
      identityType: "email",
      normalizedIdentityValue: "jeevan@somedomain.com",
    });
  });

  it("collapses X profile URLs to X handles", () => {
    expect(
      normalizePersonIdentityCandidate({
        identityProvider: "x",
        identityType: "profile_url",
        identityValue: "https://x.com/JeevanP?ref=home",
      })
    ).toEqual({
      identityProvider: "x",
      identityType: "handle",
      normalizedIdentityValue: "jeevanp",
    });
  });

  it("normalizes X handles", () => {
    expect(
      normalizePersonIdentityCandidate({
        identityProvider: "x",
        identityType: "handle",
        identityValue: " @JeevanP ",
      })
    ).toEqual({
      identityProvider: "x",
      identityType: "handle",
      normalizedIdentityValue: "jeevanp",
    });
  });

  it("keeps non-collapsible profile URLs as profile URLs", () => {
    expect(
      normalizePersonIdentityCandidate({
        identityProvider: "linkedin",
        identityType: "profile_url",
        identityValue: "https://www.linkedin.com/in/JeevanP/?trk=public",
      })
    ).toEqual({
      identityProvider: "linkedin",
      identityType: "profile_url",
      normalizedIdentityValue: "https://www.linkedin.com/in/JeevanP",
    });
  });

  it("returns undefined for unsupported or non-durable identities", () => {
    expect(
      normalizePersonIdentityCandidate({
        identityProvider: "website",
        identityType: "handle",
        identityValue: "not a useful website handle",
      })
    ).toBeUndefined();
  });

  it("creates stable hash keys from normalized identities", () => {
    const first = createPersonIdentityKey({
      identityProvider: "x",
      identityType: "handle",
      normalizedIdentityValue: "jeevanp",
    });
    const second = createPersonIdentityKey({
      identityProvider: "x",
      identityType: "handle",
      normalizedIdentityValue: "jeevanp",
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("increments seen count only for a new source signal", () => {
    expect(
      shouldIncrementSeenCount({
        existingLastSeenSignalId: "sig_a",
        sourceSignalId: "sig_b",
      })
    ).toBe(true);
    expect(
      shouldIncrementSeenCount({
        existingLastSeenSignalId: "sig_a",
        sourceSignalId: "sig_a",
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 4: Run People identity tests and verify RED**

Run:

```bash
pnpm --filter @db/app test -- src/utils/people.test.ts
```

Expected: FAIL with a module resolution error for `./people-identities`.

- [ ] **Step 5: Add the People table schema**

Create `db/app/src/schema/tables/people.ts`:

```ts
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const PERSON_ID_LENGTH = 64;
const CLERK_ID_LENGTH = 64;
const SIGNAL_ID_LENGTH = 64;
const CODE_LENGTH = 32;
const IDENTITY_KEY_LENGTH = 64;
const NORMALIZED_IDENTITY_VALUE_LENGTH = 512;
const DISPLAY_NAME_LENGTH = 160;

export type PersonIdentityProvider =
  | "email"
  | "x"
  | "linkedin"
  | "github"
  | "website";

export type PersonIdentityType = "email" | "handle" | "profile_url";

export function createPersonId() {
  return `person_${randomUUID()}`;
}

export const people = mysqlTable(
  "lightfast_people",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PERSON_ID_LENGTH })
      .notNull()
      .$defaultFn(createPersonId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    displayName: varchar("display_name", { length: DISPLAY_NAME_LENGTH }),

    identityProvider: varchar("identity_provider", { length: CODE_LENGTH })
      .$type<PersonIdentityProvider>()
      .notNull(),

    identityType: varchar("identity_type", { length: CODE_LENGTH })
      .$type<PersonIdentityType>()
      .notNull(),

    identityValue: text("identity_value").notNull(),

    normalizedIdentityValue: varchar("normalized_identity_value", {
      length: NORMALIZED_IDENTITY_VALUE_LENGTH,
    }).notNull(),

    identityKey: varchar("identity_key", {
      length: IDENTITY_KEY_LENGTH,
    }).notNull(),

    firstSeenSignalId: varchar("first_seen_signal_id", {
      length: SIGNAL_ID_LENGTH,
    }),

    lastSeenSignalId: varchar("last_seen_signal_id", {
      length: SIGNAL_ID_LENGTH,
    }),

    seenCount: int("seen_count", { unsigned: true }).default(1).notNull(),

    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),

    createdAt: datetime("created_at", { mode: "string", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "string", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("people_public_id_uq").on(table.publicId),
    orgIdentityKeyUq: uniqueIndex("people_org_identity_key_uq").on(
      table.clerkOrgId,
      table.identityKey
    ),
    orgCreatedIdx: index("people_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt,
      table.id
    ),
  })
);

export type Person = typeof people.$inferSelect;
export type InsertPerson = typeof people.$inferInsert;
```

- [ ] **Step 6: Export the People table**

In `db/app/src/schema/tables/index.ts`, add:

```ts
export {
  createPersonId,
  type InsertPerson,
  type Person,
  type PersonIdentityProvider,
  type PersonIdentityType,
  people,
} from "./people";
```

- [ ] **Step 7: Implement identity normalization helpers**

Create `db/app/src/utils/people-identities.ts`:

```ts
import { createHash } from "node:crypto";

import type {
  PersonIdentityProvider,
  PersonIdentityType,
} from "../schema";

export interface PersonIdentityCandidateInput {
  identityProvider: PersonIdentityProvider;
  identityType: PersonIdentityType;
  identityValue: string;
}

export interface NormalizedPersonIdentity {
  identityProvider: PersonIdentityProvider;
  identityType: PersonIdentityType;
  normalizedIdentityValue: string;
}

export function normalizePersonIdentityCandidate(
  input: PersonIdentityCandidateInput
): NormalizedPersonIdentity | undefined {
  if (input.identityProvider === "email" && input.identityType === "email") {
    const normalized = input.identityValue.trim().toLowerCase();
    return normalized.includes("@")
      ? {
          identityProvider: "email",
          identityType: "email",
          normalizedIdentityValue: normalized,
        }
      : undefined;
  }

  if (input.identityType === "handle") {
    return normalizeHandle(input.identityProvider, input.identityValue);
  }

  if (input.identityType === "profile_url") {
    return normalizeProfileUrl(input.identityProvider, input.identityValue);
  }

  return undefined;
}

export function createPersonIdentityKey(
  input: NormalizedPersonIdentity
): string {
  return createHash("sha256")
    .update(
      [
        input.identityProvider,
        input.identityType,
        input.normalizedIdentityValue,
      ].join("\0")
    )
    .digest("hex");
}

export function shouldIncrementSeenCount(input: {
  existingLastSeenSignalId: string | null;
  sourceSignalId: string;
}): boolean {
  return input.existingLastSeenSignalId !== input.sourceSignalId;
}

function normalizeHandle(
  provider: PersonIdentityProvider,
  value: string
): NormalizedPersonIdentity | undefined {
  if (!["x", "github"].includes(provider)) {
    return undefined;
  }

  const normalized = value.trim().replace(/^@/, "").toLowerCase();
  if (!normalized || normalized.includes("/") || normalized.includes(" ")) {
    return undefined;
  }

  return {
    identityProvider: provider,
    identityType: "handle",
    normalizedIdentityValue: normalized,
  };
}

function normalizeProfileUrl(
  provider: PersonIdentityProvider,
  value: string
): NormalizedPersonIdentity | undefined {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }

  url.hash = "";
  url.search = "";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const pathname = url.pathname.replace(/\/$/, "");

  if (provider === "x" && ["x.com", "twitter.com"].includes(host)) {
    const handle = pathname.split("/").filter(Boolean)[0];
    return handle
      ? normalizeHandle("x", handle)
      : undefined;
  }

  if (provider === "github" && host === "github.com") {
    const handle = pathname.split("/").filter(Boolean)[0];
    return handle
      ? normalizeHandle("github", handle)
      : undefined;
  }

  if (provider === "linkedin" && host === "linkedin.com") {
    const normalizedPath = pathname || "/";
    return normalizedPath.startsWith("/in/")
      ? {
          identityProvider: "linkedin",
          identityType: "profile_url",
          normalizedIdentityValue: `https://www.linkedin.com${normalizedPath}`,
        }
      : undefined;
  }

  if (provider === "website" && url.protocol.startsWith("http")) {
    return {
      identityProvider: "website",
      identityType: "profile_url",
      normalizedIdentityValue: `${url.protocol}//${host}${pathname || ""}`,
    };
  }

  return undefined;
}
```

- [ ] **Step 8: Run People identity tests and verify GREEN**

Run:

```bash
pnpm --filter @db/app test -- src/utils/people.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```bash
git add db/app/package.json db/app/vitest.config.ts pnpm-lock.yaml db/app/src/schema/tables/people.ts db/app/src/schema/tables/index.ts db/app/src/utils/people-identities.ts db/app/src/utils/people.test.ts
git commit -m "feat(db): add people identity model"
```

---

## Task 6: Add Race-Safe People Upsert Helper and Migration

**Files:**
- Create: `db/app/src/utils/people.ts`
- Modify: `db/app/src/index.ts`
- Modify: `db/app/src/utils/people.test.ts`
- Generate: `db/app/src/migrations/*`

- [ ] **Step 1: Add failing People upsert helper tests**

Update the top imports in `db/app/src/utils/people.test.ts` to include `vi`, the DB types, and the new helper import:

```ts
import type { Database, Person } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import {
  createPersonIdentityKey,
  normalizePersonIdentityCandidate,
  shouldIncrementSeenCount,
} from "./people-identities";
import { upsertPeopleFromCandidates } from "./people";
```

Then append these tests to `db/app/src/utils/people.test.ts` after the existing `describe("people identity normalization", ...)` block:

```ts
function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 1,
    publicId: "person_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    displayName: "Jeevan Pillay",
    identityProvider: "x",
    identityType: "handle",
    identityValue: "@jeevanp",
    normalizedIdentityValue: "jeevanp",
    identityKey: createPersonIdentityKey({
      identityProvider: "x",
      identityType: "handle",
      normalizedIdentityValue: "jeevanp",
    }),
    firstSeenSignalId: "sig_first",
    lastSeenSignalId: "sig_first",
    seenCount: 1,
    metadata: {},
    createdAt: "2026-05-22 00:00:00.000",
    updatedAt: "2026-05-22 00:00:00.000",
    ...overrides,
  };
}

function makePeopleDb(selectResults: Person[][]) {
  const selectQueue = [...selectResults];
  const spies = {
    insertValues: vi.fn(),
    duplicateSet: vi.fn(),
  };
  const db = {
    insert: () => ({
      values: (values: unknown) => {
        spies.insertValues(values);
        return {
          onDuplicateKeyUpdate: ({ set }: { set: unknown }) => {
            spies.duplicateSet(set);
            return Promise.resolve({ rowsAffected: 1 });
          },
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(selectQueue.shift() ?? []),
        }),
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

describe("upsertPeopleFromCandidates", () => {
  it("normalizes and upserts durable candidates", async () => {
    const existing = makePerson();
    const { db, spies } = makePeopleDb([[existing]]);

    await expect(
      upsertPeopleFromCandidates(db, {
        clerkOrgId: "org_test",
        candidates: [
          {
            displayName: "Jeevan Pillay",
            identityProvider: "x",
            identityType: "profile_url",
            identityValue: "https://x.com/JeevanP",
            metadata: { confidence: 0.91 },
          },
        ],
        sourceSignalId: "sig_source",
      })
    ).resolves.toEqual([existing]);

    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        displayName: "Jeevan Pillay",
        identityProvider: "x",
        identityType: "handle",
        identityValue: "https://x.com/JeevanP",
        normalizedIdentityValue: "jeevanp",
        firstSeenSignalId: "sig_source",
        lastSeenSignalId: "sig_source",
        seenCount: 1,
      })
    );
    expect(spies.duplicateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSeenSignalId: "sig_source",
      })
    );
  });

  it("skips candidates that cannot be normalized", async () => {
    const { db, spies } = makePeopleDb([]);

    await expect(
      upsertPeopleFromCandidates(db, {
        clerkOrgId: "org_test",
        candidates: [
          {
            identityProvider: "website",
            identityType: "handle",
            identityValue: "not durable",
            metadata: { confidence: 0.1 },
          },
        ],
        sourceSignalId: "sig_source",
      })
    ).resolves.toEqual([]);

    expect(spies.insertValues).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run People tests and verify RED**

Run:

```bash
pnpm --filter @db/app test -- src/utils/people.test.ts
```

Expected: FAIL with a module resolution error for `./people`.

- [ ] **Step 3: Implement People upsert helper**

Create `db/app/src/utils/people.ts`:

```ts
import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../client";
import { people, type Person, type PersonIdentityProvider, type PersonIdentityType } from "../schema";
import {
  createPersonIdentityKey,
  normalizePersonIdentityCandidate,
} from "./people-identities";

export interface UpsertPeopleCandidate {
  displayName?: string;
  identityProvider: PersonIdentityProvider;
  identityType: PersonIdentityType;
  identityValue: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertPeopleFromCandidatesInput {
  clerkOrgId: string;
  candidates: UpsertPeopleCandidate[];
  sourceSignalId: string;
}

export async function upsertPeopleFromCandidates(
  db: Database,
  input: UpsertPeopleFromCandidatesInput
): Promise<Person[]> {
  const rows: Person[] = [];

  for (const candidate of input.candidates) {
    const normalized = normalizePersonIdentityCandidate(candidate);
    if (!normalized) {
      continue;
    }

    const identityKey = createPersonIdentityKey(normalized);
    const displayName = candidate.displayName?.trim() || null;
    const metadata = candidate.metadata ?? {};

    await db
      .insert(people)
      .values({
        clerkOrgId: input.clerkOrgId,
        displayName,
        identityProvider: normalized.identityProvider,
        identityType: normalized.identityType,
        identityValue: candidate.identityValue,
        normalizedIdentityValue: normalized.normalizedIdentityValue,
        identityKey,
        firstSeenSignalId: input.sourceSignalId,
        lastSeenSignalId: input.sourceSignalId,
        seenCount: 1,
        metadata,
      })
      .onDuplicateKeyUpdate({
        set: {
          displayName: sql`COALESCE(${displayName}, ${people.displayName})`,
          lastSeenSignalId: input.sourceSignalId,
          metadata,
          seenCount: sql`CASE WHEN ${people.lastSeenSignalId} = ${input.sourceSignalId} THEN ${people.seenCount} ELSE ${people.seenCount} + 1 END`,
          updatedAt: sql`CURRENT_TIMESTAMP(3)`,
        },
      });

    const row = await getPersonByIdentityKey(db, {
      clerkOrgId: input.clerkOrgId,
      identityKey,
    });
    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

export async function getPersonByIdentityKey(
  db: Database,
  input: { clerkOrgId: string; identityKey: string }
): Promise<Person | undefined> {
  const [row] = await db
    .select()
    .from(people)
    .where(
      and(
        eq(people.clerkOrgId, input.clerkOrgId),
        eq(people.identityKey, input.identityKey)
      )
    )
    .limit(1);
  return row;
}
```

- [ ] **Step 4: Export People helpers from `@db/app`**

In `db/app/src/index.ts`, add:

```ts
export {
  getPersonByIdentityKey,
  type UpsertPeopleCandidate,
  type UpsertPeopleFromCandidatesInput,
  upsertPeopleFromCandidates,
} from "./utils/people";
```

- [ ] **Step 5: Run People helper tests and verify GREEN**

Run:

```bash
pnpm --filter @db/app test -- src/utils/people.test.ts
```

Expected: PASS.

- [ ] **Step 6: Generate the Drizzle migration**

Run:

```bash
pnpm --filter @db/app db:generate
```

Expected: a new migration under `db/app/src/migrations/` that creates `lightfast_people`, `people_public_id_uq`, `people_org_identity_key_uq`, and `people_org_created_idx`.

- [ ] **Step 7: Run db typecheck**

Run:

```bash
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```bash
git add db/app/src/utils/people.ts db/app/src/utils/people.test.ts db/app/src/index.ts db/app/src/migrations
git commit -m "feat(db): upsert people from durable identities"
```

---

## Task 7: Add People Classification Workflow

**Files:**
- Modify: `api/app/src/inngest/schemas/app.ts`
- Create: `api/app/src/inngest/workflow/classify-people.ts`
- Modify: `api/app/src/inngest/index.ts`
- Create: `api/app/src/__tests__/people-workflow.test.ts`

- [ ] **Step 1: Write failing people workflow tests**

Create `api/app/src/__tests__/people-workflow.test.ts`:

```ts
import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignalByPublicIdMock = vi.fn();
const upsertPeopleFromCandidatesMock = vi.fn();
const buildPeopleClassificationRequestMock = vi.fn();
const classifyPeopleFromSignalMock = vi.fn();
const getPeopleClassificationFailureMock = vi.fn();
const logWarnMock = vi.fn();
const db = { kind: "mock-db" } as unknown as Database;

type WorkflowCallback = (input: {
  event: {
    data: {
      clerkOrgId: string;
      signalId: string;
    };
  };
  step: ReturnType<typeof createStep>;
}) => Promise<unknown>;

type WorkflowFailureCallback = (input: {
  error: Error;
  event: {
    data: {
      event: {
        data: {
          clerkOrgId: string;
          signalId: string;
        };
      };
    };
  };
}) => Promise<unknown>;

let workflowCallback: WorkflowCallback | undefined;
let workflowFailureCallback: WorkflowFailureCallback | undefined;
const createFunctionMock = vi.fn(
  (
    config: { onFailure?: WorkflowFailureCallback },
    _trigger: unknown,
    handler: WorkflowCallback
  ): { id: string } => {
    workflowCallback = handler;
    workflowFailureCallback = config.onFailure;
    return { id: "classify-people" };
  }
);

vi.mock("@db/app", () => ({
  getSignalByPublicId: getSignalByPublicIdMock,
  upsertPeopleFromCandidates: upsertPeopleFromCandidatesMock,
}));

vi.mock("@db/app/client", () => ({ db }));

vi.mock("@repo/ai/people-classifier", () => ({
  buildPeopleClassificationRequest: buildPeopleClassificationRequestMock,
  classifyPeopleFromSignal: classifyPeopleFromSignalMock,
  getPeopleClassificationFailure: getPeopleClassificationFailureMock,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    warn: logWarnMock,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../env", () => ({
  env: {
    VERCEL_ENV: "development",
  },
}));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

const signalId = "sig_123e4567-e89b-12d3-a456-426614174000";
const signalClassification = {
  schemaVersion: "signal.classification.v1",
  disposition: "actionable",
  title: "Engage profile",
  summary: "The signal includes an X profile.",
  kind: "engage",
  nextAction: "Review the X profile.",
  priority: "normal",
  rationale: "The signal has a social identity.",
  confidence: 0.9,
  routing: {
    classifyPeople: {
      shouldRun: true,
      rationale: "The input includes https://x.com/jeevanp.",
    },
  },
};
const signal = {
  id: 1,
  publicId: signalId,
  clerkOrgId: "org_test",
  input: "Interesting post by https://x.com/jeevanp",
  status: "classified",
  classification: signalClassification,
};
const peopleClassification = {
  schemaVersion: "people.classification.v1",
  candidates: [
    {
      displayName: "Jeevan Pillay",
      identityProvider: "x",
      identityType: "handle",
      identityValue: "@jeevanp",
      rationale: "The signal includes a durable X handle.",
      confidence: 0.91,
    },
  ],
};

const { classifyPeople } = await import("../inngest/workflow/classify-people");

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
    ai: {
      wrap: vi.fn(
        <T>(
          _name: string,
          fn: (request: Record<string, unknown>) => T | Promise<T>,
          request: Record<string, unknown>
        ) => fn(request)
      ),
    },
  };
}

function runWorkflow(step: ReturnType<typeof createStep>) {
  if (!workflowCallback) {
    throw new Error("workflow callback was not registered");
  }

  return workflowCallback({
    event: {
      data: {
        clerkOrgId: "org_test",
        signalId,
      },
    },
    step,
  });
}

beforeEach(() => {
  getSignalByPublicIdMock.mockReset();
  upsertPeopleFromCandidatesMock.mockReset();
  buildPeopleClassificationRequestMock.mockReset();
  classifyPeopleFromSignalMock.mockReset();
  getPeopleClassificationFailureMock.mockReset();
  logWarnMock.mockReset();

  getSignalByPublicIdMock.mockResolvedValue(signal);
  upsertPeopleFromCandidatesMock.mockResolvedValue([{ publicId: "person_1" }]);
  buildPeopleClassificationRequestMock.mockReturnValue({
    clerkOrgId: "org_test",
    deploymentEnvironment: "development",
    inputLength: signal.input.length,
    model: "openai/gpt-5.4-nano",
    prompt: "Extract durable people candidates",
    signalId,
    system: "You are the Lightfast people classifier.",
  });
  classifyPeopleFromSignalMock.mockResolvedValue(peopleClassification);
  getPeopleClassificationFailureMock.mockImplementation((error: unknown) => ({
    errorCode: "PEOPLE_CLASSIFICATION_FAILED",
    errorMessage: error instanceof Error ? error.message : String(error),
  }));
});

describe("classifyPeople", () => {
  it("registers the people classifier function", () => {
    expect(classifyPeople).toEqual({ id: "classify-people" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "classify-people",
        idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId',
        onFailure: expect.any(Function),
        retries: 3,
      },
      { event: "app/people.classification.requested" },
      expect.any(Function)
    );
  });

  it("classifies people from a classified signal and upserts candidates", async () => {
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      people: 1,
      status: "classified",
    });

    expect(getSignalByPublicIdMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      publicId: signalId,
    });
    expect(buildPeopleClassificationRequestMock).toHaveBeenCalledWith({
      classification: signalClassification,
      clerkOrgId: "org_test",
      deploymentEnvironment: "development",
      input: signal.input,
      signalId,
    });
    expect(classifyPeopleFromSignalMock).toHaveBeenCalledWith(
      expect.objectContaining({ clerkOrgId: "org_test", signalId }),
      expect.objectContaining({ logger: expect.any(Object) })
    );
    expect(upsertPeopleFromCandidatesMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      candidates: [
        {
          displayName: "Jeevan Pillay",
          identityProvider: "x",
          identityType: "handle",
          identityValue: "@jeevanp",
          metadata: {
            confidence: 0.91,
            rationale: "The signal includes a durable X handle.",
            source: "people.classification.v1",
          },
        },
      ],
      sourceSignalId: signalId,
    });
  });

  it("returns missing when the source signal is gone", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce(undefined);

    await expect(runWorkflow(step)).resolves.toEqual({ status: "missing" });

    expect(step.ai.wrap).not.toHaveBeenCalled();
    expect(upsertPeopleFromCandidatesMock).not.toHaveBeenCalled();
  });

  it("skips signals that are not classified", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce({
      ...signal,
      status: "processing",
      classification: null,
    });

    await expect(runWorkflow(step)).resolves.toEqual({ status: "skipped" });

    expect(step.ai.wrap).not.toHaveBeenCalled();
    expect(upsertPeopleFromCandidatesMock).not.toHaveBeenCalled();
  });

  it("lets AI failures bubble for Inngest retries", async () => {
    const step = createStep();
    classifyPeopleFromSignalMock.mockRejectedValueOnce(new Error("model unavailable"));

    await expect(runWorkflow(step)).rejects.toThrow("model unavailable");

    expect(upsertPeopleFromCandidatesMock).not.toHaveBeenCalled();
  });

  it("logs exhausted failures without marking the signal failed", async () => {
    if (!workflowFailureCallback) {
      throw new Error("workflow failure callback was not registered");
    }

    await expect(
      workflowFailureCallback({
        error: new Error("model unavailable"),
        event: {
          data: {
            event: {
              data: {
                clerkOrgId: "org_test",
                signalId,
              },
            },
          },
        },
      })
    ).resolves.toEqual({ status: "failed" });

    expect(logWarnMock).toHaveBeenCalledWith(
      "[people] classification exhausted retries",
      expect.objectContaining({
        clerkOrgId: "org_test",
        errorCode: "PEOPLE_CLASSIFICATION_FAILED",
        signalId,
      })
    );
  });
});
```

- [ ] **Step 2: Run people workflow tests and verify RED**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/people-workflow.test.ts
```

Expected: FAIL with a module resolution error for `../inngest/workflow/classify-people`.

- [ ] **Step 3: Add the people Inngest event schema**

In `api/app/src/inngest/schemas/app.ts`, add this event:

```ts
  "app/people.classification.requested": z.object({
    signalId: signalIdSchema,
    clerkOrgId: z.string().min(1),
  }),
```

- [ ] **Step 4: Implement the people workflow**

Create `api/app/src/inngest/workflow/classify-people.ts`:

```ts
import { getSignalByPublicId, upsertPeopleFromCandidates } from "@db/app";
import { db } from "@db/app/client";
import {
  buildPeopleClassificationRequest,
  classifyPeopleFromSignal,
  getPeopleClassificationFailure,
} from "@repo/ai/people-classifier";
import { log } from "@vendor/observability/log/next";

import { env } from "../../env";
import { inngest } from "../client";

export const classifyPeople = inngest.createFunction(
  {
    id: "classify-people",
    idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId',
    retries: 3,
    onFailure: async ({ event, error }) => {
      const { clerkOrgId, signalId } = event.data.event.data;
      const failure = getPeopleClassificationFailure(error);

      log.warn("[people] classification exhausted retries", {
        clerkOrgId,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        signalId,
      });

      return { status: "failed" };
    },
  },
  { event: "app/people.classification.requested" },
  async ({ event, step }) => {
    const { clerkOrgId, signalId } = event.data;

    const signal = await step.run("load signal", () =>
      getSignalByPublicId(db, {
        clerkOrgId,
        publicId: signalId,
      })
    );

    if (!signal) {
      return { status: "missing" };
    }

    if (signal.status !== "classified" || !signal.classification) {
      return { status: "skipped" };
    }

    const classificationRequest = buildPeopleClassificationRequest({
      classification: signal.classification,
      clerkOrgId,
      deploymentEnvironment: env.VERCEL_ENV,
      input: signal.input,
      signalId,
    });
    const classification = await step.ai.wrap(
      "classify people",
      (request) => classifyPeopleFromSignal(request, { logger: log }),
      classificationRequest
    );

    const people = await step.run("upsert people", () =>
      upsertPeopleFromCandidates(db, {
        clerkOrgId,
        candidates: classification.candidates.map((candidate) => ({
          displayName: candidate.displayName,
          identityProvider: candidate.identityProvider,
          identityType: candidate.identityType,
          identityValue: candidate.identityValue,
          metadata: {
            confidence: candidate.confidence,
            rationale: candidate.rationale,
            source: classification.schemaVersion,
          },
        })),
        sourceSignalId: signalId,
      })
    );

    return { people: people.length, status: "classified" };
  }
);
```

- [ ] **Step 5: Register the workflow**

In `api/app/src/inngest/index.ts`, import and register `classifyPeople`:

```ts
import { classifyPeople } from "./workflow/classify-people";
import { classifySignal } from "./workflow/classify-signal";
```

and:

```ts
    functions: [classifySignal, classifyPeople],
```

- [ ] **Step 6: Run people workflow tests and verify GREEN**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/people-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 7**

```bash
git add api/app/src/inngest/schemas/app.ts api/app/src/inngest/workflow/classify-people.ts api/app/src/inngest/index.ts api/app/src/__tests__/people-workflow.test.ts
git commit -m "feat(api): add people classification workflow"
```

---

## Task 8: Route Signal Classifications Into People Classification

**Files:**
- Modify: `api/app/src/inngest/workflow/classify-signal.ts`
- Modify: `api/app/src/__tests__/signal-workflow.test.ts`

- [ ] **Step 1: Add failing signal workflow routing tests**

In `api/app/src/__tests__/signal-workflow.test.ts`, update the mocked Inngest client to include `send`:

```ts
const sendMock = vi.fn();
```

and:

```ts
vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
    send: sendMock,
  },
}));
```

Reset it in `beforeEach`:

```ts
  sendMock.mockReset();
  sendMock.mockResolvedValue(undefined);
```

Add routing to `classification`:

```ts
  routing: {
    classifyPeople: {
      shouldRun: true,
      rationale: "The signal contains a durable social identity.",
    },
  },
```

Update the existing happy-path expectation from:

```ts
    await expect(runWorkflow(step)).resolves.toEqual({ status: "classified" });
```

to:

```ts
    await expect(runWorkflow(step)).resolves.toEqual({
      status: "classified",
      routedPeople: true,
    });
```

Add this assertion to the existing happy-path test after `markSignalClassifiedMock`:

```ts
    expect(sendMock).toHaveBeenCalledWith({
      name: "app/people.classification.requested",
      data: {
        clerkOrgId: "org_test",
        signalId,
      },
    });
```

Add these tests:

```ts
  it("does not queue people classification when routing is absent", async () => {
    const step = createStep();
    classifySignalInputMock.mockResolvedValueOnce({
      ...classification,
      routing: undefined,
    });

    await expect(runWorkflow(step)).resolves.toEqual({
      status: "classified",
      routedPeople: false,
    });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("queues people classification when a retry sees an already classified signal", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce({
      ...signal,
      status: "classified",
      classification,
    });

    await expect(runWorkflow(step)).resolves.toEqual({
      status: "classified",
      routedPeople: true,
    });

    expect(claimSignalForClassificationMock).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith({
      name: "app/people.classification.requested",
      data: {
        clerkOrgId: "org_test",
        signalId,
      },
    });
  });
```

- [ ] **Step 2: Run signal workflow tests and verify RED**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-workflow.test.ts
```

Expected: FAIL because `classify-signal` does not call `inngest.send`.

- [ ] **Step 3: Add a routing helper in the signal workflow**

In `api/app/src/inngest/workflow/classify-signal.ts`, add this helper above `export const classifySignal`:

```ts
function shouldClassifyPeople(
  classification: { routing?: { classifyPeople?: { shouldRun?: boolean } } } | null
): boolean {
  return classification?.routing?.classifyPeople?.shouldRun === true;
}
```

- [ ] **Step 4: Handle already-classified retry path**

In `classify-signal.ts`, after the missing signal check and before `claimSignalForClassification`, add:

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
        return { status: "classified", routedPeople: true };
      }

      return { status: "classified", routedPeople: false };
    }
```

- [ ] **Step 5: Queue people classification after persistence**

In `classify-signal.ts`, after `if (!persisted) { return { status: "skipped" }; }`, add:

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

      return { status: "classified", routedPeople: true };
    }

    return { status: "classified", routedPeople: false };
```

Remove the old final line:

```ts
    return { status: "classified" };
```

- [ ] **Step 6: Run signal workflow tests and verify GREEN**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 8**

```bash
git add api/app/src/inngest/workflow/classify-signal.ts api/app/src/__tests__/signal-workflow.test.ts
git commit -m "feat(api): route signals to people classification"
```

---

## Task 9: Full Verification

**Files:**
- No new files.
- Verify all files touched in Tasks 1-8.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @repo/api-contract test -- src/__tests__/signals.test.ts
pnpm --filter @repo/ai test -- src/_internal/object-classification/run-object-classification.test.ts src/signal-classifier/classify.test.ts src/people-classifier/classify.test.ts
pnpm --filter @db/app test -- src/utils/people.test.ts
pnpm --filter @api/app test -- src/__tests__/signal-workflow.test.ts src/__tests__/people-workflow.test.ts
```

Expected: all commands PASS.

- [ ] **Step 2: Run typechecks for touched packages**

Run:

```bash
pnpm --filter @repo/api-contract typecheck
pnpm --filter @repo/ai typecheck
pnpm --filter @db/app typecheck
pnpm --filter @api/app typecheck
```

Expected: all commands PASS.

- [ ] **Step 3: Run repository quality gate**

Run:

```bash
pnpm check && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Inspect generated schema changes**

Run:

```bash
git diff -- db/app/src/migrations db/app/src/schema/tables/people.ts db/app/src/schema/tables/index.ts
```

Expected: the diff only adds `lightfast_people`, its unique indexes, and its org-created index. No existing table is dropped or renamed.

- [ ] **Step 5: Commit final verification note if any generated files changed after prior commits**

If Step 4 shows unstaged migration metadata or lockfile updates caused by earlier package dependency changes, commit only those files:

```bash
git add db/app/src/migrations ai/package.json pnpm-lock.yaml
git commit -m "chore: finalize people classification integration"
```

Expected: the commit includes only generated migration metadata or dependency metadata not already committed by earlier tasks.
