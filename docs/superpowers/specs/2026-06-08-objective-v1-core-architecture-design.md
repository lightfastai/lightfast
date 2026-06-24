# Objective v1 Core Architecture - Design

Date: 2026-06-08
Status: Draft architecture from grilling
Area: Lightfast OS, Objective v1, Mission Control, TanStack Server Functions

## Summary

Objective v1 is the smallest dogfoodable architecture for turning intent into a
durable org-visible work object.

The first loop is intentionally small:

```text
Objective switcher
-> New Objective
-> Objective page / Mission Control
-> Runs
-> Decisions
-> Evidence links
-> Objective conversations
```

The goal is not full autonomy. The goal is to create enough durable structure
that the team can use Objective v1 to coordinate Objective v2 and learn where
the next architecture pressure appears.

The core v1 thesis:

> Objective v1 is event-log-first, projection-backed, Objective-owned, and
> manual-but-durable.

## Context

Related documents:

- `docs/superpowers/specs/2026-06-07-level-2-harness-architecture-design.md`
- `docs/superpowers/reports/2026-06-07-objectives-v1-dogfood-handoff.md`

Current scaffold facts:

- There is no Objective domain model yet.
- Existing Decisions are provider routine call audit rows, not Objective-native
  collaboration decisions.
- Existing workspace assistant conversations are user-scoped chat records.
- Objective v1 should not add new tRPC APIs because the app is moving toward
  TanStack Start and TanStack Server Functions.

## Product Scope

### In Scope

- Create an Objective from the Objective switcher or new Objective flow.
- Show an Objective page as the Objective control panel, also called Mission
  Control.
- Show Objective Runs, Decisions, Evidence, and the latest Objective
  conversation inside the Objective page.
- Keep the Objective switcher minimal: current org, `updatedAt desc`, limit 3.
- Use Objective-native Decisions separate from provider routine call audit rows.
- Use Evidence as Objective-level links only.
- Persist Objective state through an append-only event log with synchronous
  projection updates.
- Make Objective-scoped conversations org-visible.

### Out Of Scope

- Workspace Mission Control.
- Full Objectives index page.
- Separate routes for Runs, Decisions, Evidence, or conversations.
- Separate Decision Inbox.
- Task graph table.
- Multi-run management UI.
- Autonomous agent execution.
- Assistant tools that mutate Objective state.
- Evidence bodies, uploads, summaries, copied command output, or stale text.
- Role-based Objective permissions or Objective membership.
- New tRPC Objective routers.

## Architecture Decisions

### Source Of Truth

Objective events are the source of truth from v1.

Projection tables exist for fast reads and simple UI queries. Domain helpers
append events and update projections in the same database transaction. There is
no async projector in v1.

### Event Stream

Objective events live in one unified Objective-scoped event table. Each
Objective has its own monotonic `sequence`.

The event row uses the smallest accepted v1 schema:

- `id`
- `publicId`
- `clerkOrgId`
- `objectiveId`
- `sequence`
- `type`
- `actorKind`
- `actorId`
- `payload`
- `createdAt`

Events are append-only and do not have `updatedAt`.

The sequence is assigned with `max(sequence) + 1` scoped to `objectiveId` inside
the same transaction. A unique constraint on `(objectiveId, sequence)` is the
safety net. A writer may retry once after a unique constraint collision.

Payloads are JSON validated by domain helpers. The database does not encode each
payload shape as columns.

### Projection Tables

Objective v1 uses separate thin projection tables:

- Objectives
- Objective Runs
- Objective Decisions
- Objective Evidence Links
- Objective Events

Conversations reuse the existing workspace assistant conversation tables with an
Objective association.

### Public Id Prefixes

Objective primitives use short product-facing public id prefixes:

- Objective: `obj_`
- Objective Run: `run_`
- Objective Decision: `dec_`
- Objective Evidence Link: `ev_`
- Objective Event: `evt_`

## Domain Model

### Objective

An Objective is the durable org-owned work object.

Minimum fields:

- `id`
- `publicId`
- `clerkOrgId`
- `title`
- `intent`
- `status`
- `manualStatus`
- `createdByUserId`
- `createdAt`
- `updatedAt`

Projected Objective statuses:

- `planning`
- `active`
- `waiting_for_decision`
- `verifying`
- `completed`

Manual Objective statuses:

- `planning`
- `active`
- `verifying`
- `completed`

`waiting_for_decision` is derived. Users do not set it manually.

### Objective Status Projection

Objective status uses a hybrid projection rule:

1. If any `requires_response` Decision is open, project
   `waiting_for_decision`.
2. Otherwise, if `manualStatus` is set, project `manualStatus`.
3. Otherwise, mirror the current Run:
   - Run `planning` -> Objective `planning`
   - Run `active` -> Objective `active`
   - Run `completed` -> Objective `completed`

### Objective Run

A Run is a durable attempt to advance an Objective. V1 creates one initial Run
per Objective and exposes it as real data, but the Runs UI is intentionally
thin.

Minimum fields:

- `id`
- `publicId`
- `clerkOrgId`
- `objectiveId`
- `status`
- `title`
- `plan`
- `createdAt`
- `updatedAt`

Run statuses:

- `planning`
- `active`
- `waiting`
- `completed`

The Run `plan` is JSON. V1 does not create a Task table.

Plan item shape:

```ts
{
  id: string;
  text: string;
  status: "pending" | "active" | "completed";
}
```

### Objective Decision

An Objective Decision is a collaboration primitive for Objective-specific
judgment, context, or approval. It is separate from existing provider routine
call Decisions.

Minimum fields:

- `id`
- `publicId`
- `clerkOrgId`
- `objectiveId`
- `status`
- `title`
- `description`
- `answer`
- `createdByUserId`
- `answeredByUserId`
- `createdAt`
- `updatedAt`
- `answeredAt`

Decision statuses:

- `proposed`
- `requires_response`
- `answered`
- `rejected`

Answer rules:

- `answered` requires a non-empty `answer`.
- `rejected` may include an `answer`, but does not require one.
- `proposed` and `requires_response` keep `answer` null.

Creating a `requires_response` Decision makes the Objective project to
`waiting_for_decision`. Answering or rejecting the last open
`requires_response` Decision returns the Objective to `manualStatus` or the
current Run-derived status.

### Objective Evidence Link

Evidence v1 is Objective-level links only. It stores no body text, copied
output, mutable summary, upload, or stale descriptive payload.

Minimum fields:

- `id`
- `publicId`
- `clerkOrgId`
- `objectiveId`
- `url`
- `label`
- `createdByUserId`
- `createdAt`

Evidence links are append-only in v1 and do not have `updatedAt`.

Evidence links do not attach to Runs or Decisions in v1.

### Objective Conversation

Conversations are inside an Objective. An Objective may have many
conversations. Each Objective-scoped conversation belongs to exactly one
Objective.

V1 reuses existing workspace assistant conversation/message infrastructure and
adds a nullable `objectiveId` to conversations:

- `objectiveId` is nullable for legacy non-Objective chats.
- New product-facing Objective conversations must set `objectiveId`.
- Objective-scoped conversations are org-visible to active org members.
- `createdByUserId` remains provenance, not access control.
- Legacy workspace chats may remain user-scoped during migration.

The Objective page shows the latest conversation on Overview. V1 does not expose
a conversation tab, full-page conversation route, or conversation history list.
`Continue` focuses the latest Objective conversation composer. If an Objective
has no conversation, `Continue` creates one and focuses it.

## Event Types

V1 supports these event types:

- `objective.created`
- `objective.status_updated`
- `run.created`
- `run.plan_updated`
- `conversation.created`
- `capabilities.snapshot_recorded`
- `decision.created`
- `decision.answered`
- `decision.rejected`
- `evidence_link.added`

There is no separate `intent.recorded` event in v1. The original intent is in
the `objective.created` payload and Objective projection.

There is no `message.created` Objective event in v1. Conversation messages are
not Objective state transitions unless they cause a specific Objective mutation.

`capabilities.snapshot_recorded` is intentionally shallow. It records the small
set of capabilities the Objective can use at creation time, such as
`workspace_assistant`, `manual_decisions`, and `evidence_links`.

## Creation Flow

Objective creation happens from the Objective switcher or New Objective flow.

The creation transaction creates:

- Objective projected as `planning`
- Initial Run projected as `planning`
- First Objective-scoped conversation
- `objective.created` event
- `run.created` event
- `conversation.created` event
- `capabilities.snapshot_recorded` event

The UI navigates to the Objective page immediately after this durable shell
exists. It does not wait for intelligence, title refinement, capability
analysis, or plan generation.

The initial title is derived synchronously from the intent. Title editing can
wait.

## Mission Control View Model

The Objective page is the Objective control panel. It is also the v1 Mission
Control surface.

The page reads a purpose-built view model, not raw rows stitched together in the
component:

```ts
{
  objective,
  currentRun,
  decisions,
  evidenceLinks,
  latestConversation,
  bootSteps,
  mode: "booting" | "ready",
}
```

The view model reads projections. It does not expose raw event rows.

Boot is a mode of the Mission Control view model. Boot steps are derived from
events and projection state.

The Objective page contains tabs or sections for:

- Overview
- Runs
- Decisions
- Evidence

Conversation lives on Overview. There is no Conversation tab in v1.

## V1 UI Behavior

### Objective Switcher

The switcher query is intentionally tiny:

- current org only
- `orderBy updatedAt desc`
- `limit 3`
- no grouping
- no search
- no filters

The switcher shows status as a small label.

### Routes

Minimum Objective routes:

- `/{slug}/objectives/new`
- `/{slug}/objectives/{objectiveId}`

`/{slug}` redirects to the latest Objective when one exists. Otherwise it
redirects to `/{slug}/objectives/new`.

V1 does not add:

- `/{slug}/objectives`
- `/{slug}/objectives/{objectiveId}/runs/{runId}`
- `/{slug}/objectives/{objectiveId}/decisions/{decisionId}`
- `/{slug}/objectives/{objectiveId}/evidence/{evidenceId}`
- `/{slug}/objectives/{objectiveId}/conversations/{conversationId}`

### Runs

The Runs tab is real but thin:

- list the initial Run
- show status
- show timestamps
- show plan when present

V1 does not expose create, cancel, retry, logs, command output, or multi-run
management.

### Decisions

The Decisions tab supports the required collaboration loop:

- show Objective Decisions
- answer a `requires_response` Decision
- reject a Decision

A generic Add Decision UI is not required in v1. Dogfood templates, fixtures, or
admin-light flows may create Decisions so the answer/reject loop can be tested.
A generic Decision is not seeded for every new Objective.

### Evidence

The Evidence tab supports a tiny Add Link flow:

- URL
- label

There is no kind taxonomy in v1.

## API Boundary

Objective v1 should use TanStack Server Functions as the app API rather than
adding new tRPC routers.

Domain utilities stay framework-agnostic:

- `db/app/src/schema/tables/org-objectives.ts`
- `db/app/src/utils/objectives.ts`

The app layer exposes server functions for Objective reads and mutations. Exact
paths depend on the incoming TanStack migration, but the boundary is stable:

- Server functions validate input with Zod.
- Server functions enforce org-active auth inside the handler or middleware.
- Route guards alone do not protect server functions.
- Route loaders call server functions for reads.
- Components call server functions for writes.
- Loaders do not query the database directly.
- Route components do not contain Objective business logic.

Representative server functions:

- `createObjective`
- `listObjectives`
- `getObjectiveMissionControl`
- `answerObjectiveDecision`
- `rejectObjectiveDecision`
- `addObjectiveEvidenceLink`

No new Objective tRPC router is added.

## Auth And Visibility

Objective v1 requires active org membership.

Any active org member can:

- list the latest 3 Objectives
- create an Objective
- view Objective Mission Control
- send Objective conversation messages
- answer or reject Objective Decisions
- add Evidence links

There is no Objective membership, role routing, assignment, or policy matrix in
v1.

All Objective state is org-visible. Legacy non-Objective workspace chats may
remain user-scoped until migrated.

## Tests To Leave With Implementation

This spec does not define a full implementation plan, but the v1 scaffold should
leave focused tests at these boundaries:

- Objective creation transaction creates Objective, Run, first conversation, and
  events.
- Event sequence increments per Objective and rejects duplicate sequences.
- Objective status projects to `waiting_for_decision` while a required Decision
  is open and returns after resolution.
- Evidence links are URL + label only and append-only.
- Objective switcher returns current org Objectives ordered by `updatedAt desc`
  with limit 3.
- Mission Control view model returns projection data and derived boot steps, not
  raw events.
- Objective-scoped conversations are org-visible, while legacy conversations
  retain their existing access behavior.

## Deferred To v1.1+

- GitHub-specific Objective integration behavior.
- Assistant tools that write Objective events.
- Workspace Mission Control.
- Full Objectives index.
- Separate Decision Inbox.
- Conversation list and conversation routes.
- Evidence kinds, summaries, uploads, or attachment relationships.
- Task table and runtime task graph.
- Multi-run creation and management.
- Event replay UI or timeline.
- Capability registry and policy checks.
- Role/team Decision ownership.
