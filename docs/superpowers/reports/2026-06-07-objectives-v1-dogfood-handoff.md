# Objectives v1 Dogfood Handoff

Date: 2026-06-07
Status: Handoff for next build conversation
Area: Lightfast OS, Objective UI, Objective Mission Control, dogfooding

## Start Here

The current product direction is to build Objective v1 as a dogfoodable scaffold
for designing and building Objective v2.

Dogfood principle:

> Every meaningful Objective-system improvement should itself be tracked as a
> Lightfast Objective.

Objective v1 does not need full autonomy. It needs to become the place the team
naturally returns to while designing, implementing, reviewing, and improving the
Objective system.

Primary architecture spec:

- `docs/superpowers/specs/2026-06-07-level-2-harness-architecture-design.md`

Recent commits that created the spec context:

- `cb0de50c7 docs: add level 2 harness architecture spec`
- `241e87c6f docs: expand level 2 harness mission control spec`

## Product Decisions Already Made

- Start with the Objective loop, not Workspace Mission Control.
- Build Objective creation and Objective Mission Control before broad dashboards.
- Treat Workspace Mission Control as a later aggregation layer once real
  Objectives, Decisions, blockers, and activity exist.
- Use a Slack-like product frame where the sidebar contains an Objective
  switcher. In the current Paper MCP concept, this is named
  `objective-landing-dark`.
- The existing scaffold is essentially a sidebar with an Objective switcher and
  a chat-like main page. The direction is to move away from "chat is the page"
  toward "Objective Mission Control is the page."
- Chat or conversation can exist later as an input/control inside an Objective,
  but it should not be the main mental model for Objective v1.
- New Objective should be a separate flow, not a widget embedded in Workspace
  Mission Control.
- Objective v1 should support dogfooding Objective v2 work.

## First Product Loop

Build the smallest vertical loop that proves an Objective can be a durable home
for AI-carried work:

```text
Objective switcher
-> New Objective
-> Objective boot/loading state
-> Objective Mission Control
-> embedded Decisions/context/evidence update Objective state
-> return to Objective Mission Control
```

The important test:

> Does the Objective page feel like the place to coordinate and preserve the
> work, instead of a transient chat transcript?

## Page Focus

### 1. New Objective

Purpose: capture intent and create a durable Objective.

Keep this flow intentionally simple:

- one primary intent input;
- optional title derivation;
- optional context/attachment affordance later;
- primary action creates the Objective immediately.

On submit, navigate into the new Objective context immediately. Do not block the
navigation on all intelligence work finishing.

### 2. Objective Boot State

Purpose: make the system setup visible after creation.

This is not a chat loading spinner. It should feel like the OS is preparing a
workspace for the Objective.

Representative boot steps:

```text
Creating objective
Understanding intent
Starting first run
Checking available capabilities
Preparing initial plan
Looking for required decisions
```

Each step should eventually map to real events or projections. Day one may
scaffold parts of this, but the UI should point toward the event-sourced model.

The sidebar Objective switcher should already show the new Objective during this
state, likely with a planning/pending status.

### 3. Objective Mission Control

Purpose: show the durable state of one Objective.

This is the core page. It should be organized around the Objective as a whole,
with current Run state prominent inside it.

Initial sections can be simple and scaffolded:

- Objective title and status;
- "what Lightfast understands";
- current Run;
- initial plan or task graph;
- pending Decisions or blockers;
- evidence/activity;
- next action or manual "continue Objective" control.

The page should make state visible. It should not read as a chatbot with a
sidebar.

### 4. Embedded Decisions

Purpose: prove collaboration and state advancement inside an Objective before
building a separate Decision Inbox.

Initial Decision states can be minimal:

- proposed;
- requires response;
- answered;
- superseded.

Decisions can start manually or scaffold-generated. The goal is to establish the
interaction pattern:

```text
Objective needs judgment/context
-> Decision appears in Objective Mission Control
-> user answers or rejects
-> Objective state updates
-> evidence/history records the response
```

### 5. Minimal Objectives Index

Purpose: let users find created Objectives again.

Keep it basic. It is inventory, not the product center.

## Deliberately Deferred

Do not start with these unless the Objective loop forces the need:

- Workspace Mission Control;
- Decision Inbox;
- full capability setup UX;
- full Activity/Audit page;
- persona onboarding;
- team/role routing;
- notification routing;
- full policy matrix;
- external signal promotion;
- deep autonomy;
- multi-run management beyond making the data model plausible.

## Dogfood Objective

The first real internal Objective should be:

```text
Design and build Objective Mission Control v2.
```

Use Objective v1 to hold:

- the Level 2 Harness architecture spec;
- this handoff;
- the Paper MCP `objective-landing-dark` design context;
- decisions already made, such as "skip Workspace Mission Control for now";
- new UI/UX questions;
- implementation tasks;
- links to branches, commits, PRs, screenshots, and tests;
- unresolved blockers and next actions.

Recursive loop:

```text
Objective v1
-> used to coordinate Objective v2
-> Objective v2 improves creation/boot/mission-control flow
-> used to coordinate Objective v3
```

## Implementation Bias

Bias toward manual-but-durable behavior at first.

Good Objective v1 features:

- create Objective;
- switch between Objectives;
- show Objective Mission Control;
- show boot/planning state;
- add/update simple Decisions;
- add Notes/Evidence/Links;
- show status and current Run state;
- show "continue Objective" as a manual continuation control.

Avoid overbuilding:

- autonomous execution;
- complex LLM planning;
- complete event replay;
- complex permissions;
- polished dashboard aggregation.

The first build should create the pressure needed to learn the correct flow.

## Suggested Next Conversation Prompt

Use this prompt in a fresh conversation:

```text
We are starting Objective v1 dogfooding for Lightfast.

Read:
- docs/superpowers/specs/2026-06-07-level-2-harness-architecture-design.md
- docs/superpowers/reports/2026-06-07-objectives-v1-dogfood-handoff.md

Goal: build the first dogfoodable Objective UI loop:
Objective switcher -> New Objective -> Objective boot/loading state -> Objective
Mission Control -> embedded Decisions/context/evidence.

Important product direction:
- Skip Workspace Mission Control for now.
- Existing Paper MCP design `objective-landing-dark` is a dark Slack-like
  sidebar with an Objective switcher; current main page is too chat-like.
- Objective Mission Control should be the durable state home, not a chat page.
- Bias toward manual-but-durable scaffolding so Objective v1 can coordinate
  Objective v2.

Start by inspecting the existing app/design scaffold and propose the smallest
implementation plan.
```
