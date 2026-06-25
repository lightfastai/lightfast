# Level 2 Harness Architecture - Design

Date: 2026-06-07
Status: Draft architecture
Area: Lightfast OS, Objectives, Runs, Decisions, agent harness, B2B collaboration

## Summary

Lightfast's Level 1 Harness Scaffold gives agents the basic substrate they need:
skills, connectors, and a ledger of external provider calls. Level 2 should add
the intelligence harness above that substrate.

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
implementation plan and does not freeze the final Mission Control UI.

## Context

Current scaffolded primitives:

- Skills: indexed agent-skill markdown, present but not yet a runtime capability
  source for product agents.
- Connectors: external integrations such as Linear and X, with MCP-backed
  runtime tools and provider routine call records.
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
- Users join team workspaces. Mission Control is the adaptive workspace home;
  Objectives are the durable work homes.
- Personas affect prioritization and presentation, not authorization.
- Agents may propose transitions, but typed state, policy, capability checks,
  and Decisions govern what advances.
- The source of truth is an append-only event log with materialized current
  state for fast reads and UI rendering.
- Mission Control surfaces are generated state surfaces. They express current
  state, but they do not invent or own truth.
- Day-one scaffolding can be simple, but the architecture should allow
  Objectives to span days or weeks, multiple Runs, multiple branches, multiple
  PRs, deployments, post-merge verification, and follow-up work.

## Level 1 To Level 2 Mapping

| Level 1 primitive | Current role | Level 2 role |
| --- | --- | --- |
| Skills | Indexed instructions and resources | Capability instructions bound to Runs when relevant |
| Connectors | External read/write integration tools | Capability providers for actions and evidence |
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
execute safe actions, call connectors, edit code, create branches, open PRs,
verify work, or pause on blockers. An Objective can have many Runs over time.

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
handoffs, external setup, or follow-up actions. Objective Mission Control may
render them as a timeline, checklist, generated card, grouped section, or not at
all, depending on the current Objective state.

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
- command log;
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
- repository access;
- provider routines;
- connector credentials;
- org policies;
- selected agent/runtime profiles.

Bindings are important for auditability. A future reviewer should be able to
answer: "What did Lightfast believe it could do when it made this choice?"

### Action

An Action is an attempted state-changing or read operation performed by the
harness.

Examples:

- run a local command;
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

### User Persona

A User Persona is an explicit onboarding choice that shapes Mission Control and
Objective presentation.

Personas are not permission roles. Permissions answer "what is this user allowed
to do?" Persona answers "what should Lightfast put in front of this user first?"

Representative personas:

- founder or operator;
- engineering lead;
- engineer;
- product lead;
- marketing lead;
- support or success;
- admin or ops;
- generalist or small-team member.

The persona taxonomy should stay small until real user conversations show more
specific needs. Users should be able to adjust persona later.

### Team Context

Team Context is the lightweight collaboration model the Objective runtime can
read when deciding how to ask for help or route attention.

It can include:

- workspace member count;
- selected user personas;
- connected capabilities;
- users who connected or recently used a capability;
- explicit roles or policies when present;
- prior Decision responders;
- common unblockers for similar Objectives;
- workspace preference for open versus assigned Decisions;
- whether the team appears small and informal or structured and policy-heavy.

Team Context lets the harness adapt without forcing every team to configure a
full org chart on day one.

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
attention.projected
persona.selected
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
- persona-aware attention surfaces.

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
9. Render Objective Mission Control
10. Repeat
```

### 1. Observe

The harness receives input from:

- user messages;
- Objective Mission Control interactions;
- Decision answers;
- connector events;
- source control events;
- PR and deployment updates;
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

### 9. Render Objective Mission Control

Objective Mission Control renders the current projection into dynamic UI blocks:

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
- `repo_access`
- `source_control`
- `deployment_provider`
- `secret_store`
- `agent_runtime`
- `policy`

Capability Binding should happen per Run. This avoids mutable global capability
state becoming invisible in historical audit trails.

## Execution Layer

The Execution Layer performs actions after policy and capability checks.

Execution should support:

- dry-run or proposal-only transitions;
- supervised execution with Decision gates;
- connector and provider routine calls;
- command execution through agent runtimes;
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

The core collaboration posture should start lightweight:

- everyone with workspace access can see the Objective;
- the harness makes the next useful team action obvious;
- Decisions can begin open to the workspace;
- users can claim, answer, assign, or delegate Decisions;
- larger teams can add role, team, and policy structure over time.

### Org Visibility

Objectives belong to an org/workspace. Authorized members can inspect current
state, pending Decisions, evidence, external artifacts, and history.

Day one does not require explicit Objective membership. Collaboration can center
on Decision ownership.

### Decision Ownership

Decisions can be routed to:

- open workspace attention;
- user;
- team;
- role;
- unresolved owner label.

The harness can continue when Decisions are answered and should supersede stale
Decisions when Objective state changes.

### Progressive Collaboration Model

The collaboration model should support increasing structure without making small
teams feel heavy.

1. Open Decisions

   A Decision is visible to the workspace and anyone with access can answer or
   claim it.

2. Lightweight Assignment

   A Decision is assigned to a person. Assignment is a prioritization and
   accountability nudge, not automatically a hard permission boundary.

3. Role Or Team Routing

   A Decision targets a role or team, such as `infra_owner`, `admin`, `product`,
   or "someone with Vercel access."

4. Policy-Governed Approval

   A Decision can require a specific role, permission, or capability before the
   Objective can advance.

The same Objective may use different collaboration modes for different
Decisions.

### Collaboration Modes

The runtime can choose a collaboration mode per Decision based on Team Context,
policy, and current Objective state:

- `open`: anyone with workspace access can unblock;
- `suggested_owner`: the harness suggests a person or role;
- `assigned`: the Decision is assigned to a specific owner target;
- `policy_required`: policy requires a specific role, permission, or capability;
- `broadcast`: the team should be aware, but no single owner exists yet.

These modes are presentation and routing hints unless policy says otherwise.

### Team-Aware Runtime Behavior

The Objective runtime should adapt how it asks for help based on Team Context.

For a tiny team, it might say:

> "I need someone to confirm whether Sentry is the right provider."

For a slightly structured team, it might say:

> "This likely needs someone with Vercel access."

For a larger org, it might say:

> "Env upload requires `infra_owner` approval."

For a known pattern, it might say:

> "Assigning this to Maya because she approved the last two Vercel env
> Decisions."

This behavior should be driven by explicit state and evidence where possible,
not only by prompt intuition.

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

## Workspace And Mission Control Surfaces

Users join team workspaces, similar to a Slack workspace mental model. The
workspace is the container for Objectives, Decisions, capabilities, activity,
and team context.

The primary platform surfaces are:

- Workspace Mission Control;
- Objective Mission Control;
- Objective creation flow;
- Objectives Index;
- Capabilities;
- Activity and audit lenses.

### Workspace Mission Control

Workspace Mission Control is the adaptive home inside a workspace. It is the
attention layer over org Objectives.

It answers:

- What needs my attention?
- Where am I blocking progress?
- What changed since I last checked?
- What did agents do while I was away?
- What can I claim, answer, approve, reject, or delegate?
- Which Objectives are blocked, stale, risky, or waiting on someone?

Mission Control should be persona-aware. A founder, marketing lead, engineer,
and admin may all see the same underlying Objective state, but the page should
prioritize different sections and language for each user.

Mission Control may include:

- Decisions assigned to the current user;
- Decisions open to the workspace;
- blocked Objectives;
- stale Objectives;
- recent agent activity;
- active Objectives relevant to the user's persona;
- capability gaps blocking work;
- suggested setup actions;
- team-wide risks or momentum summaries.

The exact ranking can evolve. The stable contract is that Mission Control
presents attention-worthy state from the event log and materialized projections.

### Objective Mission Control

Objective Mission Control is the durable page for one Objective. It is the
context and execution layer for a specific piece of work.

It answers:

- What are we trying to accomplish?
- What has Lightfast understood?
- What Run is active?
- What Decisions or blockers exist?
- What evidence and artifacts exist?
- What happens next for this Objective?

Objective Mission Control should be organized around the Objective as a whole,
with the current Run prominent inside it. This keeps room for multi-run
Objectives without making later Runs feel bolted on.

### Objective Creation Flow

Objective creation should be a separate surface, reachable from the workspace
navigation or global workspace actions.

Initial flow:

```text
Workspace Mission Control
-> New Objective
-> describe intent
-> Objective created
-> initial Run starts
-> Objective Mission Control
```

The first creation flow can be simple: describe the intent and let Lightfast
create the Objective plus initial Run. Later versions may add templates, imported
signals, external artifacts, or "start from Linear/GitHub/Sentry."

### Objectives Index

The Objectives Index is inventory: searchable, filterable durable work across
the workspace. It is important, but it is not the primary emotional center of
the product.

It should answer:

- What Objectives exist?
- Which are active, blocked, waiting, verifying, completed, or superseded?
- Which area, owner, capability, or external artifact are they linked to?
- Which Objectives should I inspect in detail?

### Capabilities

Capability surfaces include connectors, skills, developer access, policies, and
setup state. They are supporting surfaces unless a capability gap is blocking
work.

When a capability gap blocks an Objective, it should appear both in the relevant
Capability surface and as a Decision or blocker in Mission Control and Objective
Mission Control.

### Activity And Audit

Activity and audit can exist as dedicated lenses, but most activity should also
appear contextually inside Mission Control and Objective Mission Control.

Activity answers:

- What happened recently?
- Which agents, users, connectors, policies, or webhooks caused changes?
- What external systems were touched?
- What evidence was attached?

## Attention Model

Mission Control depends on an Attention Model: a projection that decides which
events, Decisions, Objectives, blockers, and capability gaps deserve a user's or
team's attention.

Attention-worthy items may include:

- Decisions assigned to the current user;
- open Decisions anyone can answer;
- policy-required approvals;
- blocked Runs;
- stale Objectives;
- failed actions;
- failed or disconnected capabilities;
- agent activity since the user last checked;
- Objectives relevant to the user's persona;
- risky or customer-impacting work;
- external artifacts awaiting review;
- setup actions that would unlock active Objectives.

The Attention Model should separate data from presentation:

- Attention data: the ranked, scoped items that matter.
- Mission Control presentation: the generated or structured view tailored to the
  user's persona and workspace state.

This keeps Mission Control adaptive without making its UI the source of truth.

## Generative UI Contract

Lightfast should support generative UI for Mission Control and Objective Mission
Control. The stable part is the state contract; the flexible part is how the UI
presents that state.

### Objective Mission Control

Objective Mission Control should feel like an AI-native work item: part Linear
issue, part runbook, part approval queue, part execution log, and part agent
workspace.

The spec intentionally does not freeze exact UI components. The platform should
support a generative UI model where current Objective state can render different
blocks depending on the Objective:

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

### Workspace Mission Control

Workspace Mission Control should feel like an adaptive attention surface for a
person inside a team workspace.

Possible generated or structured blocks:

- "needs you";
- open team Decisions;
- blocked Objectives;
- recent agent activity;
- relevant active Objectives;
- capability gaps;
- suggested next actions;
- team momentum or risk summary;
- onboarding/setup actions for new workspaces.

### Stable UI Contract

Important UI contract:

- Mission Control and Objective Mission Control render materialized state;
- generated UI blocks are presentation artifacts;
- user interactions append events;
- answered Decisions advance or unblock Runs;
- historical evidence remains inspectable;
- the UI should expose what the harness needs next and who owns it;
- persona changes can alter ranking and presentation without changing
  permissions;
- capability gaps should appear where they block work, not only on setup pages.

The UX should be refined over time through product exploration. The architecture
only requires that the UI is driven by typed workspace, Objective, Decision, and
event state.

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
- Every workspace user can have a persona that affects presentation and
  prioritization without changing permissions.
- Workspace Mission Control presents attention-worthy Objective, Decision,
  blocker, activity, and capability state for the current user/workspace.
- Objective Mission Control presents the full context and execution state for a
  single Objective.
- Every important state change is represented by an event.
- Every state-changing action is preceded by policy and capability checks.
- Every human-required gate is represented by a Decision.
- Every system/agent choice that affects direction is recorded as a Decision or
  evidence-backed event.
- Every external provider action produces evidence.
- Materialized state can be rebuilt from the event log.
- Mission Control surfaces render state and append events; they do not own
  truth.

## Non-Goals

- This spec does not define a complete day-one implementation plan.
- This spec does not finalize Workspace Mission Control or Objective Mission
  Control visual design.
- This spec does not finalize the persona taxonomy or attention ranking model.
- This spec does not define the full policy matrix for every action type.
- This spec does not require Objective membership before Decision ownership.
- This spec does not require full autonomy.
- This spec does not replace existing Skills, Connectors, or provider routine
  call infrastructure in one step.
- This spec does not require existing signal or triage graphs to become the
  runtime engine.

## Refinement Areas

These areas should remain open for future specs and implementation planning:

- Objective Mission Control interaction model and visual language.
- Workspace Mission Control interaction model and visual language.
- Persona taxonomy and onboarding copy.
- Attention Model ranking rules.
- Event schema versioning and projection architecture.
- Decision answer types and forms.
- Role/team ownership model.
- Team Context inference and edit controls.
- Capability registry schema.
- Policy matrix and autonomy levels.
- Migration path from current Decisions audit rows.
- Storage model for task graphs.
- Notification model for Decision owners.
- How completed Objectives become reusable org memory.
