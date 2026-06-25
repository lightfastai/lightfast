# Signal Entity Links AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the AI-first Signal Entity Links extraction pipeline: deterministic extraction, AI extraction, live Inngest wiring, and tests, with no persistence or UI changes.

**Architecture:** Mirror the existing `@repo/ai/signal-classifier` and `@repo/ai/people-classifier` structure with a new `@repo/ai/signal-entity-linker` capability. The capability combines deterministic candidates with AI-generated explicit person mentions, validates anchors, and returns counts through a no-persistence `index-signal-entities` workflow. `classify-signal` queues entity indexing after successful classification for non-needs-review signals.

**Tech Stack:** TypeScript, Zod, Vitest, AI SDK via `@vendor/ai`, Inngest, pnpm/Turborepo.

---

## File Structure

- Create `ai/src/signal-entity-linker/schema.ts`: Zod schemas and exported types for entity-link candidates and model output.
- Create `ai/src/signal-entity-linker/constants.ts`: model, telemetry, schema version, and failure constants.
- Create `ai/src/signal-entity-linker/prompt.ts`: system prompt for explicit person-reference extraction.
- Create `ai/src/signal-entity-linker/errors.ts`: durable error-code mapping for provider, invalid-output, timeout, and generic failures.
- Create `ai/src/signal-entity-linker/extract.ts`: deterministic extractor, anchor validation, and deterministic/AI candidate merge helpers.
- Create `ai/src/signal-entity-linker/classify.ts`: request builder and AI classifier wrapper using the shared object-classification runner.
- Create `ai/src/signal-entity-linker/index.ts`: public exports.
- Modify `ai/src/_internal/agent-graphs/signal-intake.ts`: add `signalEntityLinker` node.
- Modify `ai/package.json`: export `./signal-entity-linker`.
- Add tests under `ai/src/__tests__/signal-entity-linker/`.
- Modify `ai/src/__tests__/_internal/agent-graphs/signal-intake.test.ts` and `ai/src/__tests__/telemetry/metadata.test.ts`.
- Modify `api/app/src/inngest/schemas/app.ts`: add `app/signal.entity-index.requested`.
- Create `api/app/src/inngest/workflow/index-signal-entities.ts`: no-persistence extraction workflow.
- Add `api/app/src/__tests__/entity-index-workflow.test.ts`.
- Modify `api/app/src/inngest/workflow/classify-signal.ts`: queue entity indexing after classification.
- Modify `api/app/src/__tests__/signal-workflow.test.ts`: assert entity-index event behavior.
- Modify `api/app/src/inngest/index.ts` and `api/app/src/__tests__/inngest-route.test.ts`: register the new workflow.

## Task 1: Add Signal Entity Linker Schemas And Graph Node

**Files:**
- Create: `ai/src/signal-entity-linker/schema.ts`
- Create: `ai/src/signal-entity-linker/constants.ts`
- Create: `ai/src/signal-entity-linker/index.ts`
- Modify: `ai/src/_internal/agent-graphs/signal-intake.ts`
- Modify: `ai/package.json`
- Test: `ai/src/__tests__/signal-entity-linker/schema.test.ts`
- Test: `ai/src/__tests__/_internal/agent-graphs/signal-intake.test.ts`
- Test: `ai/src/__tests__/telemetry/metadata.test.ts`

- [ ] **Step 1: Write failing schema and graph tests**

Create `ai/src/__tests__/signal-entity-linker/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  SIGNAL_ENTITY_LINKS_SCHEMA_VERSION,
  signalEntityLinkCandidateModelSchema,
  signalEntityLinkCandidateSchema,
  signalEntityLinkingModelSchema,
  signalEntityLinkingSchema,
} from "../../signal-entity-linker";

describe("signal entity linker schema", () => {
  it("accepts explicit person candidates from deterministic and AI extractors", () => {
    expect(
      signalEntityLinkCandidateSchema.parse({
        targetType: "person",
        localEntityKey: "person_1",
        label: "Jordi",
        mentionKind: "name",
        anchorText: "Jordi",
        anchorOccurrence: 1,
        extractionMethod: "ai",
        rationale: "Jordi appears as a person to talk with.",
        confidence: 0.74,
      })
    ).toEqual({
      targetType: "person",
      localEntityKey: "person_1",
      label: "Jordi",
      mentionKind: "name",
      anchorText: "Jordi",
      anchorOccurrence: 1,
      extractionMethod: "ai",
      rationale: "Jordi appears as a person to talk with.",
      confidence: 0.74,
    });
  });

  it("stamps the public result schema version in application code", () => {
    expect(
      signalEntityLinkingSchema.parse({
        schemaVersion: SIGNAL_ENTITY_LINKS_SCHEMA_VERSION,
        candidates: [
          {
            targetType: "person",
            localEntityKey: "person_1",
            label: "jordi@doccy.com.au",
            mentionKind: "email",
            anchorText: "jordi@doccy.com.au",
            anchorOccurrence: 1,
            extractionMethod: "deterministic",
            rationale: "Email address matched deterministic extractor.",
            confidence: 1,
          },
        ],
      })
    ).toMatchObject({
      schemaVersion: "signal.entity-links.v1",
      candidates: [{ extractionMethod: "deterministic" }],
    });
  });

  it("uses a model-facing schema without extractionMethod or schemaVersion", () => {
    expect(
      signalEntityLinkCandidateModelSchema.parse({
        targetType: "person",
        localEntityKey: "person_1",
        label: "Louie",
        mentionKind: "name",
        anchorText: "Louie",
        anchorOccurrence: 1,
        rationale: "Louie appears as a person to connect.",
        confidence: 0.76,
      })
    ).toEqual({
      targetType: "person",
      localEntityKey: "person_1",
      label: "Louie",
      mentionKind: "name",
      anchorText: "Louie",
      anchorOccurrence: 1,
      rationale: "Louie appears as a person to connect.",
      confidence: 0.76,
    });

    expect(
      signalEntityLinkingModelSchema.parse({
        candidates: [
          {
            targetType: "person",
            localEntityKey: "person_1",
            label: "Louie",
            mentionKind: "name",
            anchorText: "Louie",
            anchorOccurrence: 1,
            rationale: "Louie appears as a person to connect.",
            confidence: 0.76,
          },
        ],
      })
    ).toMatchObject({ candidates: [{ label: "Louie" }] });
  });

  it("rejects unsupported entity types and creative local entity keys", () => {
    expect(() =>
      signalEntityLinkCandidateSchema.parse({
        targetType: "project",
        localEntityKey: "person_1",
        label: "Doccy onboarding",
        mentionKind: "name",
        anchorText: "Doccy onboarding",
        anchorOccurrence: 1,
        extractionMethod: "ai",
        rationale: "Projects are not part of v1.",
        confidence: 0.8,
      })
    ).toThrow();

    expect(() =>
      signalEntityLinkCandidateSchema.parse({
        targetType: "person",
        localEntityKey: "jordi",
        label: "Jordi",
        mentionKind: "name",
        anchorText: "Jordi",
        anchorOccurrence: 1,
        extractionMethod: "ai",
        rationale: "Invalid grouping token.",
        confidence: 0.8,
      })
    ).toThrow();
  });
});
```

Update `ai/src/__tests__/_internal/agent-graphs/signal-intake.test.ts` to expect the new node:

```ts
signalEntityLinker: {
  id: "signal-entity-linker",
  role: "extractor",
  schemaVersion: "signal.entity-links.v1",
  upstreamNodeIds: ["signal-classifier"],
},
```

Update `ai/src/__tests__/telemetry/metadata.test.ts` by adding `signalEntityLinker` to the test graph and asserting metadata:

```ts
signalEntityLinker: {
  feature: "entity-links",
  id: "signal-entity-linker",
  kind: "llm",
  promptId: "signal-entity-linker",
  role: "extractor",
  schemaVersion: "signal.entity-links.v1",
  upstreamNodeIds: ["signal-classifier"],
  workflow: "index-signal-entities",
},
```

Expected metadata assertion:

```ts
expect(
  createAgentNodeMetadata(graph, graph.nodes.signalEntityLinker, {
    agentRunId: "sig_123",
    clerkOrgId: "org_test",
    deploymentEnvironment: "production",
    inputLength: 42,
  })
).toEqual({
  agentGraphId: "signal-intake",
  agentGraphVersion: "v1",
  agentRunId: "sig_123",
  clerkOrgId: "org_test",
  deploymentEnvironment: "production",
  feature: "entity-links",
  inputLength: 42,
  nodeId: "signal-entity-linker",
  nodeKind: "llm",
  nodeRole: "extractor",
  promptId: "signal-entity-linker",
  routerId: "signals",
  schemaVersion: "signal.entity-links.v1",
  upstreamNodeId: "signal-classifier",
  workflow: "index-signal-entities",
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/signal-entity-linker/schema.test.ts src/__tests__/_internal/agent-graphs/signal-intake.test.ts src/__tests__/telemetry/metadata.test.ts
```

Expected: FAIL because `../../signal-entity-linker` and `signalEntityLinker` do not exist.

- [ ] **Step 3: Implement schema, constants, exports, package export, and graph node**

Create `ai/src/signal-entity-linker/schema.ts`:

```ts
import { z } from "zod";

import { SIGNAL_ENTITY_LINKS_SCHEMA_VERSION } from "./constants";

export const signalEntityTargetTypeSchema = z.enum(["person"]);
export const signalEntityMentionKindSchema = z.enum([
  "name",
  "email",
  "handle",
  "profile_url",
]);
export const signalEntityExtractionMethodSchema = z.enum([
  "deterministic",
  "ai",
]);
export const signalEntityLocalEntityKeySchema = z
  .string()
  .regex(/^person_[1-9][0-9]*$/, "Invalid local entity key");

export const signalEntityLinkCandidateSchema = z.object({
  targetType: signalEntityTargetTypeSchema,
  localEntityKey: signalEntityLocalEntityKeySchema,
  label: z.string().trim().min(1).max(160),
  mentionKind: signalEntityMentionKindSchema,
  anchorText: z.string().trim().min(1).max(240),
  anchorOccurrence: z.number().int().positive().max(100),
  extractionMethod: signalEntityExtractionMethodSchema,
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
});

export const signalEntityLinkingSchema = z.object({
  schemaVersion: z.literal(SIGNAL_ENTITY_LINKS_SCHEMA_VERSION),
  candidates: z.array(signalEntityLinkCandidateSchema).max(10),
});

export const signalEntityLinkCandidateModelSchema =
  signalEntityLinkCandidateSchema.omit({ extractionMethod: true });

export const signalEntityLinkingModelSchema = z.object({
  candidates: z.array(signalEntityLinkCandidateModelSchema).max(10),
});

export type SignalEntityTargetType = z.infer<
  typeof signalEntityTargetTypeSchema
>;
export type SignalEntityMentionKind = z.infer<
  typeof signalEntityMentionKindSchema
>;
export type SignalEntityExtractionMethod = z.infer<
  typeof signalEntityExtractionMethodSchema
>;
export type SignalEntityLinkCandidate = z.infer<
  typeof signalEntityLinkCandidateSchema
>;
export type SignalEntityLinking = z.infer<typeof signalEntityLinkingSchema>;
export type SignalEntityLinkCandidateModelOutput = z.infer<
  typeof signalEntityLinkCandidateModelSchema
>;
export type SignalEntityLinkingModelOutput = z.infer<
  typeof signalEntityLinkingModelSchema
>;
```

Create `ai/src/signal-entity-linker/constants.ts`:

```ts
import { signalIntakeAgentGraph } from "../_internal/agent-graphs/signal-intake";

const signalEntityLinkerNode = signalIntakeAgentGraph.nodes.signalEntityLinker;

export const SIGNAL_ENTITY_LINKS_SCHEMA_VERSION =
  signalEntityLinkerNode.schemaVersion;
export const SIGNAL_ENTITY_LINKER_MAX_OUTPUT_TOKENS = 768;
export const SIGNAL_ENTITY_LINKER_MODEL = "openai/gpt-5.4-nano";
export const SIGNAL_ENTITY_LINKER_FEATURE = signalEntityLinkerNode.feature;
export const SIGNAL_ENTITY_LINKER_PROMPT_ID = signalEntityLinkerNode.promptId;
export const SIGNAL_ENTITY_LINKER_WORKFLOW = signalEntityLinkerNode.workflow;
export const SIGNAL_ENTITY_LINKER_TELEMETRY_FUNCTION_ID =
  "app.inngest.index-signal-entities";
export const SIGNAL_ENTITY_LINKER_TIMEOUT_MS = 30_000;

export const SIGNAL_ENTITY_LINKING_FAILED_ERROR_CODE =
  "SIGNAL_ENTITY_LINKING_FAILED";
export const SIGNAL_ENTITY_LINKING_PROVIDER_ERROR_CODE =
  "SIGNAL_ENTITY_LINKING_PROVIDER_ERROR";
export const SIGNAL_ENTITY_LINKING_INVALID_OUTPUT_ERROR_CODE =
  "SIGNAL_ENTITY_LINKING_INVALID_OUTPUT";
export const SIGNAL_ENTITY_LINKING_TIMEOUT_ERROR_CODE =
  "SIGNAL_ENTITY_LINKING_TIMEOUT";

export type SignalEntityLinkingFailureCode =
  | typeof SIGNAL_ENTITY_LINKING_FAILED_ERROR_CODE
  | typeof SIGNAL_ENTITY_LINKING_PROVIDER_ERROR_CODE
  | typeof SIGNAL_ENTITY_LINKING_INVALID_OUTPUT_ERROR_CODE
  | typeof SIGNAL_ENTITY_LINKING_TIMEOUT_ERROR_CODE;
```

Create `ai/src/signal-entity-linker/index.ts`:

```ts
export * from "./constants";
export * from "./schema";
```

Modify `ai/src/_internal/agent-graphs/signal-intake.ts`:

```ts
signalEntityLinker: {
  feature: "entity-links",
  id: "signal-entity-linker",
  kind: "llm",
  promptId: "signal-entity-linker",
  role: "extractor",
  schemaVersion: "signal.entity-links.v1",
  upstreamNodeIds: ["signal-classifier"],
  workflow: "index-signal-entities",
},
```

Modify `ai/package.json` exports:

```json
"./signal-entity-linker": {
  "types": "./src/signal-entity-linker/index.ts",
  "default": "./src/signal-entity-linker/index.ts"
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/signal-entity-linker/schema.test.ts src/__tests__/_internal/agent-graphs/signal-intake.test.ts src/__tests__/telemetry/metadata.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ai/package.json ai/src/_internal/agent-graphs/signal-intake.ts ai/src/signal-entity-linker ai/src/__tests__/signal-entity-linker/schema.test.ts ai/src/__tests__/_internal/agent-graphs/signal-intake.test.ts ai/src/__tests__/telemetry/metadata.test.ts
git commit -m "feat: add signal entity linker schema"
```

## Task 2: Add Deterministic Extraction And Candidate Merge Helpers

**Files:**
- Create: `ai/src/signal-entity-linker/extract.ts`
- Modify: `ai/src/signal-entity-linker/index.ts`
- Test: `ai/src/__tests__/signal-entity-linker/extract.test.ts`

- [ ] **Step 1: Write failing deterministic extractor tests**

Create `ai/src/__tests__/signal-entity-linker/extract.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  extractDeterministicSignalEntityLinks,
  mergeSignalEntityLinkCandidates,
} from "../../signal-entity-linker";

describe("extractDeterministicSignalEntityLinks", () => {
  it("extracts email candidates with exact anchors", () => {
    expect(
      extractDeterministicSignalEntityLinks({
        input: "Email Jordi at jordi@doccy.com.au.",
      })
    ).toEqual([
      {
        targetType: "person",
        localEntityKey: "person_1",
        label: "jordi@doccy.com.au",
        mentionKind: "email",
        anchorText: "jordi@doccy.com.au",
        anchorOccurrence: 1,
        extractionMethod: "deterministic",
        rationale: "Email address matched deterministic extractor.",
        confidence: 1,
      },
    ]);
  });

  it("extracts recognized person profile URLs", () => {
    expect(
      extractDeterministicSignalEntityLinks({
        input: "Review https://www.linkedin.com/in/JordiExample and https://x.com/archer.",
      })
    ).toEqual([
      expect.objectContaining({
        localEntityKey: "person_1",
        label: "https://www.linkedin.com/in/JordiExample",
        mentionKind: "profile_url",
        anchorOccurrence: 1,
      }),
      expect.objectContaining({
        localEntityKey: "person_2",
        label: "https://x.com/archer",
        mentionKind: "profile_url",
        anchorOccurrence: 1,
      }),
    ]);
  });

  it("extracts provider-obvious handles without treating emails as handles", () => {
    expect(
      extractDeterministicSignalEntityLinks({
        input: "DM @jordi but do not split jordi@doccy.com.au.",
      })
    ).toEqual([
      expect.objectContaining({
        label: "jordi@doccy.com.au",
        mentionKind: "email",
      }),
      expect.objectContaining({
        label: "@jordi",
        mentionKind: "handle",
      }),
    ]);
  });
});

describe("mergeSignalEntityLinkCandidates", () => {
  it("keeps deterministic candidates first, filters invalid anchors, and dedupes", () => {
    const deterministic = extractDeterministicSignalEntityLinks({
      input: "Email Jordi at jordi@doccy.com.au.",
    });

    expect(
      mergeSignalEntityLinkCandidates({
        aiCandidates: [
          {
            targetType: "person",
            localEntityKey: "person_1",
            label: "Jordi",
            mentionKind: "name",
            anchorText: "Jordi",
            anchorOccurrence: 1,
            extractionMethod: "ai",
            rationale: "Jordi appears as a person.",
            confidence: 0.8,
          },
          {
            targetType: "person",
            localEntityKey: "person_2",
            label: "Ghost",
            mentionKind: "name",
            anchorText: "Ghost",
            anchorOccurrence: 1,
            extractionMethod: "ai",
            rationale: "Ghost is not in the input.",
            confidence: 0.8,
          },
          deterministic[0],
        ],
        deterministicCandidates: deterministic,
        input: "Email Jordi at jordi@doccy.com.au.",
      })
    ).toEqual([
      deterministic[0],
      {
        targetType: "person",
        localEntityKey: "person_1",
        label: "Jordi",
        mentionKind: "name",
        anchorText: "Jordi",
        anchorOccurrence: 1,
        extractionMethod: "ai",
        rationale: "Jordi appears as a person.",
        confidence: 0.8,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/signal-entity-linker/extract.test.ts
```

Expected: FAIL because `extractDeterministicSignalEntityLinks` is not exported.

- [ ] **Step 3: Implement deterministic extractor and merge helpers**

Create `ai/src/signal-entity-linker/extract.ts`:

```ts
import type { SignalEntityLinkCandidate } from "./schema";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const HANDLE_PATTERN = /(^|[^\w@.])@[A-Z0-9_]{1,30}\b/gi;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')]+/gi;

export interface ExtractDeterministicSignalEntityLinksInput {
  input: string;
}

export interface MergeSignalEntityLinkCandidatesInput {
  aiCandidates: SignalEntityLinkCandidate[];
  deterministicCandidates: SignalEntityLinkCandidate[];
  input: string;
}

export function extractDeterministicSignalEntityLinks({
  input,
}: ExtractDeterministicSignalEntityLinksInput): SignalEntityLinkCandidate[] {
  const candidates: SignalEntityLinkCandidate[] = [];
  let localIndex = 1;

  for (const match of input.matchAll(EMAIL_PATTERN)) {
    const label = trimTrailingPunctuation(match[0]);
    candidates.push(
      createDeterministicCandidate({
        input,
        label,
        localEntityKey: `person_${localIndex++}`,
        matchIndex: match.index ?? 0,
        mentionKind: "email",
        rationale: "Email address matched deterministic extractor.",
      })
    );
  }

  for (const match of input.matchAll(URL_PATTERN)) {
    const label = trimTrailingPunctuation(match[0]);
    if (!isRecognizedPersonProfileUrl(label)) {
      continue;
    }
    candidates.push(
      createDeterministicCandidate({
        input,
        label,
        localEntityKey: `person_${localIndex++}`,
        matchIndex: match.index ?? 0,
        mentionKind: "profile_url",
        rationale: "Recognized person profile URL matched deterministic extractor.",
      })
    );
  }

  for (const match of input.matchAll(HANDLE_PATTERN)) {
    const label = match[0].trim().replace(/^[^\w@]+/, "");
    if (!label.startsWith("@")) {
      continue;
    }
    candidates.push(
      createDeterministicCandidate({
        input,
        label,
        localEntityKey: `person_${localIndex++}`,
        matchIndex: match.index ?? 0,
        mentionKind: "handle",
        rationale: "Provider-style handle matched deterministic extractor.",
      })
    );
  }

  return mergeSignalEntityLinkCandidates({
    aiCandidates: [],
    deterministicCandidates: candidates,
    input,
  });
}

export function mergeSignalEntityLinkCandidates({
  aiCandidates,
  deterministicCandidates,
  input,
}: MergeSignalEntityLinkCandidatesInput): SignalEntityLinkCandidate[] {
  const merged: SignalEntityLinkCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of [...deterministicCandidates, ...aiCandidates]) {
    if (!hasAnchorOccurrence(input, candidate.anchorText, candidate.anchorOccurrence)) {
      continue;
    }

    const key = [
      candidate.targetType,
      candidate.mentionKind,
      candidate.anchorText,
      candidate.anchorOccurrence,
    ].join("\0");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(candidate);

    if (merged.length >= 10) {
      break;
    }
  }

  return merged;
}

function createDeterministicCandidate(input: {
  input: string;
  label: string;
  localEntityKey: `person_${number}`;
  matchIndex: number;
  mentionKind: SignalEntityLinkCandidate["mentionKind"];
  rationale: string;
}): SignalEntityLinkCandidate {
  return {
    targetType: "person",
    localEntityKey: input.localEntityKey,
    label: input.label,
    mentionKind: input.mentionKind,
    anchorText: input.label,
    anchorOccurrence: getAnchorOccurrenceAtIndex(
      input.input,
      input.label,
      input.matchIndex
    ),
    extractionMethod: "deterministic",
    rationale: input.rationale,
    confidence: 1,
  };
}

function getAnchorOccurrenceAtIndex(
  input: string,
  anchorText: string,
  matchIndex: number
): number {
  let occurrence = 0;
  let index = input.indexOf(anchorText);
  while (index !== -1) {
    occurrence += 1;
    if (index >= matchIndex) {
      return occurrence;
    }
    index = input.indexOf(anchorText, index + anchorText.length);
  }
  return 1;
}

function hasAnchorOccurrence(
  input: string,
  anchorText: string,
  anchorOccurrence: number
): boolean {
  let occurrence = 0;
  let index = input.indexOf(anchorText);
  while (index !== -1) {
    occurrence += 1;
    if (occurrence === anchorOccurrence) {
      return true;
    }
    index = input.indexOf(anchorText, index + anchorText.length);
  }
  return false;
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:!?]+$/, "");
}

function isRecognizedPersonProfileUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (["x.com", "twitter.com", "github.com"].includes(host)) {
    return parts.length >= 1;
  }

  if (host === "linkedin.com") {
    return parts[0] === "in" && Boolean(parts[1]);
  }

  return false;
}
```

Modify `ai/src/signal-entity-linker/index.ts`:

```ts
export * from "./constants";
export * from "./extract";
export * from "./schema";
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/signal-entity-linker/extract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ai/src/signal-entity-linker/extract.ts ai/src/signal-entity-linker/index.ts ai/src/__tests__/signal-entity-linker/extract.test.ts
git commit -m "feat: add deterministic signal entity extraction"
```

## Task 3: Add AI Prompt, Error Mapping, And Classifier Wrapper

**Files:**
- Create: `ai/src/signal-entity-linker/prompt.ts`
- Create: `ai/src/signal-entity-linker/errors.ts`
- Create: `ai/src/signal-entity-linker/classify.ts`
- Modify: `ai/src/signal-entity-linker/index.ts`
- Test: `ai/src/__tests__/signal-entity-linker/classify.test.ts`

- [ ] **Step 1: Write failing classifier tests**

Create `ai/src/__tests__/signal-entity-linker/classify.test.ts`:

```ts
import { MockLanguageModelV3 } from "@vendor/ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSignalEntityLinkingRequest,
  classifySignalEntityLinks,
  getSignalEntityLinkingFailure,
  SIGNAL_ENTITY_LINKER_MODEL,
  SIGNAL_ENTITY_LINKER_PROMPT_ID,
  SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT,
  SIGNAL_ENTITY_LINKER_WORKFLOW,
  SIGNAL_ENTITY_LINKING_INVALID_OUTPUT_ERROR_CODE,
} from "../../signal-entity-linker";

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
};

const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";

const classification = {
  schemaVersion: "signal.classification.v2",
  disposition: "needs_context",
  title: "Discuss dev flow",
  summary: "Request to talk with Jordi and Archer about their development workflow.",
  kind: "follow_up",
  nextAction: "Ask Jordi and Archer about their dev flow.",
  priority: "normal",
  rationale: "The request lacks scope but contains person references.",
  confidence: 0.55,
  routing: {
    visibility: {
      scope: "user",
      rationale: "The signal is private to the creator.",
    },
    review: { required: false, reason: null, rationale: null },
    routes: {
      people: {
        shouldRun: false,
        confidence: 0.1,
        rationale: "No durable identity is present.",
      },
    },
  },
} as const;

const usage = {
  inputTokens: {
    total: 24,
    noCache: 24,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
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

describe("classifySignalEntityLinks", () => {
  it("builds a request with raw input, classification, and deterministic candidates", () => {
    const request = buildSignalEntityLinkingRequest({
      classification,
      clerkOrgId: "org_test",
      deploymentEnvironment: "development",
      deterministicCandidates: [
        {
          targetType: "person",
          localEntityKey: "person_1",
          label: "jordi@doccy.com.au",
          mentionKind: "email",
          anchorText: "jordi@doccy.com.au",
          anchorOccurrence: 1,
          extractionMethod: "deterministic",
          rationale: "Email address matched deterministic extractor.",
          confidence: 1,
        },
      ],
      input: "Email Jordi at jordi@doccy.com.au",
      signalId,
    });

    expect(SIGNAL_ENTITY_LINKER_MODEL).toBe("openai/gpt-5.4-nano");
    expect(SIGNAL_ENTITY_LINKER_WORKFLOW).toBe("index-signal-entities");
    expect(SIGNAL_ENTITY_LINKER_PROMPT_ID).toBe("signal-entity-linker");
    expect(request).toEqual(
      expect.objectContaining({
        clerkOrgId: "org_test",
        deploymentEnvironment: "development",
        inputLength: "Email Jordi at jordi@doccy.com.au".length,
        model: SIGNAL_ENTITY_LINKER_MODEL,
        signalId,
        system: SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT,
      })
    );
    expect(request.prompt).toContain("Email Jordi at jordi@doccy.com.au");
    expect(request.prompt).toContain("jordi@doccy.com.au");
    expect(request.prompt).toContain("Discuss dev flow");
  });

  it("uses structured output and stamps schema version plus ai extraction method", async () => {
    const model = createClassifierModel(
      JSON.stringify({
        candidates: [
          {
            targetType: "person",
            localEntityKey: "person_1",
            label: "Jordi",
            mentionKind: "name",
            anchorText: "Jordi",
            anchorOccurrence: 1,
            rationale: "Jordi appears as a person to talk with.",
            confidence: 0.74,
          },
        ],
      })
    );
    const request = {
      ...buildSignalEntityLinkingRequest({
        classification,
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        deterministicCandidates: [],
        input: "Talk to Jordi",
        signalId,
      }),
      model,
    };

    await expect(classifySignalEntityLinks(request, { logger })).resolves.toEqual({
      schemaVersion: "signal.entity-links.v1",
      candidates: [
        {
          targetType: "person",
          localEntityKey: "person_1",
          label: "Jordi",
          mentionKind: "name",
          anchorText: "Jordi",
          anchorOccurrence: 1,
          extractionMethod: "ai",
          rationale: "Jordi appears as a person to talk with.",
          confidence: 0.74,
        },
      ],
    });

    expect(logger.info).toHaveBeenCalledWith(
      "[entity-links] classification completed",
      expect.objectContaining({
        agentGraphId: "signal-intake",
        agentRunId: signalId,
        clerkOrgId: "org_test",
        deploymentEnvironment: "production",
        feature: "entity-links",
        nodeId: "signal-entity-linker",
        nodeKind: "llm",
        nodeRole: "extractor",
        promptId: "signal-entity-linker",
        routerId: "signals",
        signalId,
        upstreamNodeId: "signal-classifier",
        workflow: "index-signal-entities",
      })
    );
  });

  it("maps invalid output to a durable entity-linking failure code", async () => {
    const model = createClassifierModel(
      JSON.stringify({ candidates: [{ localEntityKey: "jordi" }] })
    );
    const request = {
      ...buildSignalEntityLinkingRequest({
        classification,
        clerkOrgId: "org_test",
        deploymentEnvironment: "preview",
        deterministicCandidates: [],
        input: "Talk to Jordi",
        signalId,
      }),
      model,
    };

    const failure = await classifySignalEntityLinks(request, { logger }).catch(
      (error) => getSignalEntityLinkingFailure(error)
    );

    expect(failure.errorCode).toBe(
      SIGNAL_ENTITY_LINKING_INVALID_OUTPUT_ERROR_CODE
    );
  });

  it("instructs the model to extract explicit names without inferring identities", () => {
    expect(SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT).toContain(
      "Name-only person references are allowed"
    );
    expect(SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT).toContain(
      "Do not extract role-only"
    );
    expect(SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT).toContain(
      "anchorText must be an exact substring"
    );
    expect(SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT).toContain("Do not browse");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/signal-entity-linker/classify.test.ts
```

Expected: FAIL because prompt, errors, and classify exports do not exist.

- [ ] **Step 3: Implement prompt, errors, and classifier wrapper**

Create `ai/src/signal-entity-linker/prompt.ts`:

```ts
export const SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT = `You are the Lightfast signal entity linker.

You receive one raw signal input, its persisted signal classification, and deterministic candidates already extracted by application code.
Your job is to extract additional explicit person references from the raw signal input.

Do not execute the action.
Do not browse the web.
Do not infer identities that are not present in the signal input.
Do not decide whether a person is confirmed.
Do not merge global People records.
Do not rewrite deterministic candidates.

In v1, extract only person references.
Name-only person references are allowed.
Extract explicit names, email addresses, provider handles, and person profile URLs.
Do not extract role-only or coreference-only references such as "the designer", "their CTO", "my manager", or "the person from Doccy".
Do not extract projects, companies, accounts, documents, or unsupported entity types.
Do not create a name candidate from inside an email address or URL unless that name appears separately as human-readable text in the input.

Every candidate must use targetType "person".
Every candidate must include localEntityKey matching /^person_[1-9][0-9]*$/.
Use the same localEntityKey for multiple candidates that refer to the same person inside this signal.
localEntityKey is scoped only to this signal and is not a database id.

Every candidate label and anchorText must come from the raw signal input.
Do not create candidates from names that appear only in the classification JSON.
anchorText must be an exact substring from the raw input.
anchorOccurrence is 1-based among exact anchorText matches in the raw input.

Return only references that a reasonable user would expect Lightfast to remember as people-related context.
Preserve uncertainty in rationale and confidence.
Return an empty candidates array when no person reference is present.`;
```

Create `ai/src/signal-entity-linker/errors.ts` by following the existing people classifier error mapper with entity-link constants:

```ts
import { APICallError, NoObjectGeneratedError, RetryError } from "@vendor/ai";

import {
  SIGNAL_ENTITY_LINKING_FAILED_ERROR_CODE,
  SIGNAL_ENTITY_LINKING_INVALID_OUTPUT_ERROR_CODE,
  SIGNAL_ENTITY_LINKING_PROVIDER_ERROR_CODE,
  SIGNAL_ENTITY_LINKING_TIMEOUT_ERROR_CODE,
  type SignalEntityLinkingFailureCode,
} from "./constants";

export interface SignalEntityLinkingFailure {
  errorCode: SignalEntityLinkingFailureCode;
  errorMessage: string;
}

export function getSignalEntityLinkingFailure(
  error: unknown
): SignalEntityLinkingFailure {
  const message = getErrorMessage(error);

  if (isTimeoutError(error)) {
    return {
      errorCode: SIGNAL_ENTITY_LINKING_TIMEOUT_ERROR_CODE,
      errorMessage: message,
    };
  }

  if (isInvalidOutputError(error)) {
    return {
      errorCode: SIGNAL_ENTITY_LINKING_INVALID_OUTPUT_ERROR_CODE,
      errorMessage: message,
    };
  }

  if (isProviderError(error)) {
    return {
      errorCode: SIGNAL_ENTITY_LINKING_PROVIDER_ERROR_CODE,
      errorMessage: message,
    };
  }

  return {
    errorCode: SIGNAL_ENTITY_LINKING_FAILED_ERROR_CODE,
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
    error instanceof Error && (error.name === name || error.name.includes(name))
  );
}

function hasCauseMatching(
  error: unknown,
  predicate: (error: unknown) => boolean
): boolean {
  if (!(error instanceof Error && "cause" in error)) {
    return false;
  }

  return predicate(error.cause);
}
```

Create `ai/src/signal-entity-linker/classify.ts`:

```ts
import "server-only";

import { createAgentNodeMetadata } from "@repo/ai/telemetry";
import type { SignalClassification } from "@repo/api-contract";
import type { LanguageModel } from "@vendor/ai";

import { signalIntakeAgentGraph } from "../_internal/agent-graphs/signal-intake";
import {
  type ObjectClassificationLogger,
  runObjectClassification,
} from "../_internal/object-classification/run-object-classification";
import {
  SIGNAL_ENTITY_LINKER_MAX_OUTPUT_TOKENS,
  SIGNAL_ENTITY_LINKER_MODEL,
  SIGNAL_ENTITY_LINKER_TELEMETRY_FUNCTION_ID,
  SIGNAL_ENTITY_LINKER_TIMEOUT_MS,
  SIGNAL_ENTITY_LINKS_SCHEMA_VERSION,
} from "./constants";
import { getSignalEntityLinkingFailure } from "./errors";
import { SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT } from "./prompt";
import {
  type SignalEntityLinkCandidate,
  type SignalEntityLinking,
  signalEntityLinkingModelSchema,
} from "./schema";

const noopLogger: ObjectClassificationLogger = {
  info: () => undefined,
  warn: () => undefined,
};

const signalEntityLinkerNode = signalIntakeAgentGraph.nodes.signalEntityLinker;

export type DeploymentEnvironment = "development" | "preview" | "production";

export interface SignalEntityLinkingRequest {
  classification: SignalClassification | null;
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  deterministicCandidates: SignalEntityLinkCandidate[];
  inputLength: number;
  model: LanguageModel;
  prompt: string;
  signalId: string;
  system: string;
}

export interface BuildSignalEntityLinkingRequestInput {
  classification: SignalClassification | null;
  clerkOrgId: string;
  deploymentEnvironment: DeploymentEnvironment;
  deterministicCandidates: SignalEntityLinkCandidate[];
  input: string;
  signalId: string;
}

export interface ClassifySignalEntityLinksOptions {
  logger?: ObjectClassificationLogger;
}

export function buildSignalEntityLinkingRequest({
  classification,
  clerkOrgId,
  deploymentEnvironment,
  deterministicCandidates,
  input,
  signalId,
}: BuildSignalEntityLinkingRequestInput): SignalEntityLinkingRequest {
  return {
    classification,
    clerkOrgId,
    deploymentEnvironment,
    deterministicCandidates,
    inputLength: input.length,
    model: SIGNAL_ENTITY_LINKER_MODEL,
    prompt: [
      "Extract explicit person references from this signal.",
      "",
      "Signal input:",
      input,
      "",
      "Deterministic candidates already found:",
      JSON.stringify(deterministicCandidates),
      "",
      "Signal classification:",
      JSON.stringify(classification),
    ].join("\n"),
    signalId,
    system: SIGNAL_ENTITY_LINKER_SYSTEM_PROMPT,
  };
}

export async function classifySignalEntityLinks(
  {
    clerkOrgId,
    deploymentEnvironment,
    inputLength,
    model,
    prompt,
    signalId,
    system,
  }: SignalEntityLinkingRequest,
  { logger = noopLogger }: ClassifySignalEntityLinksOptions = {}
): Promise<SignalEntityLinking> {
  const output = await runObjectClassification({
    failureMessage: "[entity-links] classification failed",
    getFailure: getSignalEntityLinkingFailure,
    logger,
    maxOutputTokens: SIGNAL_ENTITY_LINKER_MAX_OUTPUT_TOKENS,
    metadata: {
      ...createAgentNodeMetadata(
        signalIntakeAgentGraph,
        signalEntityLinkerNode,
        {
          agentRunId: signalId,
          clerkOrgId,
          deploymentEnvironment,
          inputLength,
        }
      ),
      signalId,
    },
    model,
    prompt,
    schema: signalEntityLinkingModelSchema,
    successMessage: "[entity-links] classification completed",
    system,
    telemetryFunctionId: SIGNAL_ENTITY_LINKER_TELEMETRY_FUNCTION_ID,
    timeoutMs: SIGNAL_ENTITY_LINKER_TIMEOUT_MS,
  });

  return {
    candidates: output.candidates.map((candidate) => ({
      ...candidate,
      extractionMethod: "ai" as const,
    })),
    schemaVersion: SIGNAL_ENTITY_LINKS_SCHEMA_VERSION,
  };
}
```

Modify `ai/src/signal-entity-linker/index.ts`:

```ts
export * from "./classify";
export * from "./constants";
export * from "./errors";
export * from "./extract";
export * from "./prompt";
export * from "./schema";
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/signal-entity-linker/classify.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ai/src/signal-entity-linker ai/src/__tests__/signal-entity-linker/classify.test.ts
git commit -m "feat: add signal entity linker classifier"
```

## Task 4: Add No-Persistence Entity Index Workflow

**Files:**
- Modify: `api/app/src/inngest/schemas/app.ts`
- Create: `api/app/src/inngest/workflow/index-signal-entities.ts`
- Test: `api/app/src/__tests__/entity-index-workflow.test.ts`

- [ ] **Step 1: Write failing workflow tests**

Create `api/app/src/__tests__/entity-index-workflow.test.ts`:

```ts
import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignalByPublicIdMock = vi.fn();
const extractDeterministicSignalEntityLinksMock = vi.fn();
const buildSignalEntityLinkingRequestMock = vi.fn();
const classifySignalEntityLinksMock = vi.fn();
const mergeSignalEntityLinkCandidatesMock = vi.fn();
const getSignalEntityLinkingFailureMock = vi.fn();
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
    handler: WorkflowCallback
  ): { id: string } => {
    workflowCallback = handler;
    workflowFailureCallback = config.onFailure;
    return { id: "index-signal-entities" };
  }
);

vi.mock("@db/app", () => ({
  getSignalByPublicId: getSignalByPublicIdMock,
}));

vi.mock("@db/app/client", () => ({ db }));

vi.mock("@repo/ai/signal-entity-linker", () => ({
  buildSignalEntityLinkingRequest: buildSignalEntityLinkingRequestMock,
  classifySignalEntityLinks: classifySignalEntityLinksMock,
  extractDeterministicSignalEntityLinks:
    extractDeterministicSignalEntityLinksMock,
  getSignalEntityLinkingFailure: getSignalEntityLinkingFailureMock,
  mergeSignalEntityLinkCandidates: mergeSignalEntityLinkCandidatesMock,
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

const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";
const classification = {
  schemaVersion: "signal.classification.v2",
  disposition: "needs_context",
  title: "Discuss dev flow",
  summary: "Talk with Jordi and Archer about workflow.",
  kind: "follow_up",
  nextAction: "Ask Jordi and Archer about dev flow.",
  priority: "normal",
  rationale: "The signal mentions people.",
  confidence: 0.55,
  routing: {
    visibility: {
      scope: "user",
      rationale: "Creator-visible context.",
    },
    review: {
      required: false,
      reason: null,
      rationale: null,
    },
    routes: {
      people: {
        shouldRun: false,
        confidence: 0.1,
        rationale: "No durable identity is present.",
      },
    },
  },
};
const signal = {
  id: 1,
  publicId: signalId,
  clerkOrgId: "org_test",
  input: "Talk to Jordi & Archer about their dev flow",
  status: "classified",
  classification,
  visibilityScope: "user",
};

const { indexSignalEntities } = await import(
  "../inngest/workflow/index-signal-entities"
);

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
  extractDeterministicSignalEntityLinksMock.mockReset();
  buildSignalEntityLinkingRequestMock.mockReset();
  classifySignalEntityLinksMock.mockReset();
  mergeSignalEntityLinkCandidatesMock.mockReset();
  getSignalEntityLinkingFailureMock.mockReset();
  logWarnMock.mockReset();

  getSignalByPublicIdMock.mockResolvedValue(signal);
  extractDeterministicSignalEntityLinksMock.mockReturnValue([]);
  buildSignalEntityLinkingRequestMock.mockReturnValue({
    clerkOrgId: "org_test",
    deploymentEnvironment: "development",
    deterministicCandidates: [],
    inputLength: signal.input.length,
    model: "openai/gpt-5.4-nano",
    prompt: "Extract explicit person references.",
    signalId,
    system: "You are the Lightfast signal entity linker.",
  });
  classifySignalEntityLinksMock.mockResolvedValue({
    schemaVersion: "signal.entity-links.v1",
    candidates: [
      {
        targetType: "person",
        localEntityKey: "person_1",
        label: "Jordi",
        mentionKind: "name",
        anchorText: "Jordi",
        anchorOccurrence: 1,
        extractionMethod: "ai",
        rationale: "Jordi appears as a person.",
        confidence: 0.74,
      },
    ],
  });
  mergeSignalEntityLinkCandidatesMock.mockReturnValue([
    {
      targetType: "person",
      localEntityKey: "person_1",
      label: "Jordi",
      mentionKind: "name",
      anchorText: "Jordi",
      anchorOccurrence: 1,
      extractionMethod: "ai",
      rationale: "Jordi appears as a person.",
      confidence: 0.74,
    },
  ]);
  getSignalEntityLinkingFailureMock.mockImplementation((error: unknown) => ({
    errorCode: "SIGNAL_ENTITY_LINKING_FAILED",
    errorMessage: error instanceof Error ? error.message : String(error),
  }));
});

describe("indexSignalEntities", () => {
  it("registers the workflow", () => {
    expect(indexSignalEntities).toEqual({ id: "index-signal-entities" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "index-signal-entities",
        idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId',
        onFailure: expect.any(Function),
        retries: 3,
        timeouts: { finish: "10m", start: "10m" },
        triggers: expect.objectContaining({
          event: "app/signal.entity-index.requested",
        }),
      },
      expect.any(Function)
    );
  });

  it("extracts deterministic and AI candidates without persistence", async () => {
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      aiCandidates: 1,
      candidates: 1,
      deterministicCandidates: 0,
      status: "indexed",
    });

    expect(getSignalByPublicIdMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      publicId: signalId,
    });
    expect(extractDeterministicSignalEntityLinksMock).toHaveBeenCalledWith({
      input: signal.input,
    });
    expect(buildSignalEntityLinkingRequestMock).toHaveBeenCalledWith({
      classification,
      clerkOrgId: "org_test",
      deploymentEnvironment: "development",
      deterministicCandidates: [],
      input: signal.input,
      signalId,
    });
    expect(step.ai.wrap).toHaveBeenCalledWith(
      "link signal entities",
      expect.any(Function),
      expect.objectContaining({ signalId })
    );
    expect(mergeSignalEntityLinkCandidatesMock).toHaveBeenCalledWith({
      aiCandidates: expect.any(Array),
      deterministicCandidates: [],
      input: signal.input,
    });
  });

  it("skips missing, unclassified, and needs-review signals", async () => {
    const step = createStep();
    getSignalByPublicIdMock.mockResolvedValueOnce(undefined);
    await expect(runWorkflow(step)).resolves.toEqual({ status: "missing" });

    getSignalByPublicIdMock.mockResolvedValueOnce({
      ...signal,
      status: "processing",
      classification: null,
    });
    await expect(runWorkflow(step)).resolves.toEqual({ status: "skipped" });

    getSignalByPublicIdMock.mockResolvedValueOnce({
      ...signal,
      classification: {
        ...classification,
        routing: {
          ...classification.routing,
          visibility: {
            scope: "needs_review",
            rationale: "Needs review.",
          },
          review: {
            required: true,
            reason: "sensitive_person",
            rationale: "Sensitive person context.",
          },
        },
      },
      visibilityScope: "needs_review",
    });
    await expect(runWorkflow(step)).resolves.toEqual({ status: "skipped" });
  });

  it("logs exhausted failures without mutating the signal", async () => {
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
      "[entity-links] indexing exhausted retries",
      expect.objectContaining({
        clerkOrgId: "org_test",
        errorCode: "SIGNAL_ENTITY_LINKING_FAILED",
        signalId,
      })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/entity-index-workflow.test.ts
```

Expected: FAIL because the event and workflow do not exist.

- [ ] **Step 3: Add event schema and workflow**

Modify `api/app/src/inngest/schemas/app.ts`:

```ts
"app/signal.entity-index.requested": eventType(
  "app/signal.entity-index.requested",
  {
    schema: z.object({
      signalId: signalIdSchema,
      clerkOrgId: z.string().min(1),
    }),
  }
),
```

Create `api/app/src/inngest/workflow/index-signal-entities.ts`:

```ts
import { getSignalByPublicId } from "@db/app";
import { db } from "@db/app/client";
import {
  buildSignalEntityLinkingRequest,
  classifySignalEntityLinks,
  extractDeterministicSignalEntityLinks,
  getSignalEntityLinkingFailure,
  mergeSignalEntityLinkCandidates,
} from "@repo/ai/signal-entity-linker";
import type { SignalClassification } from "@repo/api-contract";
import { log } from "@vendor/observability/log/next";

import { env } from "../../env";
import { inngest } from "../client";
import { appEvents } from "../schemas/app";

function shouldIndexSignalEntities(signal: {
  classification: SignalClassification | null;
  status: string;
  visibilityScope: string;
}): boolean {
  if (signal.status !== "classified" || !signal.classification) {
    return false;
  }

  return (
    signal.classification.schemaVersion === "signal.classification.v2" &&
    signal.classification.routing.visibility.scope !== "needs_review" &&
    signal.visibilityScope !== "needs_review"
  );
}

export const indexSignalEntities = inngest.createFunction(
  {
    id: "index-signal-entities",
    idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId',
    retries: 3,
    timeouts: {
      finish: "10m",
      start: "10m",
    },
    triggers: appEvents["app/signal.entity-index.requested"],
    onFailure: async ({ event, error }) => {
      const { clerkOrgId, signalId } = event.data.event.data;
      const failure = getSignalEntityLinkingFailure(error);

      log.warn("[entity-links] indexing exhausted retries", {
        clerkOrgId,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        signalId,
      });

      return { status: "failed" };
    },
  },
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

    if (!shouldIndexSignalEntities(signal)) {
      return { status: "skipped" };
    }

    const deterministicCandidates = await step.run(
      "extract deterministic entity links",
      () => extractDeterministicSignalEntityLinks({ input: signal.input })
    );

    const request = buildSignalEntityLinkingRequest({
      classification: signal.classification,
      clerkOrgId,
      deploymentEnvironment: env.VERCEL_ENV,
      deterministicCandidates,
      input: signal.input,
      signalId,
    });

    const aiResult = await step.ai.wrap(
      "link signal entities",
      (linkingRequest) =>
        classifySignalEntityLinks(linkingRequest, { logger: log }),
      request
    );

    const candidates = await step.run("merge entity link candidates", () =>
      mergeSignalEntityLinkCandidates({
        aiCandidates: aiResult.candidates,
        deterministicCandidates,
        input: signal.input,
      })
    );

    return {
      aiCandidates: aiResult.candidates.length,
      candidates: candidates.length,
      deterministicCandidates: deterministicCandidates.length,
      status: "indexed",
    };
  }
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/entity-index-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/src/inngest/schemas/app.ts api/app/src/inngest/workflow/index-signal-entities.ts api/app/src/__tests__/entity-index-workflow.test.ts
git commit -m "feat: add signal entity indexing workflow"
```

## Task 5: Wire Entity Indexing From Signal Classification

**Files:**
- Modify: `api/app/src/inngest/workflow/classify-signal.ts`
- Modify: `api/app/src/__tests__/signal-workflow.test.ts`

- [ ] **Step 1: Update failing workflow tests**

In `api/app/src/__tests__/signal-workflow.test.ts`, update the main classified test to expect both events:

```ts
expect(sendMock).toHaveBeenCalledWith({
  name: "app/people.classification.requested",
  data: {
    clerkOrgId: "org_test",
    signalId,
  },
});
expect(sendMock).toHaveBeenCalledWith({
  name: "app/signal.entity-index.requested",
  data: {
    clerkOrgId: "org_test",
    signalId,
  },
});
```

Replace the user-visible no-send assertion with:

```ts
expect(sendMock).toHaveBeenCalledTimes(1);
expect(sendMock).toHaveBeenCalledWith({
  name: "app/signal.entity-index.requested",
  data: {
    clerkOrgId: "org_test",
    signalId,
  },
});
expect(sendMock).not.toHaveBeenCalledWith({
  name: "app/people.classification.requested",
  data: {
    clerkOrgId: "org_test",
    signalId,
  },
});
```

Keep needs-review tests asserting no sends:

```ts
expect(sendMock).not.toHaveBeenCalled();
```

Add a not-actionable user-visible classification fixture:

```ts
const notActionableClassification = {
  ...userClassification,
  disposition: "not_actionable",
  title: "FYI from Jordi",
  summary: "The input mentions Jordi but does not require action.",
  kind: "other",
  nextAction: "No action required.",
  priority: "low",
  rationale: "The signal is informational.",
  confidence: 0.64,
} as const;
```

Add the test:

```ts
it("queues entity indexing for non-actionable visible signals", async () => {
  const step = createStep();
  classifySignalInputMock.mockResolvedValueOnce(notActionableClassification);

  await expect(runWorkflow(step)).resolves.toEqual({
    status: "classified",
    visibilityScope: "user",
    reviewRequired: false,
    routedPeople: false,
  });

  expect(sendMock).toHaveBeenCalledWith({
    name: "app/signal.entity-index.requested",
    data: {
      clerkOrgId: "org_test",
      signalId,
    },
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-workflow.test.ts
```

Expected: FAIL because `classify-signal` does not queue entity-index events.

- [ ] **Step 3: Implement entity-index queueing in classify-signal**

Modify `api/app/src/inngest/workflow/classify-signal.ts`:

```ts
function shouldIndexSignalEntities(
  classification: SignalClassification | null
): boolean {
  return (
    classification?.schemaVersion === "signal.classification.v2" &&
    classification.routing.visibility.scope !== "needs_review"
  );
}

async function queueSignalEntityIndexing(input: {
  clerkOrgId: string;
  signalId: string;
}) {
  await inngest.send({
    name: "app/signal.entity-index.requested",
    data: input,
  });
}
```

Refactor the already-classified branch from early returns into one return:

```ts
if (signal.status === "classified" && signal.classification) {
  const routedPeople = shouldClassifyPeople(signal.classification);
  if (routedPeople) {
    await step.run("queue people classification", () =>
      inngest.send({
        name: "app/people.classification.requested",
        data: {
          clerkOrgId,
          signalId,
        },
      })
    );
  }

  if (shouldIndexSignalEntities(signal.classification)) {
    await step.run("queue signal entity indexing", () =>
      queueSignalEntityIndexing({ clerkOrgId, signalId })
    );
  }

  return classifiedResult(signal.classification, routedPeople);
}
```

Refactor the newly-classified branch from early returns into one return:

```ts
const routedPeople = shouldClassifyPeople(classification);
if (routedPeople) {
  await step.run("queue people classification", () =>
    inngest.send({
      name: "app/people.classification.requested",
      data: {
        clerkOrgId,
        signalId,
      },
    })
  );
}

if (shouldIndexSignalEntities(classification)) {
  await step.run("queue signal entity indexing", () =>
    queueSignalEntityIndexing({ clerkOrgId, signalId })
  );
}

return classifiedResult(classification, routedPeople);
```

Keep `classifiedResult(classification, routedPeople)` unchanged so existing workflow consumers do not need a result-shape migration.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signal-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/src/inngest/workflow/classify-signal.ts api/app/src/__tests__/signal-workflow.test.ts
git commit -m "feat: queue signal entity indexing"
```

## Task 6: Register Workflow In Inngest Route

**Files:**
- Modify: `api/app/src/inngest/index.ts`
- Modify: `api/app/src/__tests__/inngest-route.test.ts`

- [ ] **Step 1: Write failing route registration test update**

Modify `api/app/src/__tests__/inngest-route.test.ts`:

```ts
const indexSignalEntities = { id: "index-signal-entities" };
```

Add mock:

```ts
vi.mock("../inngest/workflow/index-signal-entities", () => ({
  indexSignalEntities,
}));
```

Add `indexSignalEntities` to the expected `functions` array immediately after `classifySignal`:

```ts
functions: [
  systemHealth,
  classifySignal,
  indexSignalEntities,
  classifyPeople,
  automationScheduler,
  runAutomation,
  refreshSkillIndex,
  refreshIdentityIndex,
  reconcileSkillIndexes,
  reconcileIdentityIndexes,
  queueLightfastIndexRefreshesFromSourceControl,
],
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/inngest-route.test.ts
```

Expected: FAIL because the route does not include `indexSignalEntities`.

- [ ] **Step 3: Register workflow**

Modify `api/app/src/inngest/index.ts`:

```ts
import { indexSignalEntities } from "./workflow/index-signal-entities";
```

Add it to the served functions list immediately after `classifySignal`:

```ts
systemHealth,
classifySignal,
indexSignalEntities,
classifyPeople,
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/inngest-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/src/inngest/index.ts api/app/src/__tests__/inngest-route.test.ts
git commit -m "feat: register signal entity indexing workflow"
```

## Task 7: Package-Level Verification

**Files:**
- Verify only; no source changes expected.

- [ ] **Step 1: Run focused AI tests**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/signal-entity-linker src/__tests__/_internal/agent-graphs/signal-intake.test.ts src/__tests__/telemetry/metadata.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused API workflow tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/entity-index-workflow.test.ts src/__tests__/signal-workflow.test.ts src/__tests__/inngest-route.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typechecks for touched packages**

Run:

```bash
pnpm --filter @repo/ai typecheck
pnpm --filter @api/app typecheck
```

Expected: both commands PASS.

- [ ] **Step 4: Commit any verification-only fixes**

If verification required small type/test fixes, commit only those fixes:

```bash
git add ai api/app
git commit -m "fix: verify signal entity indexing types"
```

If there were no fixes, do not create an empty commit.

## Self-Review

- Spec coverage: The plan covers the AI capability, deterministic extraction, shared candidate schema, `localEntityKey`, raw-input-only prompt rules, live workflow integration, needs-review skip behavior, no persistence, no backfill, and no UI.
- Deferred scope: Persistence tables, reconciliation, `signals.get` entity links, UI rendering, Project entities, and classifier consolidation remain out of this first implementation slice.
- Red-flag scan: The plan contains no unresolved marker tokens and no unspecified "write tests" steps.
- Type consistency: The plan consistently uses `SignalEntityLinkCandidate`, `signalEntityLinkingModelSchema`, `classifySignalEntityLinks`, `extractDeterministicSignalEntityLinks`, `mergeSignalEntityLinkCandidates`, and `indexSignalEntities`.
