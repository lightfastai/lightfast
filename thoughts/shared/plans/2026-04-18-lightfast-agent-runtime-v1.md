# Lightfast Agent Runtime v1 — Implementation Plan

> **Deprecated layout decision**: this plan specified a `.lightfast/` path prefix inside the config repo. Superseded by `thoughts/shared/plans/2026-04-18-dotlightfast-path-prefix-fix.md` — the indexed repo IS the config root, so `SPEC.md` and `skills/` now live at the repo root. Verification items for `no_dotlightfast_config` and `invoke` are carried forward into that plan.

## Overview

Add an event-driven agent triage runtime: a single new Inngest function listens to `platform/event.stored`, loads the customer's `.lightfast/` config (SPEC.md + skill manifests) from their indexed GitHub repo, runs one Claude Haiku 4.5 structured-output triage call, and emits `platform/agent.decided` for both skip/invoke outcomes. v1 is read-only — no memory writes, no skill execution, no tool calls.

## Current State Analysis

- `platform/event.stored` is emitted at `api/platform/src/inngest/functions/platform-event-store.ts:557-566` but currently has no listeners.
- `orgRepoIndexes` has a unique index on `clerkOrgId` — one primary Lightfast-aware repo per org. `integrationId` FK → `orgIntegrations` → `gatewayInstallations` gives the installation-level context needed to mint a GitHub token.
- `platform.proxy.execute` (a tRPC `.mutation` at `api/platform/src/router/platform/proxy.ts:90-264`) already routes `get-file-contents` calls, handles 401 refresh, and returns raw JSON (`{ status, data, headers }`). The `get-file-contents` endpoint's `responseSchema` is a `z.union` that models both single-file (`{ type, content, sha }`) and directory-listing (`Array<{ type, name }>`) shapes — GitHub's Contents API distinguishes at runtime.
- The previous `@repo/app-config` package was deleted in commit `e0b66b2b5` ("refactor(app-config): delete package, inline constants into consumers"). There is no current home for `.lightfast/` parsing logic.
- `@repo/prompt-engine` already exists as a pure-TypeScript, zod-only, no-build-step package — an ideal template for a new sibling package.
- The codebase already uses `yaml` (the npm package) at `api/app/src/router/org/connections.ts:18` for parsing `lightfast.yml` files. No `gray-matter` is used.
- The gateway pattern is consistent: `import { gateway } from "@ai-sdk/gateway"` + `import { generateObject } from "ai"`. Haiku 4.5 is already used for cost-sensitive structured output in `packages/app-rerank/src/providers/llm.ts`.
- `orgEvents` column is named `externalId` (NOT `eventExternalId` — the Inngest event field maps to but does not match this column name). Single-column unique index `org_event_external_id_idx` exists.
- `createNeuralOnFailureHandler` at `api/platform/src/inngest/on-failure-handler.ts:41` is tightly coupled to the neural pipeline (`jobs` table, `NeuralFailureOutput`). It should NOT be used for the triage function — plain Inngest retries suffice.
- No consumers of `@repo/app-config` or `.lightfast/` parsing exist on `main` today — this is genuinely greenfield.

### Key Discoveries

- Proxy does NOT zod-parse responses — caller must discriminate file vs directory via `Array.isArray(data)` (`proxy.ts:243-263`).
- `createPlatformCaller(caller)` is React-`cache()`-wrapped and self-signs a service JWT — invoking it from an Inngest function needs no extra context (`packages/platform-trpc/src/caller.ts:20`).
- `.lightfast/skills` directory listing via `get-file-contents` with `path: ".lightfast/skills"` returns an array of `{ type: "dir", name }` entries. The parser iterates and reads each `.lightfast/skills/<name>/SKILL.md` with a second call.
- Function registration in `api/platform/src/inngest/index.ts` requires three edits: an import, a re-export, and an entry in the `functions` array.

## Desired End State

A single emitted `platform/event.stored` event (e.g. a GitHub push to a repo whose org has an active `orgRepoIndexes` row containing a valid `.lightfast/SPEC.md`) triggers the `platformAgentTriage` function. The function logs one of:

- `{ skipped: "no_active_repo_index" }` — org has no indexed repo.
- `{ skipped: "no_dotlightfast_config" }` — repo has neither `SPEC.md` nor skills.
- `{ decision: "skip", reasoning }` — triage LLM decided no action needed.
- `{ decision: "invoke", skillName, reasoning }` — triage LLM selected a skill.

For the latter two outcomes, `platform/agent.decided` is emitted with the same payload, visible in the Inngest dashboard. No database writes. No downstream side effects.

### Verification

- `pnpm typecheck` passes across the monorepo.
- `pnpm check` passes.
- `pnpm --filter @api/platform build` succeeds.
- Manual end-to-end: dev org with `.lightfast/SPEC.md` + one skill receives a webhook event → Inngest dashboard shows both `platform/event.stored` and `platform/agent.decided` runs with matching `correlationId`.

## What We're NOT Doing

- Loading full `SKILL.md` bodies or `command/*.md` files (only frontmatter).
- Reading `.lightfast/memory/MEMORY.md` (deferred to v2).
- Writing to `.lightfast/memory/` — GitHub provider `ApiEndpoint.method` is typed `"GET" | "POST"` only (`packages/app-providers/src/provider/api.ts:77`). Extending to `"PUT"` is v2.
- Downstream skill-execution function (listens to `platform/agent.decided`) — that's v2.
- `createAgent` / `fetchRequestHandler` wiring — v1 calls Vercel `generateObject` directly.
- New DB tables. `orgAgentDecisions` audit table deferred to v2 if needed (Inngest event history is sufficient for v1).
- Adding tools (`sendNotification`, `writeMemory`). No tools in v1.
- Significance-score gating (triage runs on 100% of stored events given sub-cent cost with Haiku).
- Prompt-engine `SectionProvider` integration — v1 composes the prompt via a plain string builder in `@repo/dotlightfast`.

## Implementation Approach

Five phases in strict order: build the parser package first (zero coupling, unit-testable), then extend the event schema, then the Inngest function, then wire it up, then verify. Each phase is independently verifiable and reviewable.

---

## Phase 1: New package `@repo/dotlightfast`

### Overview

Create a pure-TypeScript package that owns: the skill frontmatter schema, the `.lightfast/` tree parser (decoupled from I/O via a `Fetcher` callback), the triage decision schema, and the triage prompt builder. Mirrors `@repo/prompt-engine`'s minimal template.

### Changes Required

#### 1.1 `packages/dotlightfast/package.json` (new)

**Changes**: Minimal package manifest — zero build step, two deps.

```json
{
  "name": "@repo/dotlightfast",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "license": "MIT",
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "yaml": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

**Note on `yaml` catalog entry**: confirm `yaml` is in `pnpm-workspace.yaml` catalog. If not, add it there (same version as used in `api/app/package.json`). This is a one-line edit.

#### 1.2 `packages/dotlightfast/tsconfig.json` (new)

```json
{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

#### 1.3 `packages/dotlightfast/src/schema.ts` (new)

**Changes**: Zod schema for skill frontmatter.

```ts
import { z } from "zod";

export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, {
    message: "name must be lowercase kebab-case",
  }),
  description: z.string().min(1).max(500),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;
```

#### 1.4 `packages/dotlightfast/src/types.ts` (new)

**Changes**: Public types for the parser's input and output.

```ts
export interface SkillManifest {
  name: string;
  description: string;
  hasCommand: boolean; // .lightfast/skills/<name>/command/<name>.md exists
  path: string; // .lightfast/skills/<name>/
}

export interface DotLightfastConfig {
  spec: string | null; // SPEC.md content, decoded UTF-8
  skills: SkillManifest[]; // manifests only, NOT full bodies
}

export type FetcherResult =
  | { type: "file"; content: string } // decoded UTF-8 content
  | { type: "dir"; entries: { name: string; type: "file" | "dir" }[] }
  | { type: "missing" };

export type Fetcher = (path: string) => Promise<FetcherResult>;

export class DotLightfastParseError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DotLightfastParseError";
  }
}
```

#### 1.5 `packages/dotlightfast/src/parse.ts` (new)

**Changes**: I/O-free parser. Reads `SPEC.md`, enumerates `skills/` directory, pulls each skill's `SKILL.md` frontmatter only, and probes for `command/<name>.md` existence.

```ts
import { parse as parseYaml } from "yaml";

import { SkillFrontmatterSchema } from "./schema";
import {
  DotLightfastParseError,
  type DotLightfastConfig,
  type Fetcher,
  type SkillManifest,
} from "./types";

const MAX_SPEC_BYTES = 32_000; // ~8k tokens — truncate if larger
const MAX_SKILLS = 50;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function extractFrontmatter(source: string): Record<string, unknown> | null {
  const match = FRONTMATTER_RE.exec(source);
  if (!match) return null;
  try {
    const parsed = parseYaml(match[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export async function parseDotLightfast(
  fetcher: Fetcher,
): Promise<DotLightfastConfig> {
  const specResult = await fetcher(".lightfast/SPEC.md");
  let spec: string | null = null;
  if (specResult.type === "file") {
    spec =
      specResult.content.length > MAX_SPEC_BYTES
        ? specResult.content.slice(0, MAX_SPEC_BYTES)
        : specResult.content;
  } else if (specResult.type !== "missing") {
    throw new DotLightfastParseError(
      "SPEC.md path resolved to a directory",
      ".lightfast/SPEC.md",
    );
  }

  const skillsRoot = await fetcher(".lightfast/skills");
  const skills: SkillManifest[] = [];
  if (skillsRoot.type === "dir") {
    const dirEntries = skillsRoot.entries
      .filter((e) => e.type === "dir")
      .slice(0, MAX_SKILLS);

    for (const entry of dirEntries) {
      const skill = await loadSkill(fetcher, entry.name);
      if (skill) skills.push(skill);
    }
  }

  return { spec, skills };
}

async function loadSkill(
  fetcher: Fetcher,
  dirName: string,
): Promise<SkillManifest | null> {
  const skillPath = `.lightfast/skills/${dirName}/SKILL.md`;
  const skillFile = await fetcher(skillPath);
  if (skillFile.type !== "file") return null;

  const raw = extractFrontmatter(skillFile.content);
  if (!raw) return null;

  const parsed = SkillFrontmatterSchema.safeParse(raw);
  if (!parsed.success) return null;

  const commandProbe = await fetcher(
    `.lightfast/skills/${dirName}/command/${parsed.data.name}.md`,
  );

  return {
    name: parsed.data.name,
    description: parsed.data.description,
    hasCommand: commandProbe.type === "file",
    path: `.lightfast/skills/${dirName}/`,
  };
}
```

**Design notes**:
- Partial-tree tolerant: a malformed `SKILL.md` or missing `command/` file skips that skill rather than failing the whole parse.
- `MAX_SPEC_BYTES` caps SPEC.md at ~32KB to keep token budget bounded (~8k tokens).
- `MAX_SKILLS` caps skill enumeration at 50 to prevent pathological manifests.
- Throws only on structural violations (SPEC.md path returning a directory) — other errors result in a missing-but-well-typed empty config.

#### 1.6 `packages/dotlightfast/src/triage.ts` (new)

**Changes**: Triage decision schema + prompt builder.

```ts
import { z } from "zod";

import type { DotLightfastConfig } from "./types";

export const TriageDecisionSchema = z.object({
  decision: z.enum(["skip", "invoke"]),
  skillName: z.string().optional(),
  reasoning: z.string().min(1).max(500),
});

export type TriageDecision = z.infer<typeof TriageDecisionSchema>;

export interface TriageEventContext {
  externalId: string;
  source: string;
  sourceType: string;
  observationType: string;
  title: string;
  content: string;
  occurredAt: string;
  significanceScore: number;
}

export function buildTriageSystemPrompt(config: DotLightfastConfig): string {
  const parts: string[] = [];

  parts.push(
    "You are Lightfast's triage agent. For each event you receive, decide whether any configured skill should run.",
    "Output one of: skip (no skill is appropriate) or invoke (select exactly one skill by name).",
    "Be decisive. If no skill clearly applies, pick skip.",
  );

  if (config.spec) {
    parts.push("", "## Organization SPEC", config.spec.trim());
  }

  if (config.skills.length > 0) {
    parts.push("", "## Available Skills");
    for (const skill of config.skills) {
      parts.push(`- **${skill.name}**: ${skill.description}`);
    }
  } else {
    parts.push("", "## Available Skills", "(none configured)");
  }

  parts.push(
    "",
    "## Output rules",
    "- If you choose invoke, skillName MUST exactly match one of the skill names above.",
    "- If you choose skip, omit skillName.",
    "- reasoning must be one or two short sentences explaining your choice.",
  );

  return parts.join("\n");
}

export function buildTriageUserPrompt(event: TriageEventContext): string {
  return [
    `Event: ${event.source}/${event.sourceType} (${event.observationType})`,
    `Occurred: ${event.occurredAt}`,
    `Significance: ${event.significanceScore}`,
    `Title: ${event.title}`,
    "",
    "Content:",
    event.content.slice(0, 4000),
  ].join("\n");
}
```

#### 1.7 `packages/dotlightfast/src/index.ts` (new)

```ts
export { SkillFrontmatterSchema, type SkillFrontmatter } from "./schema";
export { parseDotLightfast } from "./parse";
export {
  TriageDecisionSchema,
  type TriageDecision,
  type TriageEventContext,
  buildTriageSystemPrompt,
  buildTriageUserPrompt,
} from "./triage";
export {
  DotLightfastParseError,
  type DotLightfastConfig,
  type Fetcher,
  type FetcherResult,
  type SkillManifest,
} from "./types";
```

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @repo/dotlightfast typecheck` passes.
- [x] Root `pnpm typecheck` passes (no cascading errors).
- [x] `pnpm install` resolves the new workspace package.

#### Manual Verification

- [ ] Spot-check imports: `import { parseDotLightfast } from "@repo/dotlightfast"` resolves in a scratch file.
- [ ] `yaml` catalog entry is present in `pnpm-workspace.yaml` (add if missing).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Event schema addition

### Overview

Add a new entry to `platformEvents` so `platform/agent.decided` is typed end-to-end across `sendEvent` and downstream listeners.

### Changes Required

#### 2.1 `api/platform/src/inngest/schemas/platform.ts`

**Changes**: Add a single new key to the `platformEvents` object.

Add after the existing `platform/entity.graphed` entry (around line 103):

```ts
"platform/agent.decided": z.object({
  data: z.object({
    clerkOrgId: z.string(),
    eventExternalId: z.string(),
    decision: z.enum(["skip", "invoke"]),
    skillName: z.string().optional(),
    reasoning: z.string(),
    correlationId: z.string().optional(),
  }),
}),
```

(Match the existing wrapping pattern — inspect neighboring entries to confirm whether they wrap in `z.object({ data: ... })` or use flat `z.object(...)`. The research doc shows the flat shape; verify against the actual file at implementation time and match the local convention.)

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @api/platform typecheck` passes.
- [x] `pnpm typecheck` passes at the root. (Unrelated failure in `apps/www/_components/flow-field.tsx` — untracked file from separate WIP, not caused by this phase.)

#### Manual Verification

- [ ] New event name appears in IDE autocomplete when typing `step.sendEvent(..., { name: "platform/" })` anywhere in the Inngest functions.

**Implementation Note**: Pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: New Inngest function `platformAgentTriage`

### Overview

Implement the core v1 function at `api/platform/src/inngest/functions/platform-agent-triage.ts`. Listens to `platform/event.stored`, runs five steps (resolve repo, load `.lightfast/`, load event row, triage LLM, emit decision), returns a structured result object.

### Changes Required

#### 3.1 `api/platform/src/inngest/functions/platform-agent-triage.ts` (new)

**File**: `api/platform/src/inngest/functions/platform-agent-triage.ts`

**Changes**: Full new file. Structural template is `platform-entity-graph.ts`. Repo-resolution pattern is from `platform-repo-index-sync.ts:50-106`. Proxy call pattern is from `api/app/src/router/org/connections.ts:355-378`.

```ts
import { NonRetriableError } from "inngest";
import { gateway } from "@ai-sdk/gateway";
import { generateObject } from "ai";
import { and, eq } from "drizzle-orm";

import { log } from "@vendor/observability/log/next";
import {
  buildTriageSystemPrompt,
  buildTriageUserPrompt,
  parseDotLightfast,
  TriageDecisionSchema,
  type Fetcher,
  type FetcherResult,
} from "@repo/dotlightfast";
import { db } from "@db/app/client";
import {
  gatewayInstallations,
  orgEvents,
  orgIntegrations,
  orgRepoIndexes,
} from "@db/app/schema";
import { createPlatformCaller } from "@repo/platform-trpc";

import { inngest } from "../client";

const TRIAGE_MODEL = "anthropic/claude-haiku-4.5";

export const platformAgentTriage = inngest.createFunction(
  {
    id: "platform/agent.triage",
    name: "Agent Triage",
    description: "Loads .lightfast config and runs a triage LLM call on stored events",
    retries: 2,
    idempotency: "`${event.data.clerkOrgId}-${event.data.eventExternalId}`",
    concurrency: { limit: 5, key: "event.data.clerkOrgId" },
    timeouts: { start: "1m", finish: "3m" },
  },
  { event: "platform/event.stored" },
  async ({ event, step }) => {
    const {
      clerkOrgId,
      eventExternalId,
      sourceType,
      significanceScore,
      correlationId,
    } = event.data;

    // ─── Step 1: resolve repo context ──────────────────────────────────
    const repoContext = await step.run("resolve-repo-context", async () => {
      const rows = await db
        .select({
          installationId: gatewayInstallations.id,
          repoFullName: orgRepoIndexes.repoFullName,
        })
        .from(orgRepoIndexes)
        .innerJoin(
          orgIntegrations,
          eq(orgIntegrations.id, orgRepoIndexes.integrationId),
        )
        .innerJoin(
          gatewayInstallations,
          eq(gatewayInstallations.id, orgIntegrations.installationId),
        )
        .where(
          and(
            eq(orgRepoIndexes.clerkOrgId, clerkOrgId),
            eq(orgRepoIndexes.isActive, true),
          ),
        )
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      const [owner, repo] = row.repoFullName.split("/");
      if (!owner || !repo) {
        throw new NonRetriableError(
          `malformed repoFullName: ${row.repoFullName}`,
        );
      }
      return { installationId: row.installationId, owner, repo };
    });

    if (!repoContext) {
      log.info("agent triage skipped: no active repo index", {
        clerkOrgId,
        eventExternalId,
      });
      return { skipped: "no_active_repo_index" as const };
    }

    // ─── Step 2: load .lightfast/ config ───────────────────────────────
    const config = await step.run("load-dotlightfast", async () => {
      const caller = await createPlatformCaller("platform");
      const fetcher: Fetcher = async (path): Promise<FetcherResult> => {
        const result = await caller.platform.proxy.execute({
          installationId: repoContext.installationId,
          endpointId: "get-file-contents",
          pathParams: { owner: repoContext.owner, repo: repoContext.repo, path },
        });

        if (result.status === 404) return { type: "missing" };
        if (result.status !== 200) {
          throw new Error(
            `get-file-contents ${path} → ${result.status}`,
          );
        }

        const data = result.data;
        if (Array.isArray(data)) {
          return {
            type: "dir",
            entries: data
              .filter(
                (e): e is { type: "file" | "dir"; name: string } =>
                  typeof e === "object" &&
                  e !== null &&
                  "type" in e &&
                  "name" in e,
              )
              .map((e) => ({ name: e.name, type: e.type })),
          };
        }

        if (
          data &&
          typeof data === "object" &&
          "content" in data &&
          typeof (data as { content: unknown }).content === "string"
        ) {
          const b64 = (data as { content: string }).content;
          const decoded = Buffer.from(b64, "base64").toString("utf-8");
          return { type: "file", content: decoded };
        }

        return { type: "missing" };
      };

      return parseDotLightfast(fetcher);
    });

    if (!config.spec && config.skills.length === 0) {
      log.info("agent triage skipped: no .lightfast config", {
        clerkOrgId,
        eventExternalId,
      });
      return { skipped: "no_dotlightfast_config" as const };
    }

    // ─── Step 3: load event row ────────────────────────────────────────
    const eventRow = await step.run("load-event", async () => {
      const rows = await db
        .select()
        .from(orgEvents)
        .where(eq(orgEvents.externalId, eventExternalId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new NonRetriableError(
          `orgEvents row not found for externalId=${eventExternalId}`,
        );
      }
      return row;
    });

    // ─── Step 4: triage LLM call ───────────────────────────────────────
    const decision = await step.run("triage", async () => {
      const system = buildTriageSystemPrompt(config);
      const user = buildTriageUserPrompt({
        externalId: eventRow.externalId,
        source: eventRow.source,
        sourceType: eventRow.sourceType,
        observationType: eventRow.observationType,
        title: eventRow.title,
        content: eventRow.content,
        occurredAt: eventRow.occurredAt.toISOString(),
        significanceScore: eventRow.significanceScore ?? significanceScore ?? 0,
      });

      const { object } = await generateObject({
        model: gateway(TRIAGE_MODEL),
        schema: TriageDecisionSchema,
        system,
        prompt: user,
        temperature: 0.1,
      });

      if (object.decision === "invoke") {
        if (!object.skillName) {
          throw new Error("invoke decision missing skillName");
        }
        const match = config.skills.find((s) => s.name === object.skillName);
        if (!match) {
          // LLM hallucinated a skill name — degrade to skip rather than fail.
          log.warn("triage selected unknown skill, degrading to skip", {
            clerkOrgId,
            eventExternalId,
            selected: object.skillName,
          });
          return {
            decision: "skip" as const,
            skillName: undefined,
            reasoning: `selected unknown skill "${object.skillName}"; degraded to skip`,
          };
        }
      }
      return object;
    });

    // ─── Step 5: emit decision ─────────────────────────────────────────
    await step.sendEvent("emit-agent-decided", {
      name: "platform/agent.decided" as const,
      data: {
        clerkOrgId,
        eventExternalId,
        decision: decision.decision,
        skillName: decision.skillName,
        reasoning: decision.reasoning,
        correlationId,
      },
    });

    log.info("agent triage decided", {
      clerkOrgId,
      eventExternalId,
      sourceType,
      decision: decision.decision,
      skillName: decision.skillName,
    });

    return {
      decision: decision.decision,
      skillName: decision.skillName,
      reasoning: decision.reasoning,
    };
  },
);
```

**Design notes**:
- **Idempotency expression**: matches Inngest's template-literal format used elsewhere. Verify the exact syntax convention used in the sibling functions (e.g. `platform-event-store.ts`) and match it — some use the `event.data.X + "-" + event.data.Y` form.
- **`NonRetriableError`** is used for structural violations (malformed repo name, missing event row) that won't resolve via retry.
- **Hallucinated skill names** degrade to `skip` rather than throw — the LLM can invent names despite the prompt, and we prefer a clean skip over a retry storm.
- **No `onFailure` handler**: triage isn't a neural-pipeline job, so `createNeuralOnFailureHandler` is inappropriate.
- **Concurrency**: 5 concurrent triage runs per org. Prevents one noisy org from saturating the LLM budget; generous enough for real-time feel.
- **Content truncation**: `buildTriageUserPrompt` slices content to 4000 chars. Additional hard cap in prompt builder itself.

**Imports to verify at implementation time**:
- `@db/app/client` — confirm the exact export name for the Drizzle client. (Similar functions import `db` from this path — grep to confirm.)
- `@db/app/schema` — confirm the barrel exports all four tables (`orgRepoIndexes`, `orgIntegrations`, `gatewayInstallations`, `orgEvents`). If not, import from specific table files.
- `@repo/platform-trpc` — confirm `createPlatformCaller` is exported from the package root (`packages/platform-trpc/src/caller.ts:20`).

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @api/platform typecheck` passes.
- [x] `pnpm --filter @api/platform build` — N/A (library package, no build script). `pnpm --filter @lightfast/platform build` succeeds (the consuming Next.js app).
- [x] `pnpm check` passes for `api/platform/` via `biome check api/platform/` (remaining root errors are pre-existing `apps/www` WIP, unrelated).

#### Manual Verification

- [ ] File exists and compiles independently.
- [ ] Inngest dev server picks up the new function after Phase 4 wiring (registration).

**Implementation Note**: Pause for manual confirmation before proceeding to Phase 4.

**Implementation deviations from plan**:
- **Deps added in Phase 3, not Phase 4**: `@repo/dotlightfast`, `@ai-sdk/gateway`, `ai` added to `api/platform/package.json` during Phase 3 because the new file cannot typecheck without them. Phase 4 now only needs to wire the function into `inngest/index.ts`.
- **Avoided circular import**: The plan specified `createPlatformCaller` from `@repo/platform-trpc`, but that package depends on `@api/platform`. Using it from inside `@api/platform` would be circular. Instead, `platformRouter.createCaller({ auth: { type: "service", caller: "inngest" }, headers: new Headers() })` is constructed inline — same pattern as the existing `createInternalCaller()`. Bypasses JWT verification (safe: in-process, no network).
- **`eventRow.occurredAt` is already a string** (drizzle `timestamp` with `mode: "string"`), so `.toISOString()` was dropped.
- **Idempotency expression uses string-concat form**: `"event.data.clerkOrgId + '-' + event.data.eventExternalId"`, matching the convention in `platform-event-store.ts`.

---

## Phase 4: Wiring — register the function

### Overview

Three edits to `api/platform/src/inngest/index.ts`: import, re-export, array entry. Plus add `@repo/dotlightfast` + `@ai-sdk/gateway` + `ai` dependencies to `api/platform/package.json` if not already present.

### Changes Required

#### 4.1 `api/platform/src/inngest/index.ts`

**Changes**: Three additions mirroring the pattern used by the 11 existing functions.

Add to the imports block (around lines 20-30, alphabetical or grouped with related listeners):

```ts
import { platformAgentTriage } from "./functions/platform-agent-triage";
```

Add to the named exports block (around lines 34-45):

```ts
export { platformAgentTriage } from "./functions/platform-agent-triage";
```

Add to the `functions` array inside `serve()` (around lines 53-65):

```ts
functions: [
  ingestDelivery,
  platformEventStore,
  platformEntityGraph,
  // ...
  platformRepoIndexSync,
  platformAgentTriage, // <-- new
],
```

#### 4.2 `api/platform/package.json`

**Changes**: Add any missing deps. Check before adding — several are likely already present.

Add to `dependencies` if absent:

```json
"@repo/dotlightfast": "workspace:*",
"@ai-sdk/gateway": "catalog:",
"ai": "catalog:"
```

The `ai` and `@ai-sdk/gateway` packages are already used by `apps/app` and `packages/app-rerank`. Verify the exact catalog version and match.

### Success Criteria

#### Automated Verification

- [x] `pnpm install` succeeds after adding the workspace dep. (Deps were already added in Phase 3.)
- [x] `pnpm --filter @api/platform typecheck` passes.
- [x] `pnpm --filter @api/platform build` — N/A (library package). `pnpm --filter @lightfast/platform build` (consuming Next.js app) succeeds.
- [x] `pnpm typecheck` passes at the root.
- [x] `pnpm check` passes for `api/platform/` via `biome check api/platform/` (remaining root errors are pre-existing `apps/www` WIP, unrelated to this phase).

#### Manual Verification

- [ ] `pnpm dev:platform` starts cleanly.
- [ ] Inngest dev dashboard (http://localhost:8288) lists the new `platform/agent.triage` function under the platform app.

**Implementation Note**: Pause for manual confirmation before proceeding to Phase 5.

---

## Phase 5: End-to-end verification

### Overview

Real webhook trigger on a dev org, observe the full chain: `platform/event.stored` → `platformAgentTriage` → `platform/agent.decided`.

### Changes Required

No code changes. Data/config setup + observation.

#### 5.1 Dev-org prerequisites

Confirm on a test org:

1. `orgIntegrations` row exists with `provider = "github"` and an active `installationId`.
2. `orgRepoIndexes` row exists with `clerkOrgId = <test org>` and `isActive = true`, pointing to a test repo you control (`repoFullName = "<your-gh>/<test-repo>"`).
3. The test repo contains:
   - `.lightfast/SPEC.md` with a brief organization spec (couple of sentences).
   - `.lightfast/skills/example/SKILL.md` with frontmatter:
     ```yaml
     ---
     name: example
     description: Demonstrates skill triage by matching any event mentioning the word "example"
     ---
     # Example skill body (not loaded in v1)
     ```

#### 5.2 Trigger a real event

Option A — push a commit to the test repo (triggers the GitHub webhook → relay → `platform/event.capture` → `platform/event.stored`).

Option B — use the Inngest MCP `send_event` tool or the dev dashboard to manually emit `platform/event.stored` with a known `eventExternalId` from a recent `orgEvents` row.

#### 5.3 Observation checklist

### Success Criteria

#### Automated Verification

- [x] No new test suite required for v1 (unit tests for `parseDotLightfast` would be valuable but are out of scope for this plan — track as a follow-up).

#### Manual Verification

- [x] Inngest dashboard lists the new `platform/agent.triage` function.
- [x] Run detail shows all 5 steps completed: verified via run `01KPFPPE8DZ0XVCFHJWG6P0Z9P` — completed in ~37s (end-to-end including LLM).
- [x] Run output contains `decision` and `reasoning` (skip case): `{"decision":"skip","reasoning":"This is a routine dependabot dependency bump deployment..."}`
- [x] `platform/agent.decided` event emitted and visible in dev-server event history (internal_id `01KPFPQG8DR99CMFBK6W26MNJK`, payload includes `correlationId`).
- [x] Emit `platform/event.stored` twice with the same `eventExternalId`: second run is deduplicated via idempotency key (second send returned no `runIds`).
- [x] Emit for an org with no `orgRepoIndexes` row: function returns `{ skipped: "no_active_repo_index" }` (verified before repo-index was populated).
- [x] Emit for an org whose repo has no `.lightfast/` directory: returns `{ skipped: "no_dotlightfast_config" }`. **Not exercised — dev setup currently has `.lightfast/` populated; would require a second repo without the config.** Migrated to `2026-04-18-dotlightfast-path-prefix-fix.md` Phase 3.3.
- [x] Emit for an event whose content clearly matches the example skill's description: `decision: "invoke", skillName: "example"`. **Not exercised — no existing `lightfast_org_events` row mentions "example". Can be verified by pushing a commit whose message contains "example" to a repo wired to webhooks, or by broadening the skill description to match routine events.** Migrated to `2026-04-18-dotlightfast-path-prefix-fix.md` Phase 3.2.
- [x] Emit for an irrelevant event: `decision: "skip"` — verified above with the Vercel dependabot deploy event. LLM reasoned from SPEC ("routine noise... should be skipped") correctly.

---

## Testing Strategy

### Unit Tests

Out of scope for v1 per plan agreement. When added as a follow-up, focus on:

- `parseDotLightfast` with a fake `Fetcher` — cover: missing SPEC, missing skills dir, mixed valid/invalid skill frontmatter, oversized SPEC truncation, skill cap enforcement.
- `TriageDecisionSchema` — invalid shapes (missing `decision`, non-enum values) are rejected.
- `buildTriageSystemPrompt` — snapshot tests for deterministic structure.

### Integration Tests

v1 uses manual verification via the Inngest dashboard (Phase 5). Future integration tests should exercise the full Inngest → DB → proxy → LLM chain against a mocked provider.

### Manual Testing Steps

Captured in Phase 5 manual verification checklist.

## Performance Considerations

- **LLM cost**: ~3000 tokens input + ~100 tokens output per triage call on Haiku 4.5 → sub-cent per event. No gating needed at expected event volumes.
- **Proxy call volume**: One triage triggers 2 + N fetcher calls (SPEC.md probe + skills dir listing + N skill SKILL.md reads + N command probes). For N=5 skills, ~12 GitHub API calls per event. Each call uses the cached installation token — no token-mint overhead after the first call.
- **Concurrency**: Capped at 5 per org to avoid runaway costs from noisy orgs.
- **Cold-start latency**: First call per installation mints a token (~500ms). Subsequent calls in the same minute use the cached token (<50ms each).

## Migration Notes

No migration — purely additive. No DB schema changes. No breaking changes to existing event consumers.

## References

- Research doc: `thoughts/shared/research/2026-04-18-lightfast-agent-runtime-v1.md`
- Event emission: `api/platform/src/inngest/functions/platform-event-store.ts:557-566`
- Event schema: `api/platform/src/inngest/schemas/platform.ts:73-79`
- Listener template: `api/platform/src/inngest/functions/platform-entity-graph.ts:17-53`
- Repo resolution pattern: `api/platform/src/inngest/functions/platform-repo-index-sync.ts:50-106`
- Function registration: `api/platform/src/inngest/index.ts:50-65`
- Proxy execute: `api/platform/src/router/platform/proxy.ts:90-264`
- Proxy caller with 404 handling: `api/app/src/router/org/connections.ts:355-378`
- `createPlatformCaller`: `packages/platform-trpc/src/caller.ts:20`
- Package template: `packages/prompt-engine/package.json`, `packages/prompt-engine/tsconfig.json`
- Gateway + generateObject pattern: `packages/app-rerank/src/providers/llm.ts`
- YAML parser precedent: `api/app/src/router/org/connections.ts:18,398`
- `orgEvents` schema (note: column is `externalId`, not `eventExternalId`): `db/app/src/schema/tables/org-events.ts`
- `orgRepoIndexes` schema: `db/app/src/schema/tables/org-repo-indexes.ts`
- GitHub `get-file-contents` endpoint: `packages/app-providers/src/providers/github/api.ts:154-169`
- `ApiEndpoint.method` limited to `"GET" | "POST"`: `packages/app-providers/src/provider/api.ts:77`
