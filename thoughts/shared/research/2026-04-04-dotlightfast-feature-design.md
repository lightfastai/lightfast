---
date: 2026-04-04T18:00:00+08:00
researcher: claude
git_commit: fa1b286aa7e05f9dafbcd8081e720eecf4f1b7cd
branch: refactor/drop-workspace-abstraction
repository: lightfast
topic: ".lightfast repo — org-level context primitive for AI agents"
tags: [research, codebase, feature-design, dotlightfast, github-app, prompt-engine, agent-context]
status: complete
last_updated: 2026-04-04
last_updated_note: "Added follow-up: MCP integration design — sandbox shell model"
---

# Research: `.lightfast` Repo — Org-Level Context Primitive

**Date**: 2026-04-04T18:00:00+08:00
**Git Commit**: fa1b286aa
**Branch**: refactor/drop-workspace-abstraction

## Research Question

Design research for a new `.lightfast` feature — a dedicated GitHub repo (`{org}/.lightfast`) that serves as the org-level "system configuration" for Lightfast as an operating system. Contains org identity, rules, and behavioral context (starting with `brand.md`) that is loaded into AI agent context windows for both Lightfast's platform agents and user-facing AI tools (Claude Code, Cursor, etc.).

## Summary

The existing Lightfast infrastructure provides every building block needed for this feature:

1. **GitHub App** (`lightfastai-dev`) already has `get-file-contents` in its API catalog and can read files from user repos
2. **Webhook pipeline** can receive GitHub `push` events and process them through Inngest
3. **Prompt engine** (`packages/prompt-engine/`) has a pluggable section-based architecture for injecting context into agent system prompts
4. **No org-level config exists today** — `.lightfast` would be the first org-level configuration mechanism

The missing piece is the **glue**: linking an org to its `.lightfast` repo, caching the content, and injecting it into agent context.

## Feature Design (As Discussed)

| Aspect | Decision |
|---|---|
| **Form** | Dedicated GitHub repo: `{org}/.lightfast` |
| **Content** | Org identity + rules (markdown files), starting with `brand.md` |
| **Cardinality** | Strictly one per org |
| **Onboarding** | Lightfast scaffolds it via UI → GitHub App creates the repo |
| **Agents** | Both Lightfast platform agents AND user-facing AI tools (Claude Code, Cursor) |
| **Sync model** | Webhook-driven: GitHub App sends push events → Lightfast caches/indexes content |

## Detailed Findings

### 1. GitHub App Infrastructure

The Lightfast GitHub App (`lightfastai-dev`, App ID `2057209`) is fully operational with:

- **RS256 JWT auth** for App-level API calls (`packages/app-providers/src/providers/github/index.ts:31-37`)
- **Installation access tokens** exchanged per-installation via `POST /app/installations/{id}/access_tokens` (`index.ts:39-72`)
- **HMAC-SHA256 webhook verification** (`packages/app-providers/src/runtime/verify/hmac.ts`)

#### File Reading Capability

The `get-file-contents` endpoint is already declared in the GitHub API catalog:

```
File: packages/app-providers/src/providers/github/api.ts:154-169

"get-file-contents": {
  method: "GET",
  path: "/repos/{owner}/{repo}/contents/{path}",
  responseSchema: z.union([
    z.object({ type: z.string(), content: z.string(), sha: z.string(), size: z.number().optional() }).loose(),
    z.array(z.object({ type: z.string(), name: z.string() }).loose()),
  ]),
}
```

The `proxy.execute` tRPC mutation (`api/platform/src/router/memory/proxy.ts:89-243`) can call any declared endpoint. For GitHub, auth flows through `getActiveTokenForInstallation` which generates an App JWT and exchanges it for an installation access token.

To fetch `brand.md` from `acme-corp/.lightfast`:
```ts
proxy.execute({
  installationId: "<installation-id>",
  endpointId: "get-file-contents",
  pathParams: { owner: "acme-corp", repo: ".lightfast", path: "brand.md" },
})
// Returns: { status: 200, data: { type: "file", content: "<base64>", sha: "abc123" } }
```

Content is returned base64-encoded by GitHub's API.

#### Repo Creation via GitHub API

The GitHub API supports programmatic repo creation (`POST /orgs/{org}/repos`), but this endpoint is **not currently in the catalog**. It would need to be added for scaffolding. The GitHub App needs the `administration:write` permission to create repos in the org.

#### Repo Discovery

`list-installation-repos` (`GET /installation/repositories`) is already in the catalog (`api.ts:141-147`). This returns all repos the GitHub App can access for a given installation, which would include `.lightfast` if granted.

### 2. Organization Model

Orgs are managed entirely by Clerk — no `organizations` table exists in the app database. All org-scoped data uses `clerkOrgId varchar(191)` convention with no FK constraint.

Key tables:
- `orgIntegrations` (`db/app/src/schema/tables/org-integrations.ts`) — tracks provider resources (repos, projects) with `clerkOrgId + installationId + providerResourceId`
- `gatewayInstallations` (`db/app/src/schema/tables/gateway-installations.ts`) — GitHub App installations with `orgId`

There is **zero** org-level configuration/preferences today. The org name (from Clerk) is the only dynamic element injected into agent prompts.

### 3. Webhook Ingestion Pipeline

GitHub webhooks flow through a mature pipeline:

```
POST /api/ingest/github
  → HMAC verify → payload parse → gatewayWebhookDeliveries insert
  → Inngest: memory/webhook.received
    → ingestDelivery (resolve connection, transform, store)
      → memory/event.capture
        → memoryEventStore (scoring, entity extraction, upsert)
          → memoryEntityGraph (edge resolution)
            → memoryEntityEmbed (Cohere embedding → Pinecone)
```

Currently handles `pull_request` and `issues` events. To support `.lightfast` sync, a `push` event handler would need to be added — specifically filtering for pushes to the `.lightfast` repo and triggering a content re-fetch + cache update rather than the normal event pipeline.

### 4. Agent Context / Prompt Engine

The Answer agent uses `packages/prompt-engine/` which assembles system prompts from prioritized `SectionProvider` functions:

```
File: packages/prompt-engine/src/builder.ts:29

buildPrompt(context, providers) →
  run all SectionProvider functions →
  sort by priority (critical → high → medium → low) →
  respect token budget →
  join rendered sections
```

Eight sections currently exist:

| Section | Priority | File |
|---|---|---|
| `answerIdentitySection` | critical | `sections/identity.ts` |
| `answerCoreBehaviorSection` | critical | `sections/core-behavior.ts` |
| `answerSecuritySection` | critical | `sections/security.ts` |
| `answerToolGuidanceSection` | high | `sections/tool-guidance.ts` |
| `answerOrgContextSection` | high | `sections/org-context.ts` |
| `answerTemporalContextSection` | medium | `sections/temporal-context.ts` |
| `answerStyleSection` | medium | `sections/style.ts` |
| `answerCitationSection` | medium | `sections/citation.ts` |

The `answerOrgContextSection` (`sections/org-context.ts`) is currently **always null** because `repos` and `integrations` are passed as empty arrays. This section (or a new `.lightfast` section) is the natural injection point for `.lightfast` content.

**No per-org agent configuration exists.** The model (`claude-sonnet-4.6`), temperature, and all behavioral parameters are globally fixed.

### 5. Existing Patterns for External Context

The Answer agent's `createRuntimeContext` (`apps/app/src/app/(api)/v1/answer/[...v]/route.ts:80-89`) injects per-request context including `clerkOrgId`, `userId`, and `authToken`. The org name is fetched from Clerk at route request time.

The `PromptContext` type (`packages/prompt-engine/src/context.ts`) includes:
- `userContext.org.name` — the Clerk org name
- `activeTools` — list of available tools
- `features` — feature flags for which prompt sections to render

A `.lightfast` integration would extend `PromptContext` with the cached `.lightfast` content (e.g., `userContext.org.lightfast.brand`), and a new section provider would render it into the system prompt.

## Code References

- `packages/app-providers/src/providers/github/api.ts:154-169` — `get-file-contents` endpoint definition
- `api/platform/src/router/memory/proxy.ts:89-243` — Generic proxy executor (can call `get-file-contents`)
- `packages/app-providers/src/providers/github/index.ts:31-72` — GitHub App JWT + installation token exchange
- `packages/app-providers/src/providers/github/index.ts:123-150` — Webhook definition (headers, signature, payload extraction)
- `apps/platform/src/app/api/ingest/[provider]/route.ts:52-201` — Webhook ingestion route
- `api/platform/src/inngest/functions/ingest-delivery.ts:29-206` — Webhook → event pipeline
- `packages/prompt-engine/src/builder.ts:29` — Prompt builder (section assembly)
- `packages/prompt-engine/src/context.ts:16` — PromptContext factory
- `apps/app/src/ai/prompts/system-prompt.ts` — Answer agent system prompt construction
- `apps/app/src/ai/prompts/sections/org-context.ts` — Org context section (currently always null)
- `apps/app/src/app/(api)/v1/answer/[...v]/route.ts:76-92` — Agent instantiation with per-request context
- `core/ai-sdk/src/core/primitives/agent.ts:158-296` — Agent `buildStreamParams` (context merging)
- `db/app/src/schema/tables/org-integrations.ts:29-103` — `orgIntegrations` schema
- `db/app/src/schema/tables/gateway-installations.ts` — `gatewayInstallations` schema
- `api/platform/src/lib/token-helpers.ts:62-66` — GitHub token helper (no stored token, on-demand JWT)

## Architecture Documentation

### Current Integration Flow (for reference)

```
User clicks "Connect GitHub" in Lightfast UI
  → GET /api/connect/github/authorize (builds GitHub App install URL)
  → User installs GitHub App in their org (selects repos)
  → GitHub redirects to GET /api/connect/github/callback
  → Platform creates gatewayInstallations record
  → User selects repos → orgIntegrations rows created
  → Webhooks start flowing for selected repos
```

### How `.lightfast` Would Fit

```
User clicks "Create .lightfast" in Lightfast UI
  → Platform creates {org}/.lightfast repo via GitHub API (POST /orgs/{org}/repos)
  → Scaffolds initial brand.md with template content
  → Registers .lightfast repo for push webhook events
  → On push events to .lightfast repo:
    → Fetch brand.md via get-file-contents
    → Cache content (Redis or DB)
    → Invalidate prompt cache
  → When agents run:
    → Prompt engine loads cached .lightfast content
    → Injects as a section in system prompt (priority: high or critical)
  → For user-facing tools (Claude Code, Cursor):
    → Expose .lightfast content via REST API
    → Tools fetch and include in their own context windows
```

### Key Design Considerations

1. **GitHub App permissions**: The App needs `contents:read` (already has it) + `administration:write` (for repo creation) + the user must grant access to the `.lightfast` repo during App installation
2. **Content caching**: Redis (fast, TTL-based) vs DB column (durable, queryable) — webhook sync means the cache is updated on push, not polled
3. **Token budget**: `brand.md` content must fit within the prompt engine's token budget (default 4000 tokens for the entire system prompt). A dedicated budget allocation or priority system may be needed
4. **Content validation**: Should `.lightfast` content be validated (schema, max length) or accepted as free-form markdown?
5. **Exposure to external tools**: How do Claude Code / Cursor discover and fetch `.lightfast` content? Options: public API endpoint, MCP server, or the tools read directly from the GitHub repo

## Open Questions

1. **Repo creation permissions** — Does the GitHub App currently have `administration:write` scope? If not, adding it requires users to re-approve the App
2. **Push event handling** — The webhook system currently processes `pull_request` and `issues`. Adding `push` as a new event type needs a new transformer or a side-channel (skip the normal event pipeline, just re-cache content)
3. **Content size limits** — How large can `brand.md` be before it consumes too much of the agent's context window? Should there be a hard cap?
4. **Multi-file future** — Starting with `brand.md`, but the repo is designed to grow. How should multiple files be prioritized and budgeted within the prompt?
5. **External tool integration** — Claude Code reads `CLAUDE.md` from the local repo. How does `.lightfast` content reach tools that aren't running inside the `.lightfast` repo? MCP? API? Injected into `CLAUDE.md` generation?
6. **Offline / private repos** — If the `.lightfast` repo is private (expected), the GitHub App must maintain valid installation access. Health checks already exist for this pattern
7. **First-run experience** — What goes into the scaffolded `brand.md` template? How much guidance should Lightfast provide vs. leaving it blank?

## Follow-up Research: MCP Integration — Sandbox Shell Model

### Design Evolution

The initial design assumed fixed file endpoints (e.g., `GET /v1/config/brand`). Through discussion, the design evolved to a **general-purpose sandbox shell** model:

- `.lightfast` is not a flat file store — it's a **codebase** that agents explore
- Users can put any structure they want (markdown, yaml, directories, etc.)
- Agents discover content by exploring, not by calling fixed endpoints
- The MCP integration exposes a sandboxed shell tool against the cloned repo

### Existing MCP Infrastructure

Lightfast already has a published MCP server (`@lightfastai/mcp`, v0.1.0-alpha.5):

| Component | File | Purpose |
|---|---|---|
| MCP server | `core/mcp/src/index.ts` | Stdio server, auto-registers tools from API contract |
| MCP vendor abstraction | `vendor/mcp/src/index.ts` | `registerContractTools` — walks oRPC contract, creates MCP tools |
| Lightfast SDK | `core/lightfast/src/index.ts` | oRPC client (`createLightfast(apiKey)`) |
| API contract | `packages/app-api-contract/src/contract.ts` | `search`, `proxy.search`, `proxy.execute` |
| Config for Claude Code | `.mcp.json` | Local dev MCP config |
| Docs | `apps/www/src/content/docs/integrate/mcp.mdx` | Setup guides for Claude Desktop, Claude Code, Cursor, Codex |

The `registerContractTools` function (`vendor/mcp/src/index.ts:36-119`) walks the oRPC contract tree and auto-registers every procedure as an MCP tool. Adding a new procedure to `apiContract` automatically creates a new MCP tool — zero changes needed to `core/mcp/`.

### MCP Resources vs Tools Decision

Per the MCP spec (2025-03-26):
- **Resources** are application-controlled — the host decides when to read them
- **Tools** are model-controlled — the LLM decides when to call them

**Neither Claude Code nor Cursor auto-inject MCP resources into context.** Resources require host-side support that isn't consistently implemented. For this reason, `.lightfast` content should be exposed as **tools**, not resources.

Relevant spec links:
- Resources: https://modelcontextprotocol.io/specification/2025-03-26/server/resources
- Tools: https://modelcontextprotocol.io/specification/2025-03-26/server/tools
- Claude Code MCP docs: https://docs.anthropic.com/en/docs/claude-code/mcp
- Cursor MCP docs: https://docs.cursor.com/context/mcp

### Architecture: Sandbox Shell Model

```
User's AI tool (Claude Code, Cursor, Codex)
  → MCP tool: lightfast_shell({ command: "grep -r 'tone' ." })
  → Lightfast API (POST /v1/shell)
  → Vercel Sandbox (pre-cloned .lightfast repo for this org)
  → Execute read-only command in sandbox
  → Return stdout/stderr to agent

Push webhook (on .lightfast repo changes):
  → Lightfast webhook pipeline
  → Re-clone / git pull in sandbox environment
```

**Single MCP tool**: `lightfast_shell` — accepts a shell command string, executes it in a sandboxed environment containing the org's `.lightfast` repo clone. Read-only, isolated per org.

**Example agent interactions:**
```
# Discover what's in the repo
lightfast_shell({ command: "find . -name '*.md' -type f" })
→ ./brand.md
→ ./engineering/conventions.md
→ ./glossary.md

# Read a specific file
lightfast_shell({ command: "cat brand.md" })
→ (full file content)

# Search across all files
lightfast_shell({ command: "grep -rn 'tone' ." })
→ ./brand.md:12: Our tone is direct and technical...

# Explore directory structure
lightfast_shell({ command: "ls -la engineering/" })
→ conventions.md  api-standards.md  naming.md
```

### Why Shell Over Structured Tools

| Approach | Pros | Cons |
|---|---|---|
| Fixed file endpoints (`/v1/config/brand`) | Simple, predictable, cacheable | Rigid, doesn't scale with arbitrary files |
| File system primitives (ls, read, grep, glob) | Structured, type-safe inputs | 4 tools to maintain, limited composability |
| **Shell sandbox** | Maximum flexibility, one tool, agents already know shell commands | Needs sandboxing, command parsing, security |

The shell model works because LLMs already know how to use `grep`, `cat`, `find`, `ls`, `head`, `tail` — no new tool semantics to learn. And users can put any structure in `.lightfast` without Lightfast needing to know about it.

### Two Consumption Paths

1. **External tools (Claude Code, Cursor, Codex)** — `lightfast_shell` MCP tool → API → Vercel Sandbox → execute against cloned repo

2. **Lightfast's own agents (Answer)** — can use the same API endpoint, or the prompt engine can load key files from the clone into the system prompt as a section provider (for guaranteed context injection)

### Integration with Existing MCP Server

Adding `lightfast_shell` to the API contract:

```ts
// packages/app-api-contract/src/contract.ts
export const apiContract = {
  search: oc.route({ ... }),
  proxy: { ... },
  shell: oc
    .route({
      method: "POST",
      path: "/v1/shell",
      tags: ["Context"],
      summary: "Execute shell command against org context repo",
      description: "Run read-only shell commands against the org's .lightfast repository.",
    })
    .errors(apiErrors)
    .input(ShellRequestSchema)   // { command: string }
    .output(ShellResponseSchema), // { stdout: string, stderr: string, exitCode: number }
};
```

This automatically creates `lightfast_shell` as an MCP tool via `registerContractTools` — zero changes to `core/mcp/`.

### Open Questions (Updated)

1. **Vercel Sandbox specifics** — What Vercel sandbox product/API is being used? Code Interpreter? Serverless function with temp clone? This determines the execution model and limits
2. **Clone lifecycle** — How long does a clone persist? Is it per-request (cold start penalty) or long-lived (needs sync)?
3. **Security boundary** — What commands are allowed? Need to prevent arbitrary code execution, network access, writes. Allowlist (`cat`, `grep`, `find`, `ls`, `head`, `tail`, `wc`) vs blocklist?
4. **Output limits** — Shell output can be arbitrarily large. Need `maxOutputSize` or truncation to avoid blowing up agent context windows
5. **Auth scoping** — The API key (`sk-lf-...`) is org-scoped. The sandbox must only expose the `.lightfast` repo for the authenticated org
6. **Prompt engine integration** — Should Lightfast's Answer agent also use `lightfast_shell`, or should it load key files directly into the system prompt for guaranteed context?
7. **Repo template** — What does the scaffolded `.lightfast` repo contain? A README explaining the concept + a `brand.md` starter?
