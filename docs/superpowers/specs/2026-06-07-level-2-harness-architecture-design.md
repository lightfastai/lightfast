# Level 2 Harness Architecture - Design

Date: 2026-06-07
Status: Draft architecture
Area: Lightfast OS, Objectives, Runs, Decisions, agent harness, B2B collaboration

## Summary

Lightfast's Level 1 Harness Scaffold gives agents the basic substrate they need:
skills, connectors, developer connectors, sandbox access, and a ledger of
external provider calls. Level 2 should add the intelligence harness above that
substrate.

The Level 2 Harness is an org-scoped coordination engine that turns natural
language intent into durable, collaborative execution state. A user should be
able to describe an intent such as "integrate observability into Lightfast" and
have Lightfast create an org-visible Objective, start supervised Runs, model
tasks and blockers, request Decisions from the right people or roles, execute
allowed actions through capabilities, and preserve evidence for every important
state transition.

The core architectural thesis:

> Level 2 Harness is not "an agent that does tasks." It is an event-sourced,
> org-scoped operating layer where agents, users, tools, policies, and external
> systems collaborate around durable Objectives.

This document describes the target end-to-end architecture. It is not an
implementation plan and does not freeze the final Objective Page UI.

## Context

Current scaffolded primitives:

- Skills: indexed agent-skill markdown, present but not yet a runtime capability
  source for product agents.
- Connectors: external integrations such as Linear and X, with MCP-backed
  runtime tools and provider routine call records.
- Developer Connectors: privileged developer integrations such as PlanetScale,
  Upstash, Sentry, and Clerk, including sandbox lease materialization. These are
  conceptually a privileged class of connector and should merge into the
  connector/capability model over time.
- Decisions: currently a product label over provider routine call audit rows.
  They record facts like "linear_create_issue was called" rather than modeling a
  durable human/system decision.
- Signals and triage: early LLM graph experiments in
  `ai/src/_internal/agent-graphs/signal-intake.ts` and
  `ai/src/_internal/agent-graphs/triage.ts`. These classify and route, but they
  do not own durable execution.

These primitives are useful, but they remain Level 1: tools, access, and
records. Level 2 adds durable intent, collaboration, supervised execution,
policy-aware state transitions, and explainable history.

## Product Principles

- Users describe intent; Lightfast carries structured state.
- Objectives are B2B work objects, not single-user chat tasks.
- Collaboration flows through Decisions assigned to users, teams, or roles.
- Agents may propose transitions, but typed state, policy, capability checks,
  and Decisions govern what advances.
- The source of truth is an append-only event log with materialized current
  state for fast reads and UI rendering.
- The Objective Page is a generated state surface. It expresses current state,
  but it does not invent or own truth.
- Day-one scaffolding can be simple, but the architecture should allow
  Objectives to span days or weeks, multiple Runs, multiple branches, multiple
  PRs, deployments, post-merge verification, and follow-up work.

## Level 1 To Level 2 Mapping

| Level 1 primitive | Current role | Level 2 role |
| --- | --- | --- |
| Skills | Indexed instructions and resources | Capability instructions bound to Runs when relevant |
| Connectors | External read/write integration tools | Capability providers for actions and evidence |
| Developer Connectors | Privileged CLI/API/sandbox access | Privileged connector capability class governed by policy |
| Decisions | Provider routine call audit surface | Collaboration and reasoning primitive |
| Provider routine calls | External tool call ledger | Evidence attached to Decisions, Actions, Tasks, Runs, or Objectives |
| Signals | Observed artifacts that might matter | Inputs that can create, link, or update Objectives |
| Triage | Classification and action recommendation | Intake subroutine feeding Objective state and Decisions |

The sharper distinction:

- Level 1 asks: "Can an agent call the thing?"
- Level 2 asks: "Should this Objective advance, who needs to decide, what
  evidence supports it, and what happens next?"

## Core Domain Model

### Objective

An Objective is the durable, org-owned work object created from intent.

Example: "Integrate observability into Lightfast."

An Objective can live across days or weeks and contain many Runs, Decisions,
Tasks, evidence records, branches, PRs, deployments, comments, and external
artifacts. It is org-visible by default to authorized workspace members.

Primary responsibilities:

- preserve the original and refined intent;
- expose current status and progress;
- group Runs and generated work state;
- anchor collaboration and audit history;
- provide reusable org memory for future Objectives.

Representative statuses:

- `created`
- `planning`
- `active`
- `blocked`
- `waiting_for_decision`
- `verifying`
- `completed`
- `canceled`
- `superseded`

### Run

A Run is one bounded supervised attempt to advance an Objective.

A Run may inspect a repo, bind capabilities, propose a plan, request Decisions,
execute safe actions, call connectors, use a sandbox, edit code, create branches,
open PRs, verify work, or pause on blockers. An Objective can have many Runs
over time.

Representative statuses:

- `created`
- `planning`
- `waiting`
- `executing`
- `blocked`
- `verifying`
- `completed`
- `failed`
- `canceled`
- `superseded`

### Task

A Task is a dynamic unit inside a Run's task graph. Tasks are runtime state, not
necessarily a rigid user-facing checklist.

Tasks can represent prerequisites, implementation steps, verification work,
handoffs, external setup, or follow-up actions. The Objective Page may render
them as a timeline, checklist, generated card, grouped section, or not at all,
depending on the current Objective state.

Representative statuses:

- `proposed`
- `ready`
- `waiting_for_decision`
- `blocked`
- `executing`
- `completed`
- `failed`
- `skipped`
- `superseded`

### Decision

A Decision is the central collaboration and reasoning primitive.

Decisions cover both human-required gates and agent/system choices:

- human gate: "Approve uploading Sentry env vars to Vercel."
- system choice: "Selected Sentry as the likely observability provider
  candidate."
- proposal: "Create a Linear issue for deployment follow-up."
- context request: "Need someone with Vercel access to provide the project
  scope."

Decision states should distinguish recorded facts, editable proposals, and
required responses.

Representative statuses:

- `recorded`: the harness observed or inferred something and can continue.
- `proposed`: the harness recommends a direction that may be changed.
- `requires_response`: progress needs a human, team, role, or policy answer.
- `answered`: a user, team, system, or policy resolved it.
- `rejected`: the proposed action or answer was declined.
- `dismissed`: the Decision was intentionally closed without advancing.
- `superseded`: later state made the Decision irrelevant.

Representative owner targets:

- specific user;
- team;
- role, such as `admin`, `engineer`, `product`, or `infra_owner`;
- unresolved owner label, such as "someone with Vercel access."

Existing provider routine call rows should no longer be treated as the whole
Decision concept. They become evidence that can support a Decision or Action.

### Evidence

Evidence is any artifact that supports a state transition or explains why the
harness did something.

Examples:

- connector call result;
- provider routine call id;
- sandbox command log;
- code diff;
- PR link;
- deployment URL;
- test result;
- user answer;
- policy decision;
- LLM structured output;
- selected skill;
- error trace;
- webhook payload summary.

Evidence should be redacted and scoped according to org policy. It should be
linkable to Objective, Run, Task, Decision, and Action records.

### Capability Binding

A Capability Binding snapshots what a Run can use at a point in time.

Capabilities include:

- skills;
- connectors;
- privileged developer connectors;
- sandbox runtime;
- repository access;
- provider routines;
- credentials and leases;
- org policies;
- selected agent/runtime profiles.

Bindings are important for auditability. A future reviewer should be able to
answer: "What did Lightfast believe it could do when it made this choice?"

### Action

An Action is an attempted state-changing or read operation performed by the
harness.

Examples:

- run a local/sandbox command;
- call a connector tool;
- create a branch;
- edit files;
- open a PR;
- upload an environment variable;
- create an external issue;
- query an external provider;
- trigger a deployment.

Actions are not free-floating. They should be linked to the Run and, when
possible, to the Task and Decision that caused them. Actions emit Events and
Evidence.

## Event Log And Materialized State

The source of truth should be append-only events. Current Objective, Run, Task,
Decision, and UI state should be materialized from those events.

Representative event names:

```text
objective.created
objective.updated
objective.link_suggested
objective.linked
objective.completed
objective.superseded
run.started
run.blocked
run.resumed
run.verifying
run.completed
intent.classified
capabilities.bound
task.proposed
task.started
task.completed
task.blocked
decision.recorded
decision.proposed
decision.requires_response
decision.answered
decision.rejected
decision.superseded
policy.evaluated
action.requested
action.executed
action.failed
evidence.attached
ui.surface.generated
```

Each event should record:

- org/workspace scope;
- Objective id;
- optional Run, Task, Decision, Action, and Evidence ids;
- actor kind;
- actor id when available;
- event source;
- timestamp;
- schema version;
- payload;
- rationale when applicable;
- policy context when applicable;
- causation id and correlation id where useful.

Actor kinds:

- `user`
- `agent`
- `system`
- `connector`
- `webhook`
- `policy`
- `scheduler`

Materialized projections should support:

- Objective list and detail pages;
- current Run state;
- pending Decisions by owner/role;
- timeline and audit history;
- current task graph;
- evidence lookup;
- notification and assignment surfaces;
- future replay/debug tooling.

## Runtime Loop

The Level 2 Harness runtime is a supervised loop around an Objective and Run.

```text
1. Observe
2. Interpret
3. Model State
4. Propose Next Transition
5. Check Policy And Capability
6. Execute Or Request Decision
7. Attach Evidence
8. Materialize State
9. Render Objective UI
10. Repeat
```

### 1. Observe

The harness receives input from:

- user messages;
- Objective Page interactions;
- Decision answers;
- connector events;
- source control events;
- PR and deployment updates;
- sandbox results;
- provider routine call results;
- scheduler ticks;
- webhooks;
- errors and retries.

### 2. Interpret

The harness classifies what changed:

- new intent;
- answer to an existing Decision;
- blocker resolved;
- action failed;
- external artifact updated;
- task completed;
- capability became available or unavailable;
- Objective should be linked, split, or superseded.

Signal and triage graphs can operate here as subroutines. They should feed the
Objective runtime rather than own execution.

### 3. Model State

The harness updates its internal model of the Objective and Run from the event
log. The model may include a dynamic task graph, inferred prerequisites,
blockers, open Decisions, available capabilities, and recent evidence.

LLMs can help model state, but persisted state transitions must be typed.

### 4. Propose Next Transition

The intelligence layer proposes what should happen next:

- refine objective;
- create task;
- bind capability;
- ask for context;
- request approval;
- run command;
- call connector;
- edit code;
- open PR;
- mark blocked;
- verify;
- complete;
- supersede.

### 5. Check Policy And Capability

Before the transition advances, the harness checks:

- is the required capability available?
- does the Run have the right binding or lease?
- is the operation read-only, reversible, privileged, external, or destructive?
- does org policy allow it?
- does this require a human, role, or team response?
- is the proposed transition stale relative to current Objective state?

Policy results become evidence and may create Decisions.

### 6. Execute Or Request Decision

If the transition is allowed, the Execution Layer performs the action and logs
events/evidence.

If the transition is ambiguous, privileged, blocked, missing a capability, or
requires judgment, the harness creates or updates a Decision with an owner
target.

### 7. Attach Evidence

Every meaningful transition should be explainable. Evidence may include command
output, provider call ids, summaries, diffs, screenshots, PR links, deployment
links, user responses, and policy evaluation results.

### 8. Materialize State

The event log is projected into current state for fast reads and UI rendering.
Projection code should resolve superseded Decisions, stale proposals, completed
tasks, current blockers, and next actions.

### 9. Render Objective UI

The Objective Page renders the current projection into dynamic UI blocks:

- intent summary;
- current Run status;
- generated plan or task graph;
- blockers;
- pending Decisions;
- proposed next actions;
- evidence and history;
- external artifacts;
- team handoff prompts.

The UI can be generative, but it should render from state. It should not be the
state source of truth.

## Capability Layer

The Capability Layer is the unified registry of what the harness can use.

Capabilities should describe:

- provider or source;
- capability class;
- available operations;
- read/write/privileged classification;
- required credentials or leases;
- scopes;
- current status;
- org/workspace availability;
- policy constraints;
- schemas;
- audit requirements.

Capability classes:

- `skill_instruction`
- `connector_tool`
- `developer_connector_tool`
- `sandbox_runtime`
- `repo_access`
- `source_control`
- `deployment_provider`
- `secret_store`
- `agent_runtime`
- `policy`

Developer Connectors should merge into this layer as privileged connector
capabilities. The product may continue to present them differently when useful,
but the Level 2 runtime should reason over one capability model.

Capability Binding should happen per Run. This avoids mutable global capability
state becoming invisible in historical audit trails.

## Execution Layer

The Execution Layer performs actions after policy and capability checks.

Execution should support:

- dry-run or proposal-only transitions;
- supervised execution with Decision gates;
- connector and provider routine calls;
- sandbox command execution;
- source control operations;
- code editing through agent runtimes;
- PR creation and update;
- deployment and verification hooks;
- retry and recovery behavior;
- evidence capture and redaction.

The target autonomy posture is supervised execution:

- The harness may advance automatically through safe, policy-allowed steps.
- It pauses at policy boundaries, uncertainty boundaries, missing capabilities,
  missing ownership, and user-meaningful decisions.
- The exact policy matrix can evolve over time. It should be encoded as
  transition guards, not hidden in prompts.

## Collaboration And Governance

Lightfast is a B2B product for teams and orgs. Level 2 collaboration should be
native to the harness.

### Org Visibility

Objectives belong to an org/workspace. Authorized members can inspect current
state, pending Decisions, evidence, external artifacts, and history.

Day one does not require explicit Objective membership. Collaboration can center
on Decision ownership.

### Decision Ownership

Decisions can be routed to:

- user;
- team;
- role;
- unresolved owner label.

The harness can continue when Decisions are answered and should supersede stale
Decisions when Objective state changes.

### Mixed Human And System Decisions

The Decision layer records both human gates and system/agent choices. This makes
the Objective explainable and challengeable.

Examples:

- "System selected Sentry because existing code imports Sentry."
- "Infra owner approved uploading env vars."
- "Agent proposed a PR plan."
- "User rejected creating a new Linear issue."

### Auditability

An Objective should always answer:

- What are we trying to do?
- What has happened?
- Why did Lightfast do that?
- Who approved or rejected each important step?
- What is blocked, and who owns the unblock?
- What external systems were touched?
- What evidence supports the current state?

### Concurrency

Multiple users, agents, webhooks, and connectors may contribute to the same
Objective. The event log serializes changes. Materialized state should resolve
stale proposals and superseded Decisions explicitly.

## Generative Objective Page

The Objective Page is the dedicated product surface for Level 2 work.

It should feel like an AI-native work item: part Linear issue, part runbook,
part approval queue, part execution log, and part agent workspace.

The spec intentionally does not freeze exact UI components. The platform should
support a generative UI model where current state can render different blocks
depending on the Objective:

- overview and current status;
- "what Lightfast understands";
- current Run;
- task graph or generated plan;
- pending Decisions;
- owner handoffs;
- blockers;
- execution history;
- evidence;
- external artifacts;
- next possible actions;
- generated forms for required responses.

Important UI contract:

- the Objective Page renders materialized state;
- generated UI blocks are presentation artifacts;
- user interactions append events;
- answered Decisions advance or unblock Runs;
- historical evidence remains inspectable;
- the UI should expose what the harness needs next and who owns it.

The UX should be refined over time through product exploration. The architecture
only requires that the UI is driven by typed Objective state and events.

## Relationship To Signal Intake And Triage

Existing agent graphs remain useful as subroutines:

- `signal-intake` can classify and link observed artifacts.
- `triage` can classify source items, rank similarity, and recommend actions.

Level 2 should not be another static DAG of LLM calls. It should be a stateful
control loop where graph outputs can create or update Objectives, Runs, Tasks,
Decisions, and Evidence.

Possible mappings:

- signal classification -> `intent.classified` or `objective.link_suggested`
- triage source classification -> `decision.recorded`
- triage action recommendation -> `decision.proposed`
- duplicate match -> `objective.linked` or `decision.requires_response`
- create-task recommendation -> `task.proposed`

## Example Flow

Intent:

```text
Integrate observability into Lightfast.
```

Target flow:

```text
objective.created
run.started
intent.classified
capabilities.bound
decision.recorded
  "The intent appears to be an engineering feature Objective."
task.proposed
  "Inspect existing observability packages and deployment setup."
action.executed
  "Repo inspection completed."
evidence.attached
  "Existing Sentry-related files found."
decision.proposed
  "Use Sentry as the observability provider candidate."
decision.requires_response
  "Need infra owner approval before uploading env vars to Vercel."
run.blocked
decision.answered
run.resumed
action.executed
  "Branch created and code integration started."
evidence.attached
  "Diff, test output, and PR link."
run.verifying
run.completed
objective.updated
```

The actual day-one system can mock or manually gate many of these steps. The
architecture remains the same.

## Target Guarantees

- Every Objective is org-scoped and inspectable by authorized members.
- Every important state change is represented by an event.
- Every state-changing action is preceded by policy and capability checks.
- Every human-required gate is represented by a Decision.
- Every system/agent choice that affects direction is recorded as a Decision or
  evidence-backed event.
- Every external provider action produces evidence.
- Materialized state can be rebuilt from the event log.
- The Objective Page renders state and appends events; it does not own truth.

## Non-Goals

- This spec does not define a complete day-one implementation plan.
- This spec does not finalize the Objective Page visual design.
- This spec does not define the full policy matrix for every action type.
- This spec does not require Objective membership before Decision ownership.
- This spec does not require full autonomy.
- This spec does not replace existing Skills, Connectors, or provider routine
  call infrastructure in one step.
- This spec does not require existing signal or triage graphs to become the
  runtime engine.

## Refinement Areas

These areas should remain open for future specs and implementation planning:

- Objective Page interaction model and visual language.
- Event schema versioning and projection architecture.
- Decision answer types and forms.
- Role/team ownership model.
- Capability registry schema.
- Policy matrix and autonomy levels.
- Migration path from current Decisions audit rows.
- Storage model for task graphs.
- Notification model for Decision owners.
- How completed Objectives become reusable org memory.
