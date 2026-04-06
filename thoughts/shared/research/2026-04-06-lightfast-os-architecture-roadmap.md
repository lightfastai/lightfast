---
date: 2026-04-06T20:00:00+08:00
researcher: claude
git_commit: ebd062cfab3fe35705cf5e276491688752040af8
branch: main
topic: "Lightfast OS architecture — near-term roadmap with honest assessment of what ships and what's speculative"
tags: [research, vision, architecture, entity-first, skills, dotlightfast, agent-loop, roadmap, mcp, github-comments, slack, bots]
status: complete
last_updated: 2026-04-06
supersedes:
  - "2026-04-06-events-entities-os-paradigm-gap.md (deleted)"
  - "2026-04-06-contrarian-os-architecture-vision.md (deleted)"
---

# Lightfast OS Architecture: From Vision to Roadmap

**Date**: 2026-04-06T20:00:00+08:00
**Git Commit**: ebd062cfab3fe35705cf5e276491688752040af8
**Branch**: main

## The Thesis

Lightfast is an autonomous runtime, not an observability dashboard. The `.lightfast` repo is the program. Skills are the instruction set. The entity graph is state. The Inngest pipeline is the proto-kernel. Events are interrupts.

The current architecture is **pull** (human queries, system answers). The target is **push** (system operates, human steers).

```
Current:  Webhooks → Pipeline → Entities → Vectors → Search → AI Chat → Human reads
Target:   Webhooks → Pipeline → Entities → Skill Evaluator → Action Queue → Human approves
                                                ↑                    ↓
                                           .lightfast             Actions
                                           (identity)          (Linear, Slack,
                                                                GitHub, etc.)
```

## What Exists Today (verified against codebase)

### Production-ready

| Component | Where | What It Does |
|---|---|---|
| Webhook ingestion | `apps/platform/src/app/api/ingest/[provider]/route.ts` | 5 providers (GitHub, Linear, Vercel, Sentry, Apollo) |
| Neural pipeline | `api/platform/src/inngest/functions/` | 5-stage: ingest → event store → entity upsert → graph → embed |
| Entity schema | `db/app/src/schema/tables/org-entities.ts` | 12 categories, dedup by `(org, category, key)`, occurrence tracking |
| Entity graph | `db/app/src/schema/tables/org-entity-edges.ts` | Directed edges with relationship type, confidence, provenance |
| Event-entity links | `db/app/src/schema/tables/org-event-entities.ts` | Many-to-many junction with refLabel |
| Enriched events | `db/app/src/schema/tables/org-events.ts` | `significanceScore`, `observationType`, `sourceReferences` |
| Vector search | Pinecone + Cohere `embed-english-v3.0` | Narrative-based entity embeddings with metadata |
| Significance scoring | `api/platform/src/lib/scoring.ts` | 4-stage additive: base weight + content signals + ref density + substance |
| Answer agent | `apps/app/src/app/(api)/v1/answer/` | claude-sonnet-4.6, single tool: `orgSearch` |
| Prompt engine | `packages/prompt-engine/` | 8 section providers, composable, priority-based trimming |
| Realtime | `packages/app-upstash-realtime/` | SSE push on webhook ingest (pre-pipeline) |

### Built but unused

| Component | Where | Gap |
|---|---|---|
| `answerOrgContextSection` | `apps/app/src/ai/prompts/sections/org-context.ts` | Always returns `null` — `buildAnswerSystemPrompt` passes `repos: []`, `integrations: []` |
| `aliases` column on `orgEntities` | `db/app/src/schema/tables/org-entities.ts` | Schema exists, never written by any pipeline code |
| `llmExtractedEntitySchema` | `packages/app-validation/src/schemas/entities.ts:47-68` | Defined, exported, not consumed by any Inngest function |
| `engineer` + `service` categories | `packages/app-validation/src/schemas/entities.ts:9-24` | Declared as valid categories but zero extraction paths (no regex, no structured extraction) |

### Honest assessment of the graph

The entity graph is **structurally sparse**:

- **Edge resolution gates on 5 categories** (`edge-resolver.ts:33-38`): `commit`, `branch`, `pr`, `issue`, `deployment`. Events producing only semantic entities generate zero edges.
- **4 total edge rules across all providers**: GitHub has 3 (commit→deployment "deploys", issue→issue "fixes"/"references"), Linear has 1 (issue→issue "references"). Sentry, Vercel, Apollo have `edgeRules: []`.
- **No temporal or behavioral edges**: Co-occurrence is the only edge creation mechanism. "These 5 PRs are part of the same initiative" cannot be computed from the current graph.
- **No engineer identity in the graph**: `sender.login`, `assignees`, `requested_reviewers` from GitHub webhooks are in raw payloads but never extracted as entities. The system cannot answer "what is Developer A working on?"

This means any feature that depends on "rich entity topology" (situation clustering, work stream detection, cross-tool narratives) is blocked until the graph gets denser.

## The "Thread" Abstraction Is Premature

The previous research proposed "Threads" as the critical missing Layer 3 — temporal, cross-tool narratives that emerge from entity patterns. This was compared to OS processes.

**This is wrong for now.** Here's why:

1. **The graph can't support it.** Thread crystallization requires rich topology. The current graph has sparse structural edges only. Most entities have zero connections to entities from other providers.

2. **It's a new name for the entity detail page.** "Start from any entity, walk its edges, collect all reachable entities and their events, sort by time" — that's an entity detail page with a timeline tab and a related entities tab. Calling it a "Thread" adds conceptual weight without computational substance.

3. **The hard problem is unsolved.** Knowing where to draw subgraph boundaries ("is this one Thread or two?") requires either LLM reasoning (expensive per-entity) or hand-crafted heuristics (fragile). Neither approach has been prototyped.

4. **The simple version ships now.** An entity detail page showing: entity state, event timeline, related entities via edges, and significance score — delivers 80% of the Thread concept with 10% of the complexity.

**Recommendation**: Ship the entity detail page. Let users see the natural clustering in their data. If patterns emerge that demand algorithmic grouping, build Thread detection as a later enhancement informed by actual usage.

## Roadmap

The sequence is designed so each step makes the next one easier. Steps 1-9 are the foundation — making the graph dense, the system useful in dev workflows, and the data visible. Steps 10-15 are where compounding kicks in.

---

### Step 1: Entity-First UI

**Status**: Entity backend is 100% complete. This is purely tRPC router + Next.js pages.

**What to build**:
1. Entity tRPC router — `entities.list` (cursor pagination, category/source/search filters, significance sorting), `entities.get` (by externalId), `entities.getEvents` (junction → enriched `orgEvents`), `entities.getEdges` (related entities via `orgEntityEdges`)
2. Entity list page at `/{slug}/entities` — filterable by category, source, search. Sorted by `lastSeenAt` or `significanceScore`. Infinite scroll.
3. Entity detail page at `/{slug}/entities/[entityId]` — metadata + state, event timeline (from enriched `orgEvents`, not `orgIngestLogs`), related entities (from graph edges), significance.
4. Navigation update — Replace "Events" with "Entities" in sidebar. Remove Jobs.

**Existing plan**: `thoughts/shared/plans/2026-04-05-entity-first-ui-rework.md`

---

### Step 2: .lightfast Context Injection

**What to build**:
1. `.lightfast` repo sync — Implement issue #560. Webhook handler for repo pushes, cache content in Redis/DB.
2. Inject into Answer agent — Wire cached content through `buildAnswerSystemPrompt` → `answerOrgContextSection` (currently returns null because `repos: []`, `integrations: []`).
3. Soul nav item — Read-only `.lightfast` viewer in UI at `/{slug}/soul`.

**Existing research**: `thoughts/shared/research/2026-04-04-dotlightfast-feature-design.md`

---

### Step 3: Launch MCP + SDK

**What to build**:
1. `lightfast_shell` MCP tool per the sandbox shell design — external AI tools (Claude Code, Cursor) access org identity + entity graph.
2. Public SDK surface via existing oRPC API contract (search + proxy).

**What this delivers**: Lightfast becomes a context provider for the developer's existing AI tools, not just a standalone app.

---

### Step 4: Go Live with Vercel Deployments Tracking

**Context**: Vercel provider is built but currently disabled in prod. `edgeRules: []`.

**What to build**:
1. Enable Vercel webhook ingestion in production.
2. Add Vercel edge rules: `deployment→commit` ("deploys"), `deployment→pr` ("triggered_by").
3. Verify deployment entities flow through pipeline → graph → Pinecone.

**What this delivers**: Deployment entities with edges to commits and PRs. The entity detail page for a PR now shows its deployments.

---

### Step 5: GitHub Team Member + Contributor Reconciliation

**Context**: The current GitHub App needs `members:read` OAuth scope. Check if the installation already has this — if not, it's a scope expansion + re-auth flow. Do this early.

**Approach**: Identity-first, not extraction-first. Don't scrape `sender.login` from webhook payloads (that's secondary). Use the GitHub org members API to get the real team roster, then reconcile activity.

**What to build**:
1. Fetch GitHub org members via API → create `engineer` entities with canonical identity.
2. Use the existing `aliases` column on `orgEntities` to store provider-specific identities: `engineer:jeevan` with `aliases: ["github:jeevanpillay"]`.
3. On webhook events, match `sender.login` against known `engineer` aliases to link events to team members.
4. Backfill: re-link existing events to newly created engineer entities.

**What this delivers**: The graph has real people in it. Entity detail for `engineer:jeevan` shows all their PRs, issues, commits, deployments across tools.

---

### Step 6: Bot / Agent Actor Recognition

**Context**: Bots like CodeRabbit, Sentry AI (@seer), Vercel agents do real work that shows up in GitHub. They're first-class actors in the system, distinct from human engineers.

**Approach**: Dev-maintained registry of known bot identifiers. When the system encounters `@seer`, `@coderabbitai`, `@vercel[bot]`, etc., it creates an `agent` entity (new category, separate from `engineer`) with the bot's identity.

**What to build**:
1. Add `agent` as a new EntityCategory (or consider reusing `service` — but `agent` is cleaner since bots have different lifecycle patterns than infrastructure services).
2. Bot registry: a maintained list mapping GitHub usernames/patterns to known bots (e.g., `coderabbitai → CodeRabbit`, `seer-ai → Sentry AI`, `vercel[bot] → Vercel`).
3. During engineer reconciliation (step 5), classify actors as `engineer` or `agent` based on the registry.

**What this delivers**: The graph distinguishes human work from automated work. "Show me what CodeRabbit flagged on this PR" and "show me what humans reviewed" are both answerable.

---

### Step 7: GitHub Comments Integration

**Context**: Comments are the missing signal source that makes the graph dense. Currently the GitHub provider handles `pull_request` and `issues` webhook events. Comments (`issue_comment`, `pull_request_review_comment`, `pull_request_review`) are where:
- Code review decisions happen
- Bots report their work (CodeRabbit reviews, Vercel preview URLs, Sentry issue links)
- Cross-tool context lives (someone pastes a Sentry link in a PR comment)

**What to build**:
1. New GitHub webhook event handlers for `issue_comment`, `pull_request_review_comment`, `pull_request_review`.
2. New transformers producing `PostTransformEvent` with the comment author as a relation (linked to `engineer` or `agent` entity from steps 5-6).
3. Entity extraction from comment body — comments naturally reference other entities (issue numbers, Sentry links, deployment URLs, file paths).
4. Edge rules for comments: `comment→pr` ("reviews"), `comment→issue` ("discusses"), `agent→pr` ("reviewed_by_bot").

**What this delivers**: Massive increase in edge density. Every PR now has edges to reviewers (human and bot), related issues mentioned in comments, Sentry errors linked in discussion, and deployment URLs. The entity graph becomes a real knowledge graph.

---

### Step 8: Go Live with Sentry in Prod

**Context**: Sentry provider is built but currently disabled in prod. `edgeRules: []`.

**What to build**:
1. Enable Sentry webhook ingestion in production.
2. Add Sentry edge rules: `issue→deployment` ("caused_by"), `issue→commit` ("introduced_by"), `issue→engineer` ("assigned_to").
3. Cross-source linking: Sentry issue entities should link to GitHub PR entities when the error traces to a specific commit/deploy.

**What this delivers**: Error entities connected to the code that caused them. "This Sentry error was introduced by PR #42, deployed in deploy xyz, authored by engineer:jeevan."

**Prerequisite research**: `thoughts/shared/research/2026-04-04-cross-source-monorepo-linking.md` and `thoughts/shared/research/2026-04-04-cross-source-linking-fixes.md`.

---

### Step 9: Close the Dev Loop (Lightfast MCP in Dev Mode)

**The first "OS moment."** This is where Lightfast transitions from "a thing you check" to "a thing that informs your work."

**What to build**:
1. Extend the MCP tool surface so developers can, from Claude Code / Cursor / their IDE:
   - Fetch recent Sentry issues related to what they're working on
   - Check if the latest Vercel deployment succeeded for their branch
   - Find related Linear issues for the code they're touching
   - Search the entity graph for context ("what broke last time someone changed this file?")
2. The MCP tools query the entity graph + enriched events, not raw webhook data.

**What this delivers**: Developers use Lightfast as a context source during development. The system is informing work, not just observing it. This is the pull→push transition grounded in a real workflow.

---

### Step 10: Skills Integration (LLM-Interpreted Markdown)

**Context**: By this point the graph is dense (engineers, bots, comments, Sentry, Vercel all connected), .lightfast context is available, and MCP provides the action surface.

**The vision**: Developers write markdown skill files in `.lightfast/skills/`. Skills are declarative — describe the goal and context, the LLM interprets and resolves to concrete actions.

**Skill spec example**:

```markdown
# triage-sentry-alerts

## Trigger
When a new entity of category `issue` from source `sentry` appears with
significance score >= 60.

## Context Required
- .lightfast/priorities.md (current team priorities)
- Entity graph: related deployments and PRs
- Recent entities of category `issue` from source `linear`

## Steps
1. Read the Sentry issue details from the entity's linked events
2. Check if a Linear issue already references this Sentry error
3. If linked: update the Linear issue with the new occurrence count
4. If not linked: assess severity against team priorities, create a Linear issue
5. If significance >= 80: notify the #engineering channel

## Approval Required
- Creating Linear issues: yes (queue for human approval)
- Updating existing issues: no (auto-execute)
- Notifications: no (auto-execute)
```

**Why LLM-first, not rules-first**: Deterministic triggers are just Zapier. The differentiator is that the LLM understands the skill's *intent* and can adapt to novel situations. A rule says "if X then Y." A skill says "here's what I care about and why — figure out the right action."

**Cost mitigation**: Deterministic first-pass trigger matching (category + source + score filter) gates which events even reach the LLM. The LLM only runs for matched events, not every webhook.

**Implementation sketch**:

```
platform/entity.graphed
  → platformSkillEvaluator (new Inngest function)
      1. Load org's active skills from .lightfast/skills/
      2. Deterministic first-pass: filter skills by trigger (category + source + score)
      3. For matching skills: LLM evaluates context + steps
      4. Proposed actions → approval queue (if required) or auto-execute
      → platform/skill.matched → platformSkillRunner → platform/action.proposed
```

**Open questions** (each needs dedicated research):
- Action authorization: do stored OAuth tokens have write scopes?
- Skill versioning: how to roll back a bad skill update?
- Approval queue UI: DB table + tRPC + page at `/{slug}/approvals`

---

### Step 11: Slack Integration (Outbound Only)

**Key insight**: Don't ingest Slack. Use it as the action channel. Lightfast replaces N separate Slack bots (Sentry→Slack, GitHub→Slack, Vercel→Slack) with one contextually-aware integration.

**What to build**:
1. Slack App with `chat:write` scope (no inbound webhook needed).
2. Entity notification dispatch: when new high-significance entities are found, post to a configured Slack channel with cross-tool context.
3. Skills can use Slack as an action target: "if significance >= 80, post to #engineering."

**What this delivers**: Instead of 4 separate Slack bots sending fragmented notifications, one Lightfast message: "PR #42 merged → linked to Sentry issue PROJ-123 → deployed to preview → CodeRabbit approved." Contextual, not noisy.

**Why outbound-only**: Maintaining a Slack inbound webhook is operational overhead for limited signal value. The real signals are already in GitHub, Sentry, Vercel, Linear. Slack is the output channel for surfacing intelligence, not an input channel for raw data.

---

### Step 12: Upgrade Ask Page (Rich Contextual Suggestions)

**Context**: Current `ask-lightfast-suggestions.tsx` has hardcoded prompt categories (Explore, Activity, Connections) with generic prompts like "What changed in the last 24 hours?". By this point the system has dense entity data, engineer/bot identities, and cross-tool context.

**What to build**:
1. Dynamic suggestion categories based on what's actually happening in the org — recent high-significance entities, active situations, your recent activity.
2. Actor-relative suggestions: "What did CodeRabbit flag on your PRs this week?", "Show me Sentry errors related to the checkout service."
3. Rich entity previews in Ask responses — not just text answers but inline entity cards with state, timeline snippets, and related entities.

**What this delivers**: The Ask page transforms from a generic chatbot into a company-aware terminal. Suggestions are grounded in real data, not placeholder prompts.

---

## Compounding Future (each builds on everything above)

### Step 13: GitHub Comment Triage Bot

**What it is**: A skill (step 10) that monitors GitHub comments and PR reviews, finds related issues across the graph, and triages them based on the org's `.lightfast/skills/` configuration.

**Example**: When a new Sentry error is mentioned in a GitHub comment, the triage skill traces it through the graph (error → deployment → PR → engineer), assesses severity against `.lightfast/priorities.md`, and either creates a Linear issue or links to an existing one — posting the triage summary as a GitHub comment reply.

**Why it compounds**: This is not a new system. It's a configuration of existing primitives: entity graph (step 1-8) + skills evaluation (step 10) + GitHub comments (step 7) + bot identity (step 6). The triage bot *is* a Lightfast agent entity that shows up in the graph alongside CodeRabbit and Sentry AI.

### Step 14: Lightfast Search for Docs + End-User Store

**What it is**: Use the entity store and vector search infrastructure (Pinecone + Cohere) as a general search primitive that also powers docs search at `apps/www/src/content/docs/`. Drop the current `use-docs-search.ts` mxbai-based search in favor of Lightfast's own search API.

**Why it compounds**: End users can use Lightfast's "store" as their own aggregated search across their org's entities + Lightfast's documentation. One search interface, one vector store, one embedding pipeline.

### Step 15+: The Horizon

Things that become possible once steps 1-14 are in place:
- **Pulse homepage**: Replace Ask as homepage with a situation-aware view. Now feasible because the graph is dense enough to cluster meaningfully.
- **Autonomous daemon**: Skills running on cron, not just event-triggered. "Every Monday, summarize last week's deployments."
- **Cross-org patterns**: Anonymized pattern detection across Lightfast users. "Teams using this Sentry→Linear triage skill resolve errors 40% faster."
- **Skill marketplace**: Community-shared skills. The `.lightfast` repo is private (org identity), but skills are shareable.
- **Progressive autonomy**: Approval-required → approval-optional → fully autonomous. The trust gradient from self-driving car autonomy levels.

## OS Analogy (reference model, not implementation plan)

| OS Concept | Lightfast Equivalent | Roadmap Step |
|---|---|---|
| Signal / Interrupt | Webhook event | Production |
| Device Driver | Provider transformer | Production (5 built, 3 active, Vercel+Sentry disabled) |
| File | Entity | Production (12 categories; `engineer` at step 5, `agent` at step 6) |
| File System | Entity graph | Production → dense by step 8 (comments + Sentry + Vercel edges) |
| `/etc/` config | `.lightfast` repo | Step 2 |
| User | Engineer entity (from GitHub org members API) | Step 5 |
| Bot / daemon | Agent entity (dev-maintained bot registry) | Step 6 |
| Shell | MCP tools + Ask page | Steps 3, 9, 12 |
| System call | Skill | Step 10 |
| IPC / notifications | Slack outbound | Step 11 |
| Scheduler | Skill evaluator (Inngest) | Step 10 (event-triggered), Step 15+ (cron-triggered) |

## Navigation Evolution

**Current**:
```
Primary:  Ask, Search
Manage:   Events, Sources, Jobs, Settings
```

**After steps 1-2**:
```
Primary:  Ask, Search
Manage:   Entities (replaces Events), Sources, Soul (new), Settings
          (Jobs removed)
```

**After steps 10-11**:
```
Primary:  Ask, Search
Manage:   Entities, Skills (new), Sources, Soul, Settings
```

**Step 15+ (when graph is dense enough)**:
```
Primary:  Pulse (replaces Ask as homepage), Ask (becomes terminal)
Manage:   Entities, Skills, Sources, Soul, Settings
```

## Code References (verified)

### Entity Backend
- `db/app/src/schema/tables/org-entities.ts` — Entity schema, 12 categories, dedup key `(clerkOrgId, category, key)`
- `db/app/src/schema/tables/org-entity-edges.ts` — Directed graph edges, unique on `(org, source, target, type)`
- `db/app/src/schema/tables/org-event-entities.ts` — Junction table with `refLabel` and denormalized `category`
- `db/app/src/schema/tables/org-events.ts` — Enriched events with `significanceScore`, `observationType`
- `packages/app-validation/src/schemas/entities.ts:9-24` — EntityCategory enum (12 categories)

### Neural Pipeline
- `api/platform/src/inngest/functions/platform-event-store.ts` — Event + entity upsert, listens on `platform/event.capture`, emits `platform/entity.upserted`
- `api/platform/src/inngest/functions/platform-entity-graph.ts` — Edge resolution, listens on `platform/entity.upserted`, emits `platform/entity.graphed`
- `api/platform/src/inngest/functions/platform-entity-embed.ts` — Pinecone vector upsert, listens on `platform/entity.graphed`, 30s debounce
- `api/platform/src/lib/entity-extraction-patterns.ts:17-77` — 7 regex patterns covering 4 of 7 semantic categories. `engineer` and `service` have zero patterns.
- `api/platform/src/lib/edge-resolver.ts:33-38` — Edge resolution gated on structural categories only
- `api/platform/src/lib/scoring.ts:90-132` — 4-stage additive significance scoring
- `api/platform/src/lib/narrative-builder.ts:48-94` — 5-section narrative for Pinecone embedding

### Events UI (to be replaced)
- `api/app/src/router/org/events.ts:52-57` — Reads from `orgIngestLogs`, not `orgEvents`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/` — Page + components reading raw webhook data

### Answer Agent
- `apps/app/src/app/(api)/v1/answer/[...v]/route.ts` — claude-sonnet-4.6, single tool `orgSearch`
- `apps/app/src/ai/prompts/sections/org-context.ts:3-33` — Always returns null (injection point for .lightfast)
- `apps/app/src/ai/prompts/system-prompt.ts:16-42` — Passes `repos: []`, `integrations: []`

### Provider Edge Rules
- `packages/app-providers/src/providers/github/index.ts:342-368` — 3 rules
- `packages/app-providers/src/providers/linear/index.ts:387-396` — 1 rule
- Sentry, Vercel, Apollo — all `edgeRules: []`

### Navigation
- `apps/app/src/components/app-sidebar.tsx:39-74` — Two groups: primary (Ask, Search) + manage (Events, Sources, Jobs, Settings)

## Related Thoughts
- `thoughts/shared/plans/2026-04-05-entity-first-ui-rework.md` — Implementation plan for Phase 1
- `thoughts/shared/research/2026-04-05-entity-first-ui-rework-landscape.md` — Landscape research for Phase 1
- `thoughts/shared/research/2026-04-04-dotlightfast-feature-design.md` — .lightfast repo design (Phase 2)
- `thoughts/shared/research/2026-04-04-cross-source-monorepo-linking.md` — Cross-source entity linking (Phase 3 prerequisite)
- `thoughts/shared/research/2026-04-04-cross-source-linking-fixes.md` — Fixes for cross-source linking

## Open Questions

1. **GitHub App OAuth scopes** (blocks step 5): Does the current GitHub App installation have `members:read` scope? If not, it's a scope expansion + re-auth flow. Check this before starting step 5.

2. **Bot registry maintenance** (step 6): Who maintains the known-bot list? Options: hardcoded in `app-providers` (simplest), configurable per-org in `.lightfast` (most flexible), community-maintained (long-term). Start hardcoded — the set of popular bots (CodeRabbit, Sentry AI, Vercel, Dependabot, Renovate) is small and stable.

3. **GitHub comment webhook volume** (step 7): Comments are high-volume events. A busy repo might generate 10x more comment webhooks than PR webhooks. Need significance scoring tuned for comments (most bot comments are low-signal). Consider: debounce or batch comment processing.

4. **Cross-source entity linking for Sentry** (step 8): Sentry errors reference commits/releases but the identifier format differs from GitHub. Research in `thoughts/shared/research/2026-04-04-cross-source-monorepo-linking.md` covers this but implementation is non-trivial for monorepos.

5. **Action authorization for skills** (step 10): Do stored OAuth tokens have write scopes? `proxy.execute` exists but token permissions are unknown. Needs dedicated research before skills can take write actions.

6. **EntityCategory enum expansion** (step 6): Adding `agent` as a new category requires a schema migration + updating `packages/app-validation/src/schemas/entities.ts`. Consider whether `agent` is the right name, or if `bot` is more intuitive. The category name shows up in the entity UI (step 1).
