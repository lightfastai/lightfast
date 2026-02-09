# Console AI Types & Console AI Packages Implementation Plan

## Overview

Create two new packages — `@repo/console-ai-types` and `@repo/console-ai` — that mirror the `@repo/chat-ai-types` and `@repo/chat-ai` pattern for the console answer feature. This brings typed tool definitions, discriminated union UI parts, and a clean package boundary to the console's AI workspace assistant.

## Current State Analysis

### What Exists

- **`apps/console/src/ai/types.ts`**: Minimal `AnswerRuntimeContext` and `AnswerMessage` types
- **`apps/console/src/ai/tools/*.ts`**: 5 tool implementations with inline Zod schemas, no output schemas, `as unknown as` context casts, and eslint-disable comments
- **`apps/console/src/components/answer-tool-call-renderer.tsx`**: String-based tool dispatcher with untyped `ToolUIPart`, generic `output as Parameters<typeof SearchToolResult>[0]["data"]` casts
- **`@repo/console-types`**: Already has `V1SearchResponse`, `V1ContentsResponse`, `V1FindSimilarResponse`, `GraphResponse`, `RelatedResponse` — perfect tool output types
- **Logic functions** in `apps/console/src/lib/v1/` have deep dependencies on `@db/console`, `@vendor/observability`, `@repo/console-rerank`, etc. — cannot be imported from a standalone package

### What's Missing

- No tool input/output type interfaces (only inline Zod)
- No output schemas on tools
- No typed tool UI parts (discriminated unions)
- No typed message type (bare `UIMessage`)
- Context casts everywhere instead of proper generic typing
- No separation between tool type contracts and tool implementations

### Key Constraint: Logic Function Dependencies

The logic functions (`searchLogic`, `contentsLogic`, `graphLogic`, etc.) import `@db/console`, `@vendor/observability`, and app-internal modules. The `@repo/console-ai` package **cannot** import these directly. Tools must receive logic functions via **dependency injection** through the runtime context, matching how `@repo/chat-ai` tools receive handlers via `context.tools?.createDocument?.handlers`.

## Desired End State

After this plan is complete:

1. `@repo/console-ai-types` exports all type definitions for the answer feature:
   - Tool input/output interfaces matching `@repo/console-types` schemas
   - `AnswerToolSet` type mapping tool names to input/output contracts
   - `ToolUIPartState` discriminated unions for all 5 tools
   - `AnswerRuntimeContext`, `AnswerRuntimeConfig` (tool config injection)
   - `LightfastAnswerRuntimeContext` named alias
   - `LightfastAnswerUIMessage` with metadata generics
   - Type guards: `isTextPart`, `isReasoningPart`, `isToolPart`

2. `@repo/console-ai` exports 5 tool factories with typed schemas:
   - Each tool uses `createTool<LightfastAnswerRuntimeContext, typeof inputSchema, typeof outputSchema>`
   - Logic functions injected via `context.tools?.workspaceSearch?.handler`
   - No eslint-disable needed, no context casts
   - Output schemas derived from `@repo/console-types` Zod schemas

3. `apps/console` consumes both packages:
   - Route handler creates agent with `@repo/console-ai` tools and injects logic handlers via runtime context
   - UI components use typed tool UI parts from `@repo/console-ai-types` for exhaustive state handling
   - `apps/console/src/ai/tools/` directory is removed
   - `apps/console/src/ai/types.ts` is reduced to app-specific concerns (memory context)

### Verification

- `pnpm typecheck` passes across the monorepo
- `pnpm build:console` succeeds
- Console answer feature works identically (streaming, tool rendering, error handling)

## What We're NOT Doing

- **Not** adding Braintrust tracing to console tools (console tools call logic functions that have their own observability)
- **Not** creating a `@repo/console-ai/errors` or attachments module (console answer doesn't need these yet)
- **Not** changing the answer API route structure or memory implementation
- **Not** modifying the logic functions themselves (they stay in `apps/console/src/lib/v1/`)
- **Not** adding custom data types for artifact streaming (console answer doesn't use artifacts)
- **Not** aligning `GraphLogicOutput`/`RelatedLogicOutput` with `@repo/console-types` in this plan (the output types in console-types already match structurally; we'll use them as-is)

## Implementation Approach

Mirror the chat package architecture:

```
@repo/console-ai-types          @repo/console-ai              apps/console
──────────────────────           ────────────────              ─────────────
SearchToolInput  ───────────→   workspaceSearchTool()  ──→   answerTools
SearchToolOutput                  - typed schemas              - ToolFactorySet<...>
SearchToolUIPart                  - context.tools.handler
LightfastAnswerRuntimeContext     - outputSchema             route.ts
AnswerAppRuntimeContext                                       - injects logic handlers
AnswerToolSet                                                 - createRuntimeContext with tool configs
LightfastAnswerUIMessage
                                                             answer-tool-call-renderer.tsx
                                                              - toolPart as SearchToolUIPart
                                                              - per-tool typed rendering
```

---

## Phase 1: Create `@repo/console-ai-types` Package

### Overview
Establish the type package with tool input/output interfaces, tool set definition, typed UI parts, runtime context types, and type guards.

### Changes Required:

#### 1. Package Configuration
**File**: `packages/console-ai-types/package.json` (new)

```json
{
  "name": "@repo/console-ai-types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./src/index.ts"
    }
  },
  "license": "MIT",
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc --watch",
    "format": "prettier --check . --ignore-path ../../.gitignore",
    "lint": "eslint",
    "typecheck": "tsc --noEmit --emitDeclarationOnly false"
  },
  "dependencies": {
    "@lightfastai/ai-sdk": "workspace:*",
    "@repo/console-types": "workspace:*",
    "ai": "catalog:"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/prettier-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "eslint": "catalog:",
    "prettier": "catalog:",
    "typescript": "catalog:"
  },
  "prettier": "@repo/prettier-config"
}
```

**File**: `packages/console-ai-types/tsconfig.json` (new)

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

#### 2. Main Types Module
**File**: `packages/console-ai-types/src/index.ts` (new)

This file defines:

**Tool Input Interfaces** — Matching the inline Zod schemas currently in `apps/console/src/ai/tools/*.ts`:

```typescript
import type { DeepPartial, UIMessage } from "ai";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import type {
  V1SearchResponse,
  V1ContentsResponse,
  V1FindSimilarResponse,
  GraphResponse,
  RelatedResponse,
} from "@repo/console-types";

// ─── Tool Input Types ────────────────────────────────────────────

export interface SearchToolInput {
  query: string;
  mode?: "fast" | "balanced" | "thorough";
  limit?: number;
  filters?: {
    sourceTypes?: string[];
    observationTypes?: string[];
    actorNames?: string[];
  };
}

export interface ContentsToolInput {
  ids: string[];
}

export interface FindSimilarToolInput {
  id: string;
  limit?: number;
  threshold?: number;
}

export interface GraphToolInput {
  id: string;
  depth?: number;
  limit?: number;
}

export interface RelatedToolInput {
  id: string;
  limit?: number;
}

// ─── Tool Output Types ───────────────────────────────────────────
// Re-export from @repo/console-types for single import convenience

export type SearchToolOutput = V1SearchResponse;
export type ContentsToolOutput = V1ContentsResponse;
export type FindSimilarToolOutput = V1FindSimilarResponse;
export type GraphToolOutput = GraphResponse;
export type RelatedToolOutput = RelatedResponse;

// ─── Tool Set Definition ─────────────────────────────────────────

export type AnswerToolSet = {
  workspaceSearch: {
    input: SearchToolInput;
    output: SearchToolOutput;
  };
  workspaceContents: {
    input: ContentsToolInput;
    output: ContentsToolOutput;
  };
  workspaceFindSimilar: {
    input: FindSimilarToolInput;
    output: FindSimilarToolOutput;
  };
  workspaceGraph: {
    input: GraphToolInput;
    output: GraphToolOutput;
  };
  workspaceRelated: {
    input: RelatedToolInput;
    output: RelatedToolOutput;
  };
};

export type AnswerToolName = keyof AnswerToolSet;

export type AnswerToolInput<T extends AnswerToolName> =
  AnswerToolSet[T]["input"];
export type AnswerToolOutput<T extends AnswerToolName> =
  AnswerToolSet[T]["output"];

// ─── Tool UI Part State ──────────────────────────────────────────

type ToolUIPartState<
  TName extends string,
  TInput,
  TOutput,
> =
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "input-streaming";
      input: DeepPartial<TInput> | undefined;
    }
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "input-available";
      input: TInput;
    }
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "output-available";
      input: TInput;
      output: TOutput;
    }
  | {
      type: `tool-${TName}`;
      toolCallId: string;
      state: "output-error";
      input: TInput | undefined;
      errorText: string;
    };

export type SearchToolUIPart = ToolUIPartState<
  "workspaceSearch",
  SearchToolInput,
  SearchToolOutput
>;
export type ContentsToolUIPart = ToolUIPartState<
  "workspaceContents",
  ContentsToolInput,
  ContentsToolOutput
>;
export type FindSimilarToolUIPart = ToolUIPartState<
  "workspaceFindSimilar",
  FindSimilarToolInput,
  FindSimilarToolOutput
>;
export type GraphToolUIPart = ToolUIPartState<
  "workspaceGraph",
  GraphToolInput,
  GraphToolOutput
>;
export type RelatedToolUIPart = ToolUIPartState<
  "workspaceRelated",
  RelatedToolInput,
  RelatedToolOutput
>;

export type AnswerToolUIPart =
  | SearchToolUIPart
  | ContentsToolUIPart
  | FindSimilarToolUIPart
  | GraphToolUIPart
  | RelatedToolUIPart;

// ─── Message Types ───────────────────────────────────────────────

export interface LightfastAnswerUIMessageMetadata {
  sessionId?: string;
  resourceId?: string;
}

export type LightfastAnswerUIMessage = UIMessage<
  LightfastAnswerUIMessageMetadata
>;

// ─── Runtime Context ─────────────────────────────────────────────

/** Handler signature for logic functions injected at runtime */
export interface SearchToolHandler {
  (input: SearchToolInput): Promise<SearchToolOutput>;
}
export interface ContentsToolHandler {
  (input: ContentsToolInput): Promise<ContentsToolOutput>;
}
export interface FindSimilarToolHandler {
  (input: FindSimilarToolInput): Promise<FindSimilarToolOutput>;
}
export interface GraphToolHandler {
  (input: GraphToolInput): Promise<GraphToolOutput>;
}
export interface RelatedToolHandler {
  (input: RelatedToolInput): Promise<RelatedToolOutput>;
}

/** Runtime configuration for tool handlers, injected per-request */
export interface AnswerToolRuntimeConfig {
  workspaceSearch?: { handler: SearchToolHandler };
  workspaceContents?: { handler: ContentsToolHandler };
  workspaceFindSimilar?: { handler: FindSimilarToolHandler };
  workspaceGraph?: { handler: GraphToolHandler };
  workspaceRelated?: { handler: RelatedToolHandler };
}

/** Application runtime context for the answer agent */
export interface AnswerAppRuntimeContext {
  userId?: string;
  workspaceId: string;
  authToken?: string;
  tools?: AnswerToolRuntimeConfig;
}

/** Full runtime context (SystemContext & RequestContext & AnswerAppRuntimeContext) */
export type LightfastAnswerRuntimeContext =
  RuntimeContext<AnswerAppRuntimeContext>;

// ─── Type Guards ─────────────────────────────────────────────────

export function isTextPart(
  part: { type: string },
): part is { type: "text"; text: string } {
  return part.type === "text";
}

export function isReasoningPart(
  part: { type: string },
): part is { type: "reasoning"; reasoning: string } {
  return part.type === "reasoning";
}

export function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-");
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Package created with correct structure: `ls packages/console-ai-types/src/index.ts`
- [ ] `pnpm install` resolves dependencies
- [ ] `pnpm --filter @repo/console-ai-types typecheck` passes

#### Manual Verification:
- [ ] Types are importable from `@repo/console-ai-types` in other packages

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Create `@repo/console-ai` Package

### Overview
Create the tool factory package with typed schemas, output schemas, and handler-based dependency injection.

### Changes Required:

#### 1. Package Configuration
**File**: `packages/console-ai/package.json` (new)

```json
{
  "name": "@repo/console-ai",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./workspace-search": {
      "default": "./src/workspace-search.ts"
    },
    "./workspace-contents": {
      "default": "./src/workspace-contents.ts"
    },
    "./workspace-find-similar": {
      "default": "./src/workspace-find-similar.ts"
    },
    "./workspace-graph": {
      "default": "./src/workspace-graph.ts"
    },
    "./workspace-related": {
      "default": "./src/workspace-related.ts"
    }
  },
  "license": "MIT",
  "scripts": {
    "build": "tsc",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "dev": "tsc --watch",
    "format": "prettier --check . --ignore-path ../../.gitignore",
    "lint": "eslint",
    "typecheck": "tsc --noEmit --emitDeclarationOnly false"
  },
  "dependencies": {
    "@lightfastai/ai-sdk": "workspace:*",
    "@repo/console-ai-types": "workspace:*",
    "@repo/console-types": "workspace:*",
    "ai": "catalog:",
    "zod": "catalog:zod3"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/prettier-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "eslint": "catalog:",
    "prettier": "catalog:",
    "typescript": "catalog:"
  },
  "prettier": "@repo/prettier-config"
}
```

**File**: `packages/console-ai/tsconfig.json` (new)

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

#### 2. Tool Implementations

Each tool follows this pattern:
1. Import typed input/output interfaces from `@repo/console-ai-types`
2. Define Zod schemas typed to match: `const inputSchema: z.ZodType<SearchToolInput> = z.object({...})`
3. Use output schemas from `@repo/console-types` Zod schemas
4. Call `createTool<LightfastAnswerRuntimeContext, typeof inputSchema, typeof outputSchema>`
5. Access handler from `context.tools?.workspaceSearch?.handler`

**File**: `packages/console-ai/src/workspace-search.ts` (new)

```typescript
import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type { SearchToolInput, SearchToolOutput, LightfastAnswerRuntimeContext } from "@repo/console-ai-types";
import { V1SearchResponseSchema } from "@repo/console-types";

const inputSchema: z.ZodType<SearchToolInput> = z.object({
  query: z.string().describe("The search query text"),
  mode: z
    .enum(["fast", "balanced", "thorough"])
    .default("balanced")
    .describe("Search quality mode"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .describe("Max results"),
  filters: z
    .object({
      sourceTypes: z.array(z.string()).optional().describe("Filter by source: github, linear, vercel, sentry"),
      observationTypes: z.array(z.string()).optional().describe("Filter by type: commit, pull_request, issue, deployment"),
      actorNames: z.array(z.string()).optional().describe("Filter by actor name"),
    })
    .optional(),
});

const outputSchema: z.ZodType<SearchToolOutput> = V1SearchResponseSchema;

export function workspaceSearchTool() {
  return createTool<LightfastAnswerRuntimeContext, typeof inputSchema, typeof outputSchema>({
    description:
      "Search through workspace neural memory for relevant documents and observations. Use this to find commits, PRs, issues, deployments, and other development events. Returns ranked results with scores, snippets, source types, and extracted entities.",
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceSearch?.handler;
      if (!handler) {
        throw new Error("Workspace search handler not configured in runtime context.");
      }
      return handler(input);
    },
  });
}
```

**File**: `packages/console-ai/src/workspace-contents.ts` (new)

```typescript
import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type { ContentsToolInput, ContentsToolOutput, LightfastAnswerRuntimeContext } from "@repo/console-ai-types";
import { V1ContentsResponseSchema } from "@repo/console-types";

const inputSchema: z.ZodType<ContentsToolInput> = z.object({
  ids: z.array(z.string()).describe("Array of observation IDs to fetch content for"),
});

const outputSchema: z.ZodType<ContentsToolOutput> = V1ContentsResponseSchema;

export function workspaceContentsTool() {
  return createTool<LightfastAnswerRuntimeContext, typeof inputSchema, typeof outputSchema>({
    description:
      "Fetch full content for specific observations by ID. Use this to get the complete details of a document after finding it via search or related queries.",
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceContents?.handler;
      if (!handler) {
        throw new Error("Workspace contents handler not configured in runtime context.");
      }
      return handler(input);
    },
  });
}
```

**File**: `packages/console-ai/src/workspace-find-similar.ts` (new)

```typescript
import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type { FindSimilarToolInput, FindSimilarToolOutput, LightfastAnswerRuntimeContext } from "@repo/console-ai-types";
import { V1FindSimilarResponseSchema } from "@repo/console-types";

const inputSchema: z.ZodType<FindSimilarToolInput> = z.object({
  id: z.string().describe("The observation ID to find similar items for"),
  limit: z.number().int().min(1).max(20).default(5).describe("Max similar items to return"),
  threshold: z.number().min(0).max(1).default(0.5).describe("Similarity threshold (0-1)"),
});

const outputSchema: z.ZodType<FindSimilarToolOutput> = V1FindSimilarResponseSchema;

export function workspaceFindSimilarTool() {
  return createTool<LightfastAnswerRuntimeContext, typeof inputSchema, typeof outputSchema>({
    description:
      "Find semantically similar content to a given document. Use this to discover related observations, expand search results, or find alternatives to a specific document.",
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceFindSimilar?.handler;
      if (!handler) {
        throw new Error("Workspace find-similar handler not configured in runtime context.");
      }
      return handler(input);
    },
  });
}
```

**File**: `packages/console-ai/src/workspace-graph.ts` (new)

```typescript
import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type { GraphToolInput, GraphToolOutput, LightfastAnswerRuntimeContext } from "@repo/console-ai-types";
import { GraphResponseSchema } from "@repo/console-types";

const inputSchema: z.ZodType<GraphToolInput> = z.object({
  id: z.string().describe("The observation ID to traverse from"),
  depth: z.number().int().min(1).max(3).default(1).describe("Relationship depth to traverse"),
  limit: z.number().int().min(1).max(50).default(20).describe("Max relationships to return"),
});

const outputSchema: z.ZodType<GraphToolOutput> = GraphResponseSchema;

export function workspaceGraphTool() {
  return createTool<LightfastAnswerRuntimeContext, typeof inputSchema, typeof outputSchema>({
    description:
      "Traverse the relationship graph between events. Use this to answer questions like 'which PR fixed which issue' or 'which deploy included which commits'. Returns connected nodes and their relationships across sources.",
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceGraph?.handler;
      if (!handler) {
        throw new Error("Workspace graph handler not configured in runtime context.");
      }
      return handler(input);
    },
  });
}
```

**File**: `packages/console-ai/src/workspace-related.ts` (new)

```typescript
import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type { RelatedToolInput, RelatedToolOutput, LightfastAnswerRuntimeContext } from "@repo/console-ai-types";
import { RelatedResponseSchema } from "@repo/console-types";

const inputSchema: z.ZodType<RelatedToolInput> = z.object({
  id: z.string().describe("The observation ID to find related events for"),
  limit: z.number().int().min(1).max(50).default(20).describe("Max related items to return"),
});

const outputSchema: z.ZodType<RelatedToolOutput> = RelatedResponseSchema;

export function workspaceRelatedTool() {
  return createTool<LightfastAnswerRuntimeContext, typeof inputSchema, typeof outputSchema>({
    description:
      "Get directly related events for a specific observation. Use this to find what happened around a particular event or to understand context. Returns related observations grouped by relationship type and source.",
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceRelated?.handler;
      if (!handler) {
        throw new Error("Workspace related handler not configured in runtime context.");
      }
      return handler(input);
    },
  });
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Package created with correct structure: `ls packages/console-ai/src/`
- [ ] `pnpm install` resolves dependencies
- [ ] `pnpm --filter @repo/console-ai typecheck` passes

#### Manual Verification:
- [ ] Tool factories can be imported from `@repo/console-ai/workspace-search` etc.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Migrate `apps/console` to Use New Packages

### Overview
Update the console app to consume `@repo/console-ai-types` and `@repo/console-ai`, remove the old inline tool implementations, and wire up the handler-based dependency injection in the route handler.

### Changes Required:

#### 1. Add Dependencies
**File**: `apps/console/package.json`
**Changes**: Add `@repo/console-ai-types` and `@repo/console-ai` to dependencies

```json
"@repo/console-ai-types": "workspace:*",
"@repo/console-ai": "workspace:*",
```

#### 2. Update Route Handler with Handler Injection
**File**: `apps/console/src/app/(api)/v1/answer/[...v]/route.ts`
**Changes**: Import tools from `@repo/console-ai`, inject logic function handlers via `createRuntimeContext`, import types from `@repo/console-ai-types`

The `createRuntimeContext` function changes from:
```typescript
createRuntimeContext: () => ({ workspaceId, userId, authToken })
```
To:
```typescript
createRuntimeContext: () => ({
  workspaceId,
  userId,
  authToken,
  tools: {
    workspaceSearch: {
      handler: async (input) => searchLogic(authContext, {
        query: input.query,
        mode: input.mode ?? "balanced",
        limit: input.limit ?? 10,
        offset: 0,
        filters: input.filters,
        includeContext: true,
        includeHighlights: true,
        requestId: randomUUID(),
      }),
    },
    workspaceContents: {
      handler: async (input) => contentsLogic(authContext, {
        ids: input.ids,
        requestId: randomUUID(),
      }),
    },
    workspaceFindSimilar: {
      handler: async (input) => findsimilarLogic(authContext, {
        id: input.id,
        limit: input.limit ?? 5,
        threshold: input.threshold ?? 0.5,
        requestId: randomUUID(),
      }),
    },
    workspaceGraph: {
      handler: async (input) => graphLogic(authContext, {
        observationId: input.id,
        depth: input.depth ?? 1,
        requestId: randomUUID(),
      }),
    },
    workspaceRelated: {
      handler: async (input) => relatedLogic(authContext, {
        observationId: input.id,
        requestId: randomUUID(),
      }),
    },
  },
})
```

Where `authContext = { workspaceId, userId, authType: "session" as const }`.

The tool imports change from:
```typescript
import { answerTools } from "~/ai/tools";
```
To:
```typescript
import type { AnswerAppRuntimeContext } from "@repo/console-ai-types";
import { workspaceSearchTool } from "@repo/console-ai/workspace-search";
import { workspaceContentsTool } from "@repo/console-ai/workspace-contents";
import { workspaceFindSimilarTool } from "@repo/console-ai/workspace-find-similar";
import { workspaceGraphTool } from "@repo/console-ai/workspace-graph";
import { workspaceRelatedTool } from "@repo/console-ai/workspace-related";
```

The tools assembly:
```typescript
const answerTools = {
  workspaceSearch: workspaceSearchTool(),
  workspaceContents: workspaceContentsTool(),
  workspaceFindSimilar: workspaceFindSimilarTool(),
  workspaceGraph: workspaceGraphTool(),
  workspaceRelated: workspaceRelatedTool(),
};
```

The agent generic changes from:
```typescript
createAgent<AnswerRuntimeContext, typeof answerTools>
```
To:
```typescript
createAgent<AnswerAppRuntimeContext, typeof answerTools>
```

#### 3. Update Types File
**File**: `apps/console/src/ai/types.ts`
**Changes**: Remove `AnswerRuntimeContext` (now in `@repo/console-ai-types`), keep `AnswerMemoryContext` and `AnswerMessage`

```typescript
import type { LightfastAnswerUIMessage } from "@repo/console-ai-types";

/** Context passed through memory operations */
export interface AnswerMemoryContext {
  workspaceId: string;
}

/** Answer-specific message type */
export type AnswerMessage = LightfastAnswerUIMessage;
```

#### 4. Delete Old Tool Files
**Files to delete**:
- `apps/console/src/ai/tools/search.ts`
- `apps/console/src/ai/tools/contents.ts`
- `apps/console/src/ai/tools/find-similar.ts`
- `apps/console/src/ai/tools/graph.ts`
- `apps/console/src/ai/tools/related.ts`
- `apps/console/src/ai/tools/index.ts`

#### 5. Update Tool Call Renderer with Typed Parts
**File**: `apps/console/src/components/answer-tool-call-renderer.tsx`
**Changes**: Import typed tool UI parts from `@repo/console-ai-types`, replace string-based state checks with typed assertions

Key changes:
- Import `SearchToolUIPart`, `ContentsToolUIPart`, etc. from `@repo/console-ai-types`
- In the `output-available` case, cast to specific types:
  ```typescript
  case "workspaceSearch":
    return <SearchToolResult data={(toolPart as SearchToolUIPart & { state: "output-available" }).output} />;
  ```
- This eliminates the `output as Parameters<typeof SearchToolResult>[0]["data"]` casts

#### 6. Update Tool Results with Typed Props
**File**: `apps/console/src/components/answer-tool-results.tsx`
**Changes**: Import output types from `@repo/console-ai-types` instead of `@repo/console-types` directly

```typescript
import type { SearchToolOutput, ContentsToolOutput, FindSimilarToolOutput } from "@repo/console-ai-types";
```

Props become:
```typescript
interface SearchToolResultProps { data: SearchToolOutput; }
interface ContentsToolResultProps { data: ContentsToolOutput; }
interface FindSimilarToolResultProps { data: FindSimilarToolOutput; }
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @repo/console-ai-types typecheck` passes
- [ ] `pnpm --filter @repo/console-ai typecheck` passes
- [ ] `pnpm --filter @lightfast/console typecheck` passes
- [ ] `pnpm build:console` succeeds
- [ ] `pnpm lint` passes
- [ ] Old tool files are deleted: `! test -f apps/console/src/ai/tools/search.ts`

#### Manual Verification:
- [ ] Console answer feature works: can ask a question and get streaming tool results
- [ ] Search results render correctly with cards and metadata
- [ ] Contents results render correctly
- [ ] Find-similar results render correctly
- [ ] Graph and related tools render with JSON accordion fallback
- [ ] Error states display correctly in the accordion
- [ ] Loading states (input-streaming, input-available) show correct spinners

**Implementation Note**: After completing this phase and all verification passes, the migration is complete.

---

## Testing Strategy

### Type Safety Tests (Automated via typecheck):
- Tool input types match Zod schemas (enforced by `z.ZodType<Interface>`)
- Tool output types match `@repo/console-types` schemas
- Runtime context type flows through agent → tool execution
- UI part discriminated unions narrow correctly

### Integration Tests (Manual):
1. Start dev server: `pnpm dev:app`
2. Open console, navigate to workspace
3. Use the "Ask Lightfast" feature
4. Send queries that trigger each tool:
   - "What recent commits were made?" → workspaceSearch
   - "Show me the full details of observation X" → workspaceContents
   - "Find items similar to X" → workspaceFindSimilar
   - "What's related to this PR?" → workspaceGraph / workspaceRelated
5. Verify streaming states (sparkles animation → spinner → results)
6. Verify error handling (disconnect network, check error accordion)

## Performance Considerations

- No runtime performance impact — changes are purely structural/type-level
- Handler closures add negligible overhead (one function wrapper per tool call)
- Output schemas add Zod validation at tool completion, which is minimal for these response sizes

## References

- Research document: `thoughts/shared/research/2026-02-06-chat-ai-patterns-for-console-answer.md`
- Chat types reference: `packages/chat-ai-types/src/index.ts`
- Chat tools reference: `packages/chat-ai/src/web-search.ts`, `packages/chat-ai/src/create-document.ts`
- Console types reference: `packages/console-types/src/api/v1/`
- Console tools (current): `apps/console/src/ai/tools/`
- Console route (current): `apps/console/src/app/(api)/v1/answer/[...v]/route.ts`
- Console UI (current): `apps/console/src/components/answer-tool-call-renderer.tsx`
