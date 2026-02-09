---
date: 2026-02-07
researcher: codebase-agent
topic: "Chat system prompt architecture — codebase deep dive"
tags: [research, codebase, system-prompt, answer-agent, prompt-engineering]
status: complete
---

# Codebase Deep Dive: System Prompt Architecture

## Research Question

Design a better system prompt architecture for Lightfast's Answer agent — covering prompt engineering integration, model selection, tone/grammar extensibility, dynamic workspace context from DB, temporal memory surfacing, per-tool prompt tuning, and deep infrastructure integration.

## Summary

The current Answer agent system prompt is a **single static function** (`buildAnswerSystemPrompt()`) with hardcoded workspace context. It produces a ~25-line string with no dynamic data, no temporal awareness, no auth-context-awareness, and no per-tool guidance. The model is hardcoded to `anthropic/claude-sonnet-4-5-20250929` with no model-aware prompt budgeting.

Meanwhile, the **Chat app** (`apps/chat`) has already built a composable prompt builder architecture with priority-based token budgeting, feature flags, section providers, temporal context, user/workspace context, communication style variants, and per-tool guidance. This architecture is production-ready and serves as the reference design.

The database contains **rich workspace metadata** that is completely unused by the Answer prompt — workspace integrations (GitHub repos, Vercel projects), actor profiles, temporal state tracking (bi-temporal SCD Type 2), observation clusters with LLM-generated summaries, and neural entities. All of this could dynamically enrich the system prompt to give the model deep workspace awareness.

## Detailed Findings

### 1. Current Answer Agent System Prompt

**File:** `apps/console/src/ai/prompts/system-prompt.ts:1-33`

The entire prompt system is two exports:

```typescript
export function buildAnswerSystemPrompt(workspaceContext: {
  projectName: string;
  projectDescription: string;
}): string { /* 25-line template literal */ }

export const HARDCODED_WORKSPACE_CONTEXT = {
  projectName: "Lightfast",
  projectDescription: "Lightfast is a pnpm monorepo...",
};
```

**Issues identified:**

1. **Hardcoded workspace context** (`system-prompt.ts:29-33`) — The workspace name and description are string literals, not fetched from DB. Every workspace gets the same "Lightfast" context regardless of what project they're working on.

2. **No temporal awareness** — The model doesn't know the current date/time. Questions like "what happened this week?" have no grounding.

3. **No auth context** — The prompt doesn't differentiate between API key users, session users, or anonymous users.

4. **No dynamic tool descriptions** — Tool names and descriptions are hardcoded in the prompt string, duplicating what's already in the Zod schemas.

5. **No token budgeting** — The prompt is always the same size regardless of model context window.

6. **No security section** — Unlike the Chat app, there's no security/safety policy.

7. **No communication style** — No way to adjust tone (formal, concise, technical, friendly).

8. **No citation format** — No structured citation guidance for referencing observations.

**How it's used** (`route.ts:78`):
```typescript
const systemPrompt = buildAnswerSystemPrompt(HARDCODED_WORKSPACE_CONTEXT);
```

Called identically in both POST (line 78) and GET (line 240) handlers.

### 2. Answer API Route Architecture

**File:** `apps/console/src/app/(api)/v1/answer/[...v]/route.ts:1-377`

**Key components:**

- **Model:** Hardcoded `"anthropic/claude-sonnet-4-5-20250929"` (line 32). No model selection logic.
- **Auth:** `withDualAuth()` supports API key (`sk-lf-*`) and Clerk session auth (line 49-53).
- **Agent creation:** Uses `createAgent<AnswerAppRuntimeContext>()` from `@lightfastai/ai-sdk/agent` (line 88-181).
- **Tools:** 5 tools wired via tool factories (lines 35-41).
- **Runtime context:** `createRuntimeContext()` provides `workspaceId`, `userId`, `authToken`, and per-tool handlers (line 92-177).
- **Memory:** `AnswerRedisMemory` with 1-hour TTL (line 184).
- **Stream config:** `smoothStream({ delayInMs: 10 })`, `stepCountIs(8)` stop condition (lines 179-180).

**What `createAgent()` expects** (`core/ai-sdk/src/core/primitives/agent.ts:315-323`):
```typescript
export function createAgent<TRuntimeContext, TTools>(
  options: AgentOptions<TRuntimeContext, TTools>
): Agent<TRuntimeContext, TTools>
```

The `system` field is a plain string. The agent prepends it as a system message to model messages (line 269-271 in agent.ts). With cache provider, it splits into cacheable system messages.

### 3. Chat App Composable Prompt Builder (Reference Architecture)

The Chat app has a fully composable prompt system across 14 files. Here's the architecture:

#### 3a. Type System (`apps/chat/src/ai/prompts/types.ts:1-103`)

```typescript
interface PromptSection {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  render(): string;
  estimateTokens(): number;
}

type SectionProvider = (context: PromptContext) => PromptSection | null;

interface PromptContext {
  auth: { isAnonymous: boolean; userId: string; clerkUserId: string | null };
  billing: { plan: string; limits: Record<string, unknown> };
  model: { id: string; provider: string; maxOutputTokens: number };
  activeTools: string[];
  webSearchEnabled: boolean;
  features: Required<PromptFeatureFlags>;
  style: CommunicationStyle; // "formal" | "concise" | "technical" | "friendly"
  temporalContext?: TemporalContext;
  userContext?: UserContext;
}

interface PromptFeatureFlags {
  temporalContext?: boolean;
  style?: boolean;
  toolGuidance?: boolean;
  userContext?: boolean;
}
```

**Key design decisions:**
- Sections return `null` to opt out (feature flag gating)
- Priority determines inclusion order AND trimming behavior
- `"critical"` sections are NEVER trimmed (identity, security, core-behavior)
- Token estimation happens before rendering for budget enforcement

#### 3b. Prompt Builder (`apps/chat/src/ai/prompts/builders/prompt-builder.ts:1-69`)

```typescript
export function buildPrompt(context: PromptContext, providers: SectionProvider[]): string
```

Algorithm:
1. Call each provider with context, collect non-null sections
2. Sort by priority (critical -> high -> medium -> low)
3. Token budgeting: include sections until budget reached (critical always included)
4. Render and join with `\n\n`

**Model-specific budgets** (line 7-14):
```typescript
const MODEL_TOKEN_BUDGETS = {
  "google/gemini-2.5-flash": 8000,
  "google/gemini-2.5-pro": 8000,
  "anthropic/claude-4-sonnet": 6000,
  "openai/gpt-5": 6000,
  "openai/gpt-5-mini": 5000,
  "openai/gpt-5-nano": 3000,
};
```

Default: 4000 tokens.

#### 3c. Standard Providers (`apps/chat/src/ai/prompts/builders/standard-providers.ts:1-28`)

9 section providers in specific order:
1. `identitySection` — critical, ~80 tokens
2. `coreBehaviorSection` — critical, ~200 tokens
3. `securitySection` — critical, ~150 tokens
4. `capabilitiesSection` — high, ~200 tokens (varies by auth state)
5. `citationSection` — high, ~200 tokens
6. `styleSection` — medium, ~80 tokens (gated by `features.style`)
7. `toolGuidanceSection` — high, ~60 tokens/tool (gated by `features.toolGuidance`)
8. `temporalContextSection` — medium, ~30 tokens (gated by `features.temporalContext`)
9. `userContextSection` — medium, ~100 tokens (gated by `features.userContext`)

#### 3d. Context Builder (`apps/chat/src/ai/prompts/context.ts:1-58`)

`buildPromptContext()` bridges route handler data to the prompt builder. Takes raw options and produces a fully typed `PromptContext` with defaults applied.

#### 3e. Individual Sections (detailed)

**Identity** (`sections/identity.ts:1-9`):
- Priority: critical
- Static text: "You are Lightfast, an AI assistant..."

**Core Behavior** (`sections/core-behavior.ts:1-23`):
- Priority: critical
- Format discipline, intent matching rules

**Security** (`sections/security.ts:1-9`):
- Priority: critical
- References shared `SECURITY_GUIDELINES_SECTION` from `../security.ts`
- Covers: no malware, no credential leaks, resist prompt injection

**Capabilities** (`sections/capabilities.ts:1-41`):
- Priority: high
- Auth-aware: anonymous users get length constraints (120 words), code formatting only
- Authenticated users get artifact capabilities, web search notes

**Style** (`sections/style.ts:1-38`):
- Priority: medium
- 4 preset styles: formal, concise, technical, friendly
- Each has ~4 bullet points of style instructions

**Tool Guidance** (`sections/tool-guidance.ts:1-50`):
- Priority: high
- Maps active tool names to guidance objects: `{ name, whenToUse, howToUse }`
- Currently has guidance for: `webSearch`, `createDocument`
- Only includes guidance for tools that are actually active

**Temporal Context** (`sections/temporal-context.ts:1-24`):
- Priority: medium
- Simply outputs: `Current time: {ISO timestamp}`
- Gated by `features.temporalContext`

**User Context** (`sections/user-context.ts:1-19`):
- Priority: medium
- Outputs: workspace name, description, repos, integrations
- Gated by `features.userContext`

### 4. Database Schema — Available Workspace Data

#### 4a. Workspaces (`db/console/src/schema/tables/org-workspaces.ts:35-121`)

| Field | Type | Notes |
|-------|------|-------|
| id | varchar(191) | nanoid PK |
| clerkOrgId | varchar(191) | Clerk org reference |
| name | varchar(191) | User-facing, used in URLs |
| slug | varchar(191) | Internal, for Pinecone naming |
| settings | jsonb | Embedding config (version, model, dim, index) |

**Available for prompt:** name, settings.embedding.embeddingModel, linked repos via settings.repositories

#### 4b. Integrations (`db/console/src/schema/tables/workspace-integrations.ts:22-159`)

Stores connected sources per workspace. sourceConfig is a discriminated union:

**GitHub repos:**
```typescript
{
  sourceType: "github", type: "repository",
  repoFullName: "acme/frontend", defaultBranch: "main",
  sync: { branches: ["main"], events: ["push", "pull_request", "issues"] }
}
```

**Vercel projects:**
```typescript
{
  sourceType: "vercel", type: "project",
  projectName: "my-nextjs-app", projectId: "prj_123"
}
```

**Available for prompt:** List of connected repos/projects, their names, sync status, document counts

#### 4c. Neural Observations (`db/console/src/schema/tables/workspace-neural-observations.ts:48-251`)

Core event table. Key fields for prompt:

| Field | Type | Prompt Value |
|-------|------|-------------|
| observationType | varchar(100) | "pr_merged", "deployment_succeeded", etc. |
| source | varchar(50) | "github", "vercel", "linear", "sentry" |
| occurredAt | timestamp | When event happened |
| topics | jsonb (string[]) | Extracted topics |
| significanceScore | real | 0-100 importance |
| actor | jsonb | Who did it |

#### 4d. Observation Relationships (`db/console/src/schema/tables/workspace-observation-relationships.ts:55-164`)

Typed edges between observations:
- Types: `fixes`, `resolves`, `triggers`, `deploys`, `references`, `same_commit`, `same_branch`, `tracked_in`
- Confidence scores (0.7-1.0)
- Detection methods: explicit, commit_match, branch_match, entity_cooccurrence

#### 4e. Temporal States (`db/console/src/schema/tables/workspace-temporal-states.ts:30-178`)

**Bi-temporal state tracking (SCD Type 2)**:
- Entity types: project, feature, service, sprint, issue, pr
- State types: status, progress, health, risk, priority, assignee
- `validFrom`/`validTo` for point-in-time queries
- `isCurrent` flag for fast lookups

**This is gold for prompt enrichment** — enables statements like "Project X is currently in_progress, changed from blocked 3 days ago."

#### 4f. Observation Clusters (`db/console/src/schema/tables/workspace-observation-clusters.ts:19-154`)

Topic-grouped collections:
- `topicLabel`: Human-readable topic
- `keywords`: jsonb string array
- `summary`: LLM-generated cluster summary
- `observationCount`, `firstObservationAt`, `lastObservationAt`
- `primaryEntities`, `primaryActors`

**Prompt value:** "Active work areas: Authentication refactor (15 events, last activity 2h ago), CI/CD migration (8 events, last activity 1d ago)"

#### 4g. Actor Profiles (`db/console/src/schema/tables/workspace-actor-profiles.ts:61-139`)

Per-workspace activity tracking:
- `displayName`, `email`
- `observationCount`, `lastActiveAt`
- `profileConfidence`

**Prompt value:** "Active contributors: @octocat (42 events), @alice (28 events)"

#### 4h. Neural Entities (`db/console/src/schema/tables/workspace-neural-entities.ts:26-169`)

Extracted structured entities:
- Categories: engineer, project, endpoint, etc.
- Canonical keys: "@sarah", "POST /api/users", "#123"
- `occurrenceCount`, `lastSeenAt`

**Prompt value:** "Frequently referenced: POST /api/users (seen 12 times), @sarah (seen 8 times)"

### 5. Tool Definitions & Descriptions

All 5 tools in `packages/console-ai/src/`:

#### workspaceSearch (`workspace-search.ts:43-63`)
- **Description:** "Search through workspace neural memory for relevant documents and observations. Use this to find commits, PRs, issues, deployments, and other development events. Returns ranked results with scores, snippets, source types, and extracted entities."
- **Input:** query (string), mode (fast|balanced|thorough), limit (1-20), filters (sourceTypes, observationTypes, actorNames)
- **Output:** V1SearchResponseSchema

#### workspaceContents (`workspace-contents.ts:16-36`)
- **Description:** "Fetch full content for specific observations by ID. Use this to get the complete details of a document after finding it via search or related queries."
- **Input:** ids (string[])
- **Output:** V1ContentsResponseSchema

#### workspaceFindSimilar (`workspace-find-similar.ts:30-50`)
- **Description:** "Find semantically similar content to a given document. Use this to discover related observations, expand search results, or find alternatives to a specific document."
- **Input:** id (string), limit (1-20), threshold (0-1)
- **Output:** V1FindSimilarResponseSchema

#### workspaceGraph (`workspace-graph.ts:30-50`)
- **Description:** "Traverse the relationship graph between events. Use this to answer questions like 'which PR fixed which issue' or 'which deploy included which commits'. Returns connected nodes and their relationships across sources."
- **Input:** id (string), depth (1-3), limit (1-50)
- **Output:** GraphResponseSchema

#### workspaceRelated (`workspace-related.ts:29-43`)
- **Description:** "Get directly related events for a specific observation. Use this to find what happened around a particular event or to understand context. Returns related observations grouped by relationship type and source."
- **Input:** id (string), limit (1-50)
- **Output:** RelatedResponseSchema

**Handler wiring** (`route.ts:96-176`): Each tool handler delegates to `*Logic()` functions from `~/lib/v1` which take `V1AuthContext` + operation-specific input. The runtime context closes over `authData.workspaceId` and `authData.userId`.

### 6. Memory System

**File:** `apps/console/src/ai/runtime/memory.ts:1-185`

`AnswerRedisMemory` implements `Memory<UIMessage, AnswerMemoryContext>`.

**Architecture:**
- **Storage:** Upstash Redis with JSON operations
- **TTL:** 1 hour for everything (sessions, messages, streams)
- **Key patterns:** `answer:session:{id}:metadata`, `answer:session:{id}:messages`, `answer:session:{id}:active_stream`
- **Operations:** createSession, getSession, appendMessage, getMessages, createStream, getActiveStream

**Memory context type** (`apps/console/src/ai/types.ts:4-6`):
```typescript
export interface AnswerMemoryContext {
  workspaceId: string;
}
```

**Temporal capabilities:**
- None currently. Messages are stored as flat arrays with no timestamp metadata.
- 1-hour TTL means all temporal state is lost after an hour.
- No mechanism to surface previous conversation context or "remember" across sessions.
- No integration with the workspace temporal states table.

### 7. Inngest Workflows & Indexing Pipeline

**File:** `api/console/src/inngest/workflow/neural/index.ts:1-14`

4 neural workflows:
1. **observationCapture** (`observation-capture.ts:336-1184`) — Main write path
2. **profileUpdate** — Actor profile updates (async)
3. **clusterSummaryCheck** — Cluster summary generation (async)
4. **llmEntityExtractionWorkflow** — LLM entity extraction (async)

**Observation capture pipeline** (8 steps):
1. Check duplicate (idempotency by sourceId)
2. Check event allowed (sourceConfig.sync.events filtering)
3. Evaluate significance (GATE: skip below threshold)
4. Fetch workspace context
5. PARALLEL: Classification (Claude Haiku) + Multi-view embeddings + Entity extraction + Actor resolution
6. Assign to cluster (semantic matching)
7. Upsert vectors to Pinecone (3 views: title, content, summary)
8. Store observation + entities (transactional) -> detect relationships -> emit events

**Relationship detection** (`relationship-detection.ts:45-493`):
- Detects edges via: commit SHA matching, branch name matching, issue ID co-occurrence, PR number matching
- Creates typed edges: fixes, resolves, triggers, deploys, references, same_commit, same_branch, tracked_in
- Confidence scoring: 1.0 for explicit, 0.8-0.9 for inferred

**Metadata carried on observations:**
- `observationType`, `source`, `sourceType`, `sourceId`
- `topics` (keyword + LLM-classified)
- `significanceScore` (0-100)
- `actor` (id, name, email, avatarUrl)
- `sourceReferences` (typed references: commit, branch, pr, issue, deployment, etc.)
- `metadata` (source-specific: repoId, branch, labels, etc.)

### 8. tRPC Data Endpoints — Available for Dynamic Prompt

**Router structure** (`api/console/src/root.ts:1-109`):
- `orgRouter.workspace.getByName` — Full workspace record (id, name, slug, settings, clerkOrgId)
- `orgRouter.workspace.sources.list` — Connected integrations with sourceConfig (repo names, project names, sync events, document counts)
- `orgRouter.workspace.store.get` — Embedding config + document count
- `orgRouter.workspace.getActors` — Actor profiles with displayNames and observation counts
- `orgRouter.workspace.jobs.stats` — Job completion rates, average durations
- `orgRouter.workspace.health.overview` — System health status (healthy/degraded/down)

**Auth boundary note:** Answer API uses `withDualAuth` which provides `workspaceId` and `userId`. From `workspaceId`, all the above data is fetchable. The workspace router uses `resolveWorkspaceByName` which goes org slug -> workspace, but for the Answer API we already have `workspaceId` directly.

### 9. Gaps and Opportunities

#### What's Hardcoded That Should Be Dynamic

| Current | Should Be |
|---------|-----------|
| Workspace name: "Lightfast" | Fetched from `orgWorkspaces.name` |
| Workspace description: static string | Generated from integrations + clusters |
| Model: `claude-sonnet-4-5-20250929` | Selectable, with prompt budgets per model |
| Tool descriptions in system prompt | Auto-generated from tool Zod schemas |
| No temporal awareness | Current timestamp + "last 24h" activity summary |
| No auth differentiation | API key users vs session users |

#### Temporal Data Exists But Isn't Used

1. **`workspaceTemporalStates`** — Bi-temporal state tracking with `isCurrent` flag. Could power "current project status" in prompt.
2. **`workspaceObservationClusters`** — LLM-generated summaries of activity clusters. Could power "what's happening now" section.
3. **`workspaceActorProfiles.lastActiveAt`** — Could power "who's active" in prompt.
4. **Observation `occurredAt` timestamps** — Could power time-range awareness.

#### User/Workspace Context That Could Enrich Prompt

1. **Connected repos:** "This workspace monitors: acme/frontend, acme/backend, acme/api"
2. **Active event types:** "Tracking: pushes, PRs, issues, deployments"
3. **Recent activity summary:** "Last 24h: 12 commits, 3 PRs merged, 2 deployments"
4. **Active clusters:** "Current work areas: Auth refactor (15 events), CI migration (8 events)"
5. **Top contributors:** "Active team: @octocat (42 events), @alice (28 events)"
6. **Integration health:** "All integrations healthy" or "GitHub sync failed 2h ago"

#### Per-Tool Prompting Improvements

Current: Generic "use workspaceSearch first for broad questions" instructions.

Could be:
- **workspaceSearch:** "Use `mode: 'thorough'` for complex questions. Use `filters.sourceTypes` to narrow by source. The workspace has {N} observations across {sources}."
- **workspaceGraph:** "Relationship types available: {list from schema}. Use `depth: 2` for transitive relationships like 'which deployment included the fix for issue X'."
- **workspaceFindSimilar:** "Useful for finding related events to a specific observation. Set `threshold: 0.7` for tighter matches."
- **workspaceContents:** "Always call this after search to get full content. Search results include snippets, contents returns the complete body."
- **workspaceRelated:** "Returns events grouped by relationship type (fixes, deploys, same_branch). Faster than graph for direct relationships."

## Code References

### Core Answer Agent
- `apps/console/src/ai/prompts/system-prompt.ts:1-33` — Current system prompt builder
- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts:1-377` — Answer API route
- `apps/console/src/ai/runtime/memory.ts:1-185` — AnswerRedisMemory
- `apps/console/src/ai/types.ts:1-9` — AnswerMemoryContext

### Chat App Reference Architecture
- `apps/chat/src/ai/prompts/types.ts:1-103` — Core types (PromptSection, PromptContext, SectionProvider)
- `apps/chat/src/ai/prompts/builders/prompt-builder.ts:1-69` — Token-budgeted builder
- `apps/chat/src/ai/prompts/builders/standard-providers.ts:1-28` — 9 section providers
- `apps/chat/src/ai/prompts/builders/system-prompt-builder.ts:1-143` — Legacy builder + composable wrapper
- `apps/chat/src/ai/prompts/context.ts:1-58` — Context bridge
- `apps/chat/src/ai/prompts/sections/*.ts` — 9 section implementations

### Database Schema
- `db/console/src/schema/tables/org-workspaces.ts:35-121` — Workspace table
- `db/console/src/schema/tables/workspace-integrations.ts:22-159` — Connected sources
- `db/console/src/schema/tables/workspace-neural-observations.ts:48-251` — Observations
- `db/console/src/schema/tables/workspace-observation-relationships.ts:55-164` — Relationship graph
- `db/console/src/schema/tables/workspace-temporal-states.ts:30-178` — Bi-temporal states
- `db/console/src/schema/tables/workspace-observation-clusters.ts:19-154` — Topic clusters
- `db/console/src/schema/tables/workspace-actor-profiles.ts:61-139` — Actor profiles
- `db/console/src/schema/tables/workspace-neural-entities.ts:26-169` — Extracted entities

### Tool Definitions
- `packages/console-ai/src/workspace-search.ts:43-63`
- `packages/console-ai/src/workspace-contents.ts:16-36`
- `packages/console-ai/src/workspace-find-similar.ts:30-50`
- `packages/console-ai/src/workspace-graph.ts:30-50`
- `packages/console-ai/src/workspace-related.ts:29-43`

### Agent Infrastructure
- `core/ai-sdk/src/core/primitives/agent.ts:315-323` — createAgent()
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:50-267` — Dual auth middleware
- `apps/console/src/lib/v1/index.ts:1-13` — V1 logic exports

### Inngest Workflows
- `api/console/src/inngest/workflow/neural/observation-capture.ts:336-1184` — Main capture pipeline
- `api/console/src/inngest/workflow/neural/relationship-detection.ts:45-493` — Relationship detection
- `api/console/src/inngest/workflow/neural/index.ts:1-14` — Workflow exports

### tRPC Routers
- `api/console/src/root.ts:1-109` — Router tree (userRouter, orgRouter, m2mRouter)
- `api/console/src/router/org/workspace.ts:1-1445` — Workspace router (getByName, sources.list, store.get, getActors, jobs.stats, health.overview)

## Integration Points

### How Components Connect

```
Answer API Route
  POST /v1/answer/{agentId}/{sessionId}

  1. withDualAuth() -> { workspaceId, userId, authType }
  2. buildAnswerSystemPrompt(HARDCODED) -> system prompt string
  3. createAgent({ system, tools, createRuntimeContext, model })
  4. fetchRequestHandler({ agent, memory, ... })

  Tools:
    workspaceSearch  -> searchLogic()         All take V1AuthContext
    workspaceContents -> contentsLogic()      + operation input.
    workspaceFindSimilar -> findsimilarLogic() Return typed responses.
    workspaceGraph -> graphLogic()
    workspaceRelated -> relatedLogic()

  Memory:
    AnswerRedisMemory (1h TTL)
    Redis JSON: sessions, messages, streams
```

```
Data Available for Prompt (from workspaceId):

  orgWorkspaces -> name, settings, clerkOrgId
  workspaceIntegrations -> repos, projects, sync config
  workspaceActorProfiles -> active contributors
  workspaceObservationClusters -> active topics + summaries
  workspaceTemporalStates -> current entity states
  workspaceNeuralEntities -> frequently referenced items
  workspaceNeuralObservations -> observation counts by type
```

```
Chat App Reference Architecture:

  buildPromptContext(routeData) -> PromptContext
  buildPrompt(context, STANDARD_PROVIDERS) -> system prompt string

  Providers: identity -> coreBehavior -> security -> capabilities
             -> citation -> style -> toolGuidance -> temporal -> user

  Each provider: (ctx) => PromptSection | null
  PromptSection: { id, priority, render(), estimateTokens() }
  Budget enforcement: critical always included, others trimmed
```

### Key Insight: The Bridge

The Answer API already has `workspaceId` from auth. The tRPC `workspace.*` procedures show exactly what data is fetchable. The Chat app's composable builder shows exactly how to structure the prompt. The gap is simply connecting these: **fetch workspace data at request time -> pass to section providers -> budget-aware prompt generation**.

The `createAgent()` function takes a plain `system: string`, so the composable builder output plugs in directly. No changes needed to the agent infrastructure.
