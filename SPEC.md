# Lightfast Specification

Status: Draft v0 (high-level, language-agnostic)

Last Updated: 2026-04-15

Purpose: Define the operating infrastructure between agents and apps — the layer through which agents and teams observe, reason, and act across a product-development tool stack.

---

## Mission

Be the operating layer for every team — so agents and people can observe, reason, and act across the entire tool stack through a single system.

## Vision

Any agent or engineer can understand what is happening, why it happened, and what should happen next — across every tool, every team, every decision — without knowing which tools exist or how they work.

---

## 1. Problem Statement

Lightfast is an operating layer that sits between agents and apps. The layer ingests events from connected tools, stores them as a cited temporal graph, resolves intent into action against the correct tool, and enforces team-defined invariants continuously.

The layer addresses four operational problems:

- Tool memory is siloed. Events live only in the tool that produced them, so no system correlates causality, ownership, or relationships across the stack.
- Agents target tools directly. Every new agent means N×M integrations, drifting API usage, and no shared context across runs.
- Team rules are enforced by convention. Release checks, review gates, and policy rules live in documents, not in a kernel that applies them at all times.
- Answers cannot cite their source. Summaries without evidence cannot be trusted when humans or agents act on them.

Important boundary:

- Lightfast is an operating layer. It mediates between tools; it does not replace them.
- Lightfast is not a data warehouse, a BI tool, or a general-purpose observability platform.
- A successful operation ends at a cited answer or a resolved action against a connected tool, not at raw data delivery.

## 2. Goals and Non-Goals

### 2.1 Goals

- Observe every event across every connected tool automatically and continuously.
- Store events as immutable, causally ordered facts with semantic embeddings in a temporal graph.
- Cite every answer, action, and decision back to source events.
- Resolve agent intent into action against the correct connected tool without per-agent integration work.
- Enforce team-defined invariants continuously, not on a schedule.
- Expose the same primitives to agents and to people (REST API, SDK, MCP, webhooks).
- Preserve complete tenant isolation. Customer data is never used for model training.

### 2.2 Non-Goals

- Replacing existing tools in the stack. Teams keep using what they use.
- General-purpose analytics, business intelligence, or data warehousing.
- Black-box decisions. Every action traces to source events; no summary ships without verification.
- Rebuilding a unified UI for every connected tool.
- Agent orchestration as a product surface. Agents operate through Lightfast; Lightfast does not orchestrate agents.

## 3. System Overview

### 3.1 Abstraction Layers

Lightfast is a pipeline: **Observe → Remember → Reason → Act.** Each layer is a distinct concern.

1. `Observe`
   - Ingests events from connected tools via webhooks, polling, or push APIs.
   - Normalizes platform payloads into a stable event model.

2. `Remember`
   - Stores events as immutable facts with causal ordering.
   - Resolves entities across tools (commits, issues, deployments, incidents, people).
   - Maintains a temporal graph and semantic embeddings over those entities.

3. `Reason`
   - Executes skills, workflows, and rules against memory.
   - Detects patterns, predicts outcomes, and enforces invariants.
   - Produces cited answers to queries from agents and people.

4. `Act`
   - Resolves intent into write operations against the correct connected tool.
   - Performs side effects (PR comments, issue updates, messages, deploys) with provenance attached.

### 3.2 Main Components

1. `Connection Layer`
   - Manages OAuth flows, credential storage, webhook registration, and backfills per tool.
   - Further specification deferred.

2. `Event Store`
   - Append-only store of normalized events with causal ordering.
   - Further specification deferred.

3. `Graph and Embeddings`
   - Temporal graph of entities and relationships with semantic embeddings.
   - Further specification deferred.

4. `Reasoning Runtime`
   - Executes skills, workflows, and rules against memory.
   - Further specification deferred.

5. `Action Resolver`
   - Translates intent into write operations against connected tools.
   - Further specification deferred.

6. `Access Surfaces`
   - REST API, TypeScript SDK, MCP server, webhooks.
   - Further specification deferred.

### 3.3 External Dependencies

- Connected tools (for example GitHub, Linear, Sentry, Vercel). The set is extensible.
- Identity provider for tenant authentication.
- Vector index and graph storage.
- Background job runtime for ingestion and long-running workflows.

## 4. Core Domain Model

Entity field specifications are deferred to a future revision. This section lists the primary entity types and their present state.

Status tags:
- `(shipped v0.1.0)` — entity exists in the running system and is covered by the public API.
- `(partial v0.1.0)` — entity exists in limited form; the role defined here is broader than what ships.
- `(planned)` — entity is part of the designed system but has no implementation yet.

### 4.1 Entities

#### 4.1.1 Event `(shipped v0.1.0)`

An immutable fact emitted by a connected tool and normalized into the Lightfast event model. Once recorded, an event is never modified.

#### 4.1.2 Entity `(shipped v0.1.0)`

A resolved object in the temporal graph — for example a commit, issue, deployment, incident, or person — synthesized from one or more events.

#### 4.1.3 Connection `(shipped v0.1.0)`

A binding between a tenant and a connected tool, including credentials, scopes, and lifecycle state.

#### 4.1.4 Skill `(planned)`

A composable capability that reads memory and optionally invokes the Action Resolver.

#### 4.1.5 Workflow `(planned)`

An ordered composition of skills, triggered by events or schedules.

#### 4.1.6 Rule `(planned)`

A team-defined invariant continuously enforced against memory.

#### 4.1.7 Agent `(partial v0.1.0)`

A principal — human or automated — that interacts with Lightfast through an access surface. In `v0.1.0` an agent is any caller authenticated by an API key or session token; the expanded role (identity, permissions scoped per skill and rule) is planned.

## 5. Principles

- **Primitives over features.** Every capability is a configuration of the same building blocks, not a new subsystem.
- **Events are facts.** Immutable, causally ordered. Interpretations layer on top. History is never rewritten.
- **Intent over API calls.** Agents express what they want. The system resolves how.
- **Cite everything.** Every answer, every action, every decision traces back to source events.
- **Privacy by default.** Complete tenant isolation. Customer data is never used for training.

## 6. Measures

- **Coverage.** Fraction of a team's tool stack observed and connected.
- **Precision.** Accuracy of cited answers against ground-truth source events.
- **Latency.** Time from event ingestion to availability in memory, and from query to cited answer.
- **Trust.** Fraction of answers and actions with verifiable source evidence and causal rationale.
- **Adoption.** Time-to-integrate per tool and density of agent activity routed through the layer.

---

## Deferred Sections

The following sections are intentionally omitted at this draft level and will be populated in future revisions:

- Detailed field definitions for each entity in Section 4.
- Event lifecycle and state machines.
- Consistency, ordering, and idempotency guarantees.
- Authorization model and scope primitives.
- Error classes and recovery behavior.
- Observability contract (logs, metrics, traces).
- Conformance and compatibility rules.
