---
date: 2026-02-07
researcher: codebase-agent
topic: "Architecture evaluation pipeline for Lightfast"
tags: [research, codebase, architecture, evaluation, pipeline]
status: complete
---

# Codebase Deep Dive: Architecture Evaluation Pipeline

## Research Question
End-to-end pipeline for evaluating Lightfast architecture with iterative improvement — how the codebase is structured, how pipelines work, how quality is gated, how schemas evolve, and how research flows into implementation.

## Summary

Lightfast is a mature pnpm monorepo (Turborepo) with ~80+ packages organized into 7 workspace groups (`apps/`, `api/`, `core/`, `db/`, `packages/`, `vendor/`, `internal/`). The architecture follows a strict layered dependency model: `apps` → `api` → `packages` → `vendor` → `db`, with vendor packages acting as third-party abstraction boundaries. The primary data pipeline flows from GitHub webhooks → tRPC routes → Inngest workflows → Drizzle ORM → PlanetScale/Pinecone, with 25+ typed Inngest events and 23+ workflow functions. Quality gates include Turborepo-cached lint/typecheck/build but CI only covers `core/lightfast` and `core/mcp` packages. Schema evolution uses Drizzle Kit with 27 generated migrations. The research-to-implementation flow is formalized through `thoughts/shared/research/` → `thoughts/shared/plans/` with Claude Code skills (`/create_plan`, `/implement_plan`, `/validate_plan`) providing structured workflows. Versioning uses Changesets for the public SDK (`core/lightfast`, `core/mcp`) with automated npm publishing via GitHub Actions.

The codebase has strong conventions for package creation, dependency management, and auth boundaries, but lacks formal architecture decision records (ADRs), automated testing for the console application, and an explicit architecture evaluation framework.

## Detailed Findings

### 1. Monorepo Structure & Conventions

#### Workspace Groups (7 total)

Defined in `pnpm-workspace.yaml:1-8`:
```
packages:
  - api/*        # Backend APIs (tRPC routers, Inngest workflows)
  - apps/*       # Frontend applications (Next.js)
  - core/*       # Public SDK packages (npm-published)
  - db/*         # Database schemas and migrations
  - packages/*   # Internal shared packages
  - internal/*   # Internal tooling
  - vendor/*     # Third-party abstraction layers
  - examples/*   # Example projects
```

#### Applications (`apps/`)
| Package | Name | Port | Purpose |
|---------|------|------|---------|
| `apps/console` | `@lightfast/console` | 4107 | Main console app (catch-all routes) |
| `apps/www` | `@lightfast/www` | 4101 | Marketing site |
| `apps/auth` | `@lightfast/auth` | 4104 | Auth flows (Clerk) |
| `apps/docs` | `@lightfast/docs` | - | Documentation |
| `apps/chat` | `@lightfast/chat` | 4106 | Independent chat app |

All except `apps/chat` are served via **Vercel Microfrontends** through `apps/console/microfrontends.json:1-64` on `lightfast.ai`.

#### APIs (`api/`)
| Package | Name | Purpose |
|---------|------|---------|
| `api/console` | `@api/console` | Console tRPC API + Inngest workflows |
| `api/chat` | `@api/chat` | Chat API |

#### Core (Public SDK) (`core/`)
| Package | Name | Version | Published |
|---------|------|---------|-----------|
| `core/lightfast` | `lightfast` | 0.1.0-alpha.1 | npm (public) |
| `core/mcp` | `@lightfastai/mcp` | - | npm (public) |
| `core/ai-sdk` | `@lightfastai/ai-sdk` | - | Internal |
| `core/cli` | `@lightfastai/cli` | - | Internal |

#### Database (`db/`)
| Package | Name | Purpose |
|---------|------|---------|
| `db/console` | `@db/console` | Console DB schema + migrations (Drizzle + Postgres) |

#### Vendor Abstractions (`vendor/`) — 17 packages
Each wraps a third-party SDK with consistent patterns:
`@vendor/analytics`, `@vendor/clerk`, `@vendor/cms`, `@vendor/db`, `@vendor/email`, `@vendor/embed`, `@vendor/inngest`, `@vendor/knock`, `@vendor/mastra`, `@vendor/next`, `@vendor/observability`, `@vendor/pinecone`, `@vendor/security`, `@vendor/seo`, `@vendor/storage`, `@vendor/upstash`, `@vendor/upstash-workflow`

**Convention**: Never import third-party SDKs directly. Always go through `@vendor/*`.

#### Internal Packages (`packages/`) — 37 packages
Organized into functional groups:
- **Console domain**: `@repo/console-*` (14 packages: auth-middleware, billing, chunking, clerk-cache, config, embed, oauth, octokit-github, pinecone, rerank, reserved-names, types, validation, vercel, webhooks, workspace-cache, api-key, clerk-m2m, api-services, test-data)
- **Chat domain**: `@repo/chat-*` (chat-ai, chat-ai-types, chat-billing, chat-api-services, chat-trpc)
- **Console AI**: `@repo/console-ai`, `@repo/console-ai-types`
- **Shared**: `@repo/lib`, `@repo/ui`, `@repo/ai`, `@repo/ai-tools`, `@repo/app-urls`, `@repo/url-utils`, `@repo/site-config`, `@repo/email`, `@repo/cms-workflows`
- **tRPC**: `@repo/console-trpc`, `@repo/chat-trpc`

#### Dependency Patterns

**workspace:*** — All internal package references use `workspace:*` protocol:
```json
// db/console/package.json:37-38
"@repo/console-types": "workspace:*",
"@repo/console-validation": "workspace:*",
```

**catalog:** — Shared external versions in `pnpm-workspace.yaml:10-61`:
```yaml
catalog:
  '@trpc/client': ^11.4.0
  next: ^15.5.7
  drizzle-orm: ^0.43.1
  inngest: ^3.35.1
  # ... 50+ shared versions
```

**Named catalogs** for version variants (`pnpm-workspace.yaml:62-76`):
```yaml
catalogs:
  tailwind4:
    tailwindcss: 4.1.11
  zod3:
    zod: ^3.25.76
  zod4:
    zod: ^4.0.0
  next15:
    next: ^15.5.7
  next16:
    next: ^16.1.6
```

#### Package.json Conventions

Standard package exports pattern (`db/console/package.json:6-17`):
```json
"exports": {
  ".": { "types": "./dist/src/index.d.ts", "default": "./src/index.ts" },
  "./schema": "./src/schema/index.ts",
  "./client": "./src/client.ts"
}
```

Standard scripts: `build`, `clean`, `dev`, `format`, `lint`, `typecheck`

#### TypeScript Configuration

Packages extend shared configs from `@repo/typescript-config`:
- `internal-package.json` for internal packages
- App-specific configs for Next.js apps

---

### 2. Pipeline Patterns (Inngest, tRPC, Data Flows)

#### tRPC Architecture

**Three-router split** (`api/console/src/root.ts:1-112`):

| Router | Scope | Auth Required | Use Case |
|--------|-------|---------------|----------|
| `userRouter` | User-scoped | Clerk (pending OK) | Account, API keys, sources, onboarding |
| `orgRouter` | Org-scoped | Clerk (active org) | Workspaces, search, integrations, jobs |
| `m2mRouter` | Machine | M2M token | Inngest workflows, webhook handlers |

**Auth context is a discriminated union** (`api/console/src/trpc.ts:32-58`):
```typescript
type AuthContext =
  | { type: "clerk-pending"; userId: string }
  | { type: "clerk-active"; userId: string; orgId: string }
  | { type: "m2m"; machineId: string }
  | { type: "apiKey"; workspaceId: string; userId: string; apiKeyId: string }
  | { type: "unauthenticated" }
```

**Six procedure types** (`api/console/src/trpc.ts:259-577`):
1. `publicProcedure` — No auth required
2. `userScopedProcedure` — Clerk pending or active
3. `orgScopedProcedure` — Clerk active only (has org)
4. `m2mProcedure` — Any M2M token
5. `webhookM2MProcedure` — Webhook M2M token
6. `inngestM2MProcedure` — Inngest M2M token
7. `apiKeyProcedure` — API key in Authorization header

**Context creation** — Two separate context creators:
- `createUserTRPCContext` (`trpc.ts:84-155`) — allows pending users
- `createOrgTRPCContext` (`trpc.ts:173-230`) — blocks pending users

Both check M2M Bearer tokens first (highest priority), then fall back to Clerk session.

**Helper patterns** for common operations:
- `verifyOrgAccessAndResolve` (`trpc.ts:595-615`) — slug → orgId with access check
- `resolveWorkspaceByName` (`trpc.ts:631-661`) — user-facing workspace resolution
- `resolveWorkspaceBySlug` (`trpc.ts:682-710`) — internal workspace resolution (Pinecone)
- `verifyOrgMembership` (`trpc.ts:729-774`) — user-centric org membership check (cached)

**Error handling** — Standardized with `handleProcedureError` and `withErrorHandling` wrapper (`trpc.ts:883-946`).

#### Inngest Workflow Architecture

**Client definition** (`api/console/src/inngest/client/client.ts:1-770`):
- 25+ Zod-typed event schemas organized into categories:
  - Unified Orchestration (sync.requested, sync.completed)
  - Batch Processing (files.batch.process, files.batch.completed)
  - Source-Specific (github.sync.trigger, github.sync.completed)
  - Source Management (source.connected.github, source.disconnected)
  - GitHub Events (github.push, github.config-changed)
  - Infrastructure (store.ensure)
  - Activity Tracking (activity.record)
  - Document Processing (docs.file.process, documents.process, documents.delete)
  - Neural Memory (observation.capture, observation.captured, profile.update, cluster.check-summary, llm-entity-extraction)
  - Notifications (notification.dispatch)
- Sentry middleware integration

**Workflow organization** (`api/console/src/inngest/workflow/`):
```
workflow/
├── infrastructure/    # record-activity.ts
├── neural/           # 13 files: observation-capture, entity-extraction, classification, scoring, clustering, relationship-detection, profile-update, etc.
├── notifications/    # dispatch.ts, index.ts
├── orchestration/    # sync-orchestrator.ts
├── processing/       # delete-documents.ts, files-batch-processor.ts, process-documents.ts
├── providers/github/ # push-handler.ts
└── sources/          # github-sync-orchestrator.ts
```

**Sync Orchestrator Pattern** (`workflow/orchestration/sync-orchestrator.ts:41-284`):
1. Trigger: `apps-console/sync.requested` event
2. Step 1: Fetch workspace + source metadata from DB
3. Step 2: Create tracking job
4. Step 3: Verify workspace embedding config
5. Step 4: Update job status to running
6. Step 5: Route to source-specific orchestrator (sends `github.sync.trigger` event)
7. Step 6: `step.waitForEvent` for source completion (25m timeout)
8. Step 7: Update job with final metrics
9. Step 8: Update source sync status in DB
10. Step 9: Emit `sync.completed` event

Key patterns:
- Concurrency: `limit: 1` per `event.data.sourceId`
- Cancel on: `source.disconnected` matching `data.sourceId`
- Timeouts: 2m start, 30m finish
- `onFailure` handler for error logging

**Data Flow: GitHub Push → Indexed Content**:
```
GitHub Push Webhook
  → api/console/src/app/api/github/webhooks/route.ts
  → Inngest event: apps-console/github.push
  → push-handler workflow
  → sync-orchestrator (apps-console/sync.requested)
  → github-sync-orchestrator (apps-console/github.sync.trigger)
  → files-batch-processor (apps-console/files.batch.process)
  → process-documents (apps-console/documents.process)
  → observation-capture (apps-console/neural/observation.capture)
  → Pinecone upsert + DB writes
```

---

### 3. Quality Gates & Build Infrastructure

#### Turborepo Configuration (`turbo.json:1-174`)

**Tasks defined**:
| Task | Dependencies | Cached | Outputs |
|------|-------------|--------|---------|
| `build` | `^build` | Yes | `.cache/tsbuildinfo.json`, `dist/**` |
| `dev` | None | No | Persistent |
| `dev:inngest` | None | No | Persistent |
| `dev:qstash` | None | No | Persistent |
| `dev:ngrok` | None | No | Persistent |
| `format` | None | Yes | `.cache/.prettiercache` |
| `lint` | `^build` | Yes | `.cache/.eslintcache` |
| `typecheck` | `^build` | Yes | `.cache/tsbuildinfo.json` |
| `migrate` | None | No | - |
| `eval` | None | No | Interactive |

**Global env vars**: 60+ environment variables defined in `turbo.json:67-161`.

#### Turbo Boundaries (Available & Working)

**Turborepo version**: `^2.5.5` in catalog (`pnpm-workspace.yaml:25`), actual installed: `2.5.8`. The `turbo boundaries` command was introduced experimentally in **v2.4.2** (April 2025), so it **is available** in this codebase.

**Current state**: Running `turbo boundaries` works and checks 1753 files across 71 packages. It currently finds **16 issues** in default mode:
- Type declaration imports not marked as `type`-only (e.g., `react` imports in `core/ai-sdk/`)
- Missing dependency declarations (e.g., `server-only`, `@eslint/eslintrc`)
- Imports that leave package boundaries (e.g., `@vendor/cms/components/body`)

**Tags & Rules support**: Since v2.4.2, `turbo boundaries` supports custom **tags** and **rules** for architectural boundary enforcement. Tags are declared in per-package `turbo.json` files:
```json
// packages/my-pkg/turbo.json
{ "tags": ["internal", "domain:console"] }
```

Rules are defined in root `turbo.json` under a `boundaries.tags` key, allowing constraints like:
- "Only packages tagged `ui` can import packages tagged `design-system`"
- "Packages tagged `vendor` cannot import packages tagged `app`"

**Current configuration**: **No tags or rules are configured** — neither root `turbo.json` nor any per-package `turbo.json` files contain `tags` or `boundaries` configuration. The command runs with default checks only (undeclared dependencies, out-of-package imports, type-only import enforcement).

**No dependency-cruiser**: No `.dependency-cruiser.js` or `.dependency-cruiser.json` configurations exist in the codebase. The only references to dependency-cruiser are in the architecture design research docs (proposed, not implemented).

**Key finding for architecture evaluation pipeline**: `turbo boundaries` with tags/rules is a viable data collector for enforcing architectural boundaries — it's already installed, functional, and ready for tag configuration. No need for dependency-cruiser as an alternative.

#### Root Scripts (`package.json:10-43`)

| Command | What it does |
|---------|-------------|
| `pnpm build:console` | `turbo run build -F @lightfast/console` |
| `pnpm lint` | `turbo run lint --continue -- --cache` |
| `pnpm typecheck` | `turbo run typecheck` |
| `pnpm format:fix` | `turbo run format --continue -- --write` |
| `pnpm lint:ws` | `pnpm dlx sherif@latest` (workspace linting) |
| `pnpm postinstall` | `pnpm lint:ws && node scripts/postinstall.js` |

#### CI/CD Pipelines (`.github/workflows/`)

**ci.yml** — Only runs on `core/lightfast` and `core/mcp` changes:
- Change detection via `dorny/paths-filter@v3`
- Jobs: lint → typecheck → test → build (parallel after change detection)
- All jobs are non-blocking (use `echo "⚠️ ... but not blocking CI"`)
- Summary job: `ci-success` with all-jobs check

**release.yml** — Changesets-based npm publishing:
- Triggers on `.changeset/**` pushes to main
- Build → Test → `changesets/action@v1` publish
- Uses `lightfast-release-bot` GitHub user
- Publishes to npm with provenance

**verify-changeset.yml** — PR changeset verification

**db-migrate.yml** — Database migration workflow

**Key gap**: No CI pipeline for the console app, API, or packages beyond `core/`. Lint/typecheck/build quality gates exist locally but aren't enforced in CI for the console application.

#### Deployment

Console, www, auth, docs deploy via **Vercel** with microfrontends. No explicit Vercel GitHub integration config files found — likely configured through Vercel dashboard.

---

### 4. Schema Evolution

#### Drizzle Schema Organization

**27 migrations** in `db/console/src/migrations/` (SQL files generated by `drizzle-kit generate`).

**Schema structure** (`db/console/src/schema/`):
```
schema/
├── index.ts          # Re-exports tables + relations
├── relations.ts      # Drizzle relation definitions
├── lib/
│   ├── id-helpers.ts # ID generation utilities
│   └── index.ts
└── tables/
    ├── index.ts      # 15 table exports organized by scope
    ├── user-api-keys.ts
    ├── user-sources.ts
    ├── org-workspaces.ts
    ├── org-api-keys.ts
    ├── org-actor-identities.ts
    ├── workspace-integrations.ts
    ├── workspace-knowledge-documents.ts
    ├── workspace-knowledge-vector-chunks.ts
    ├── workspace-workflow-runs.ts
    ├── workspace-operations-metrics.ts
    ├── workspace-user-activities.ts
    ├── workspace-neural-observations.ts
    ├── workspace-observation-clusters.ts
    ├── workspace-neural-entities.ts
    ├── workspace-actor-profiles.ts
    ├── workspace-temporal-states.ts
    ├── workspace-webhook-payloads.ts
    └── workspace-observation-relationships.ts
```

**Table naming convention**: `lightfast_<scope>_<entity>` (e.g., `lightfast_org_workspaces`)

**Table organization** by scope (`db/console/src/schema/tables/index.ts:1-34`):
1. User-scoped: `user-api-keys`, `user-sources`
2. Org-scoped: `org-workspaces`, `org-api-keys`, `org-actor-identities`
3. Workspace-scoped: knowledge documents, vector chunks, integrations, workflow runs, operations metrics, user activities
4. Neural memory: observations, clusters, entities, actor profiles, temporal states
5. Webhook storage: webhook payloads
6. Relationship graph: observation relationships

**Schema patterns** (example from `org-workspaces.ts:35-121`):
- IDs: `varchar("id", { length: 191 })` with `nanoid()` default
- Timestamps: `timestamp("created_at", { mode: "string", withTimezone: true })` with `CURRENT_TIMESTAMP` default
- Foreign keys: Clerk IDs stored as varchar (no FK — Clerk is source of truth)
- Type safety: `.$type<ClerkOrgId>()` for branded types
- JSONB: `.$type<WorkspaceSettings>()` for typed JSON columns
- Indexes: Named with pattern `<entity>_<field>_idx`
- Unique constraints: Named with pattern `<entity>_<fields>_idx`
- Type exports: `type OrgWorkspace = typeof orgWorkspaces.$inferSelect`

**Migration workflow**:
1. Modify schema TypeScript files
2. Run `pnpm db:generate` (generates `.sql` file + snapshot JSON)
3. Run `pnpm db:migrate` (applies to database)
4. **NEVER write custom SQL migration files** (`db/CLAUDE.md`)

**Drizzle config**: `db/console/src/drizzle.config.ts`
**Env loading**: Uses `dotenv-cli` with `with-env` script pointing to `apps/console/.vercel/.env.development.local`

---

### 5. Research-to-Implementation Flow

#### Directory Structure

```
thoughts/
└── shared/
    ├── research/    # ~40+ research documents (YYYY-MM-DD-topic.md)
    └── plans/       # ~30+ implementation plans (YYYY-MM-DD-topic.md)
```

#### Research Document Format

Frontmatter pattern (from `thoughts/shared/research/2026-02-06-knock-setup-slack-bot-resend-integration.md:1-10`):
```yaml
---
date: 2026-02-06T05:00:00Z
researcher: claude
topic: "Knock Setup with Slack Bot Integration and Resend Email"
tags: [research, web-analysis, knock, slack, resend, notifications]
status: complete
created_at: 2026-02-06
confidence: high
sources_count: 25
---
```

Content structure:
1. Executive Summary
2. Architecture Overview (with ASCII diagrams)
3. Detailed sections with code examples
4. Integration patterns
5. Pricing analysis
6. Step-by-step implementation guidance

#### Plan Document Format

Plans follow a strict template (defined in `.claude/commands/create_plan.md:182-277`):
```markdown
# [Feature Name] Implementation Plan

## Overview
## Current State Analysis
## Desired End State
## What We're NOT Doing
## Implementation Approach
## Phase N: [Descriptive Name]
  ### Overview
  ### Changes Required (with file:line references + code)
  ### Success Criteria
    #### Automated Verification
    #### Manual Verification
## Testing Strategy
## Performance Considerations
## Migration Notes
## References
```

Key requirements:
- Plans must have NO open questions — all decisions made before finalizing
- Each phase has both automated and manual verification steps
- Phase completion requires manual confirmation before proceeding

#### Claude Code Skills & Commands

**Commands** (`.claude/commands/`) — 16 commands:
| Command | Purpose |
|---------|---------|
| `/create_plan` | Interactive plan creation with codebase research |
| `/implement_plan` | Execute plans from `thoughts/shared/plans/` |
| `/validate_plan` | Validate implementation against plan |
| `/research-codebase` | Document codebase patterns |
| `/research-codebase-external` | External codebase analysis |
| `/research-web` | Web research on technical topics |
| `/research-team` | Coordinated multi-agent research |
| `/create_blog` | Blog post creation |
| `/validate_blog` | Blog validation |
| `/publish_blog` | Publish to BaseHub CMS |
| `/create_changelog` | Changelog generation |
| `/validate_changelog` | Changelog validation |
| `/publish_changelog` | Publish changelog |
| `/commit` | Git commits |
| `/debug` | Debug integrations |
| `/manage-connector` | Connector management |

**Skills** (`.claude/skills/`) — 3 skill packages:
1. `blog-writer/` — Category-aware blog creation with AEO requirements
2. `changelog-writer/` — SEO-optimized changelog entries
3. `seo/` — SEO optimization with meta templates and schema patterns

**Frontend design skill** (`.claude/skills/frontend-design/`)
**Vercel React best practices** (`.claude/skills/vercel-react-best-practices/`)

#### Research → Plan → Implementation Workflow

1. **Research**: `/research-codebase` or `/research-web` → writes to `thoughts/shared/research/`
2. **Plan**: `/create_plan` → reads research + codebase → writes to `thoughts/shared/plans/`
3. **Implement**: `/implement_plan` → reads plan → executes phases with verification
4. **Validate**: `/validate_plan` → checks implementation against plan criteria

The `/create_plan` command (`create_plan.md:1-449`) is particularly sophisticated:
- Spawns parallel research sub-agents (codebase-locator, codebase-analyzer, thoughts-locator)
- Interactive process with user feedback at each stage
- Verification of findings against actual code
- Structured output with file:line references

---

### 6. Architecture Decision Tracking

**No formal ADR system exists.**

Architecture decisions are tracked through:
1. **SPEC.md** — High-level vision and mission
2. **CLAUDE.md files** — Per-directory and per-app conventions
3. **Code comments** — Detailed JSDoc in critical files (e.g., `trpc.ts` has extensive per-procedure documentation)
4. **thoughts/ documents** — Research and plans serve as implicit decision records
5. **Git history** — PR titles and commit messages

**CLAUDE.md hierarchy**:
- Root `CLAUDE.md` — Repo-wide conventions
- `apps/console/CLAUDE.md` — Console-specific mission, architecture, business model
- `db/CLAUDE.md` — Database management rules

**Gap**: No structured decision log linking "why" to "what was decided" across the codebase evolution.

---

### 7. Testing Infrastructure

#### What Exists

**Core SDK** (`core/lightfast/`):
- Framework: Vitest (`core/lightfast/vitest.config.ts:1-12`)
- Test files: `client.test.ts`, `errors.test.ts`
- CI-enforced: Yes (in `ci.yml:99-119`)
- Coverage: `@vitest/coverage-v8` available

**Chat API** (`api/chat/`):
- Test file: `message-pagination.test.ts`

**Chat billing** (`apps/chat/`):
- Test file: `billing.test.ts`

#### What's Missing

**No tests for the entire console ecosystem:**
- `api/console/` — No tRPC router tests, no Inngest workflow tests
- `apps/console/` — No component tests, no E2E tests
- `packages/` — No unit tests for any of the 37 packages
- `vendor/` — No integration tests for vendor abstractions
- `db/console/` — No schema validation tests

**No E2E testing framework** (no Playwright or Cypress config for apps).

**No test scripts** in most packages — only `core/lightfast` has a `test` script.

**Evaluation infrastructure**: The `brain` script (`package.json:30`) runs `turbo run eval`, and Braintrust is in the catalog (`pnpm-workspace.yaml:36`), suggesting AI evaluation exists but is interactive/manual.

---

### 8. Versioning & Release Patterns

#### Changesets

**Configuration** (`.changeset/config.json:1-11`):
```json
{
  "fixed": [["lightfast", "@lightfastai/mcp"]],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

- **Fixed versioning**: `lightfast` and `@lightfastai/mcp` always release together
- **Public access**: Published to npm
- **Automated releases** via `.github/workflows/release.yml`

**Current version**: `lightfast@0.1.0-alpha.1` (`core/lightfast/package.json:3`)

#### Internal Packages

- All marked `"private": true`
- No independent versioning
- Depend on each other via `workspace:*`

#### App Deployment

- Vercel auto-deploys on push to main
- No explicit versioning for apps
- `turbo-ignore` (`package.json:53`) used for selective Vercel builds

---

## Code References

### Core Architecture Files
- `pnpm-workspace.yaml:1-105` — Workspace definition, catalog, named catalogs
- `turbo.json:1-174` — Task definitions, global env vars
- `package.json:1-67` — Root scripts, dev dependencies
- `api/console/src/root.ts:1-112` — Router composition (user/org/m2m split)
- `api/console/src/trpc.ts:1-950` — tRPC initialization, auth context, procedures, helpers

### Pipeline Files
- `api/console/src/inngest/client/client.ts:1-770` — 25+ typed event schemas
- `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts:41-284` — Sync workflow pattern
- `api/console/src/inngest/workflow/neural/` — 13 neural memory workflow files

### Database Files
- `db/console/src/schema/tables/index.ts:1-34` — Table organization
- `db/console/src/schema/tables/org-workspaces.ts:1-126` — Example schema pattern
- `db/console/package.json:27-33` — Migration scripts
- `db/CLAUDE.md` — Migration rules

### Quality & CI
- `.github/workflows/ci.yml:1-174` — CI pipeline (core packages only)
- `.github/workflows/release.yml:1-69` — Changesets release
- `.changeset/config.json:1-11` — Versioning config

### Research & Plans
- `.claude/commands/create_plan.md:1-449` — Plan creation workflow
- `thoughts/shared/plans/2026-02-06-knock-notification-integration-phase-1.md` — Example plan
- `thoughts/shared/research/2026-02-06-knock-setup-slack-bot-resend-integration.md` — Example research

### Microfrontends
- `apps/console/microfrontends.json:1-64` — Route configuration for lightfast.ai

---

## Integration Points

### How Components Connect

```
[GitHub Webhooks] → [Next.js API Route] → [Inngest Event]
                                              ↓
[apps/console UI] → [tRPC Client] → [tRPC Router] → [Drizzle ORM] → [PlanetScale]
     ↑                                    ↓                              ↓
[Clerk Auth]                    [Inngest Workflows] → [Pinecone]    [Migrations]
     ↑                              ↓        ↓
[Vercel Deploy]              [Knock API]  [GitHub API]
```

**Key integration boundaries**:
1. **Auth**: Clerk → `@vendor/clerk` → tRPC context → procedure middleware
2. **Database**: Schema → `@db/console` → `@vendor/db` → PlanetScale
3. **Background jobs**: tRPC → Inngest events → Workflows → tRPC (M2M) → Database
4. **Search**: tRPC → `@repo/console-pinecone` → Pinecone → `@repo/console-rerank` → Cohere
5. **Notifications**: Inngest → `@vendor/knock` → In-app feed
6. **Observability**: `@vendor/observability` → BetterStack/Sentry

---

## Gaps Identified

### What doesn't exist yet that an architecture evaluation pipeline would need:

1. **No formal ADR system** — Architecture decisions are scattered across CLAUDE.md files, code comments, and thoughts/ documents. No structured way to track decisions, their rationale, and their status.

2. **No automated testing for console** — The primary application (console + API) has zero test coverage. Only `core/lightfast` SDK has tests. This means architecture changes can't be validated automatically.

3. **No CI for console app** — CI only runs on `core/lightfast` and `core/mcp`. The console app, API, and 37+ packages have no automated quality checks on PRs.

4. **No architecture metrics** — No tooling to measure coupling, complexity, dependency depth, bundle size, or other architecture health metrics.

5. **No schema versioning strategy** — Beyond Drizzle's sequential migrations, there's no way to track schema evolution decisions or their impact on the application.

6. **No evaluation framework** — While Braintrust is in the catalog and `pnpm brain` runs `turbo run eval`, there's no systematic architecture evaluation framework. The `eval` task in turbo.json is configured as interactive/non-cached.

7. **No dependency graph visualization** — No tooling to visualize the package dependency graph. However, `turbo boundaries` (v2.5.8, already installed) supports tags and rules for architectural boundary enforcement and is ready for configuration — no additional tooling needed.

8. **No performance baselines** — No Lighthouse scores, Core Web Vitals tracking, or API response time baselines to evaluate architecture impact.

9. **No formal code review checklist** — Quality depends on `pnpm lint && pnpm typecheck && pnpm build:console` but there's no checklist for architectural concerns.

10. **Research docs lack machine-readable structure** — While frontmatter exists, there's no schema validation for research/plan documents, making it hard to programmatically trace the research → plan → implementation pipeline.
