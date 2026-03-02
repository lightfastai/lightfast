---
description: Spawn a coordinated research team for complex topics requiring both codebase and external research with synthesis and review
model: sonnet
---

# Research Team

You are tasked with orchestrating a coordinated team of research agents to deeply investigate a complex topic. This command spawns 4 persistent agents that collaborate, review each other's work, and auto-loop until quality is met.

## Team Structure

```
codebase ──┐
           ├──→ architect ──→ senior-dev ──→ approve / reject
external ──┘                                     │
     ▲                                           │
     └───────── feedback loop ───────────────────┘
```

| Agent | Role | subagent_type |
|-------|------|---------------|
| `codebase` | Deep-dive into existing code: auth flows, DB schema, pipelines, patterns, gaps | `general-purpose` |
| `external` | Web research: API docs, OAuth specs, rate limits, pagination, SDKs | `general-purpose` |
| `architect` | Synthesize both outputs into a framework design document | `general-purpose` |
| `senior-dev` | Review for feasibility, gaps, consistency; approve or reject with feedback | `general-purpose` |

## Initial Setup

When this command is invoked:

1. **Check if parameters were provided:**
   - If a file path was provided (e.g., `thoughts/shared/research/some-file.md`), read it FULLY first
   - If inline text was provided, use it as the research question
   - If no parameters provided, respond with:

```
I'm ready to spin up a research team. Please provide your research question or topic.

This command coordinates 4 agents (codebase researcher, external researcher, architect, senior reviewer) that collaborate and iterate until quality is met.

You can provide:
- A research question: `/research-team How should we implement backfill for connectors?`
- A file reference: `/research-team thoughts/shared/research/some-file.md`
```

Then wait for the user's research query.

## Steps to follow after receiving the research query

### Step 1: Decompose the Research Question

Before creating the team, analyze the research question and plan what each agent should investigate.

**Route to `codebase` agent when the question involves:**
- How existing code works (auth, pipelines, DB, transformers)
- What packages/libraries exist in the monorepo
- What patterns/conventions the codebase follows
- What's missing vs what exists
- Integration points between systems
- Schema definitions, tRPC routers, Inngest workflows

**Route to `external` agent when the question involves:**
- Third-party API documentation and capabilities
- OAuth/authentication specifications
- Rate limits, quotas, pagination patterns
- SDK capabilities and limitations
- Industry best practices for the topic
- Performance benchmarks and real-world data

**Route to `architect` when both are done:**
- Synthesize codebase reality + external capabilities
- Design interfaces, contracts, patterns
- Propose file/package structure
- Address security, performance, extensibility
- Map how new work fits into existing architecture

**Route to `senior-dev` when architect is done:**
- Review for feasibility against actual codebase
- Check for over/under-engineering
- Verify consistency with existing patterns
- Identify missing edge cases or failure modes
- Either approve or send back specific items

Write a brief decomposition plan showing what each agent will investigate, then proceed.

### Step 2: Create the Team

Use `TeamCreate` to create a team:
```
team_name: "research-{topic-slug}"
description: "Research team for: {research question summary}"
```

### Step 3: Create Tasks

Create 4 tasks using `TaskCreate`:

1. **Codebase Deep Dive** - assigned to `codebase` agent
2. **External Research** - assigned to `external` agent
3. **Architecture Synthesis** - assigned to `architect` agent (blocked by tasks 1 and 2)
4. **Senior Review** - assigned to `senior-dev` agent (blocked by task 3)

Set up dependencies with `TaskUpdate`:
- Task 3 (architect) is `blockedBy` tasks 1 and 2
- Task 4 (senior-dev) is `blockedBy` task 3

### Step 4: Spawn Agents

Spawn all 4 agents using the `Task` tool with `team_name` parameter. The `codebase` and `external` agents should run in parallel. The `architect` and `senior-dev` agents should also be spawned but will wait for their dependencies.

**IMPORTANT**: Each agent prompt must include:
- The full research question
- Their specific investigation areas (from Step 1 decomposition)
- The output file path they should write to
- Instructions to message the team lead when done

#### Agent Prompts

**codebase agent prompt template:**
```
You are the codebase research agent on a research team. Your job is to deeply analyze the existing codebase to answer specific aspects of a research question.

## Research Question
{full research question}

## Your Investigation Areas
{specific areas from decomposition}

## Methodology
Follow the codebase-analyzer methodology:
- Read entry points, trace code paths, document with file:line references
- Use Grep, Glob, and Read tools extensively
- Find specific implementations, not just file names
- Document data flows, auth boundaries, schema definitions
- Focus on HOW things work, not critique

## Output
Write your findings to: `thoughts/shared/research/{date}-{topic}-codebase-deep-dive.md`

Use this document structure:
---
date: {ISO date}
researcher: codebase-agent
topic: "{research question}"
tags: [research, codebase, {relevant tags}]
status: complete
---

# Codebase Deep Dive: {topic}

## Research Question
{question}

## Summary
{2-3 paragraph overview}

## Detailed Findings

### {Area 1}
- Implementation details with file:line references
- Data flow documentation
- Schema/type definitions found

### {Area 2}
...

## Code References
- `path/to/file.ts:123` - Description
...

## Integration Points
{How components connect}

## Gaps Identified
{What doesn't exist yet that the research question implies}

When complete, message the team lead with a summary of your key findings.
```

**external agent prompt template:**
```
You are the external research agent on a research team. Your job is to research third-party APIs, documentation, specs, and best practices relevant to the research question.

## Research Question
{full research question}

## Your Investigation Areas
{specific areas from decomposition}

## Methodology
Follow the web-search-researcher methodology:
- Use mcp__exa__web_search_exa for general searches (type: "deep" for comprehensive)
- Use mcp__exa__get_code_context_exa for API/SDK documentation
- Search from multiple angles: official docs, benchmarks, case studies, limitations
- Always include source links
- Note publication dates for currency

## Output
Write your findings to: `thoughts/shared/research/{date}-{topic}-external-research.md`

Use this document structure:
---
date: {ISO date}
researcher: external-agent
topic: "{research question}"
tags: [research, web-analysis, {relevant tags}]
status: complete
confidence: high | medium | low
sources_count: {N}
---

# External Research: {topic}

## Research Question
{question}

## Executive Summary
{1-2 paragraphs}

## Key Findings

### {API/Topic 1}
**Source**: [Name](URL)
- Capabilities and limitations
- Authentication requirements
- Rate limits and quotas
- Pagination patterns

### {API/Topic 2}
...

## Trade-off Analysis
| Factor | Option A | Option B |
|--------|----------|----------|
| ... | ... | ... |

## Sources
- [Title](URL) - Organization, Date
...

## Open Questions
{What couldn't be found}

When complete, message the team lead with a summary of your key findings.
```

**architect agent prompt template:**
```
You are the architect agent on a research team. Your job is to synthesize the codebase deep dive and external research into a coherent framework design.

## Research Question
{full research question}

## Your Task
Wait for the codebase and external agents to complete their research. Then:
1. Read both research documents:
   - `thoughts/shared/research/{date}-{topic}-codebase-deep-dive.md`
   - `thoughts/shared/research/{date}-{topic}-external-research.md`
2. Synthesize findings into an architecture design

## Methodology
- Map external capabilities onto existing codebase patterns
- Design interfaces and contracts that fit existing conventions
- Propose file/package structure following monorepo conventions
- Address security boundaries (tRPC auth, Clerk, etc.)
- Consider performance, extensibility, and error handling
- Reference specific existing code that new work builds on

## Output
Write your synthesis to: `thoughts/shared/research/{date}-{topic}-architecture-design.md`

Use this document structure:
---
date: {ISO date}
researcher: architect-agent
topic: "{research question}"
tags: [research, architecture, {relevant tags}]
status: complete
based_on:
  - {date}-{topic}-codebase-deep-dive.md
  - {date}-{topic}-external-research.md
---

# Architecture Design: {topic}

## Research Question
{question}

## Executive Summary
{How the research informs the design}

## Existing Foundation
{What we're building on from codebase deep dive}

## External Capabilities
{Key findings from external research that shape the design}

## Proposed Design

### Overview
{High-level architecture}

### Interfaces & Contracts
{TypeScript interfaces, API contracts}

### File/Package Structure
{Where new code should live}

### Data Flow
{How data moves through the system}

### Security Considerations
{Auth boundaries, access control}

### Error Handling
{Failure modes, retry logic, fallbacks}

## Integration with Existing Systems
{How this connects to what already exists}

## Open Questions
{Design decisions that need user input}

When complete, message the team lead with a summary of your architecture design.
```

**senior-dev agent prompt template:**
```
You are the senior developer reviewer on a research team. Your job is to critically review the architect's design for feasibility, gaps, and consistency with the existing codebase.

## Research Question
{full research question}

## Your Task
Wait for the architect to complete their synthesis. Then:
1. Read ALL three research documents:
   - `thoughts/shared/research/{date}-{topic}-codebase-deep-dive.md`
   - `thoughts/shared/research/{date}-{topic}-external-research.md`
   - `thoughts/shared/research/{date}-{topic}-architecture-design.md`
2. Review the architecture design critically

## Review Checklist
- [ ] Is the design feasible given the actual codebase state?
- [ ] Does it follow existing patterns and conventions?
- [ ] Are there over-engineered or under-engineered components?
- [ ] Are all edge cases and failure modes addressed?
- [ ] Is the security model consistent with existing auth boundaries?
- [ ] Are external API limitations properly accounted for?
- [ ] Is the proposed file/package structure consistent with monorepo conventions?
- [ ] Are there missing integration points?
- [ ] Is the scope appropriate (not too broad, not too narrow)?

## Decision

After review, you MUST make one of two decisions:

### APPROVE
If the design is solid, message the team lead with:
```
APPROVED

Summary: {1-2 sentence summary of why the design is sound}

Strengths:
- {strength 1}
- {strength 2}

Minor notes (non-blocking):
- {optional minor observations}
```

### NEEDS WORK
If there are significant issues, message the team lead with:
```
NEEDS WORK

Issues found:
1. {issue} → Assign to: {codebase|external|architect} — {what to investigate/fix}
2. {issue} → Assign to: {codebase|external|architect} — {what to investigate/fix}

Specific feedback for each agent:
- codebase: {items to re-investigate, or "no additional work needed"}
- external: {items to re-research, or "no additional work needed"}
- architect: {items to revise in the design}
```

If writing a NEEDS WORK response, also write a review document to:
`thoughts/shared/research/{date}-{topic}-review.md`

When complete, message the team lead with your decision.
```

### Step 5: Coordinate the Pipeline

As team lead, you coordinate the flow:

1. **Wait for `codebase` and `external` agents** to both complete (they run in parallel)
2. **Notify `architect`** that both research docs are ready — send a message with the file paths
3. **Wait for `architect`** to complete the synthesis
4. **Notify `senior-dev`** that the architecture doc is ready — send a message with all file paths
5. **Wait for `senior-dev`** to deliver their verdict

### Step 6: Handle the Review Decision

#### If APPROVED:
1. Send shutdown requests to all 4 agents
2. Wait for shutdown confirmations
3. Delete the team with `TeamDelete`
4. Present the final research documents to the user:
   - List all document paths
   - Provide a brief summary of findings
   - Suggest running `/create_plan` with the architecture document as input

#### If NEEDS WORK (Auto-Loop Protocol):
1. Parse the senior dev's feedback to identify items for each agent
2. Message each agent that has work items with their specific feedback:
   - `codebase` agent: specific areas to re-investigate
   - `external` agent: specific items to re-research
   - `architect` agent: specific items to revise (after codebase/external updates)
3. Wait for updated agents to complete
4. Message `architect` to re-read updated docs and revise synthesis
5. Wait for architect to complete
6. Message `senior-dev` to re-review the updated architecture
7. Wait for senior dev's new verdict
8. Repeat if NEEDS WORK again

**CRITICAL: Maximum 3 iterations.** After 3 rounds, present findings as-is with open questions noted. When hitting the limit:
1. Shutdown all agents
2. Delete the team
3. Present all documents to the user
4. Note which items remained unresolved after 3 iterations

### Step 7: Final Presentation

After the team completes (approved or max iterations):

```
## Research Complete

### Documents Generated
- `thoughts/shared/research/{date}-{topic}-codebase-deep-dive.md` — Codebase analysis
- `thoughts/shared/research/{date}-{topic}-external-research.md` — External research
- `thoughts/shared/research/{date}-{topic}-architecture-design.md` — Architecture synthesis
{if review doc exists:}
- `thoughts/shared/research/{date}-{topic}-review.md` — Senior review feedback

### Summary
{2-3 sentence overview of the research findings and design}

### Key Design Decisions
{Bullet points of the most important architectural choices}

### Open Questions
{Any unresolved items}

### Suggested Next Step
Run `/create_plan {architecture-doc-path}` to turn this research into an implementation plan.
```

## Output Documents

All written to `thoughts/shared/research/` following existing naming conventions:
```
YYYY-MM-DD-{topic}-codebase-deep-dive.md   # codebase agent
YYYY-MM-DD-{topic}-external-research.md     # external agent
YYYY-MM-DD-{topic}-architecture-design.md   # architect agent
YYYY-MM-DD-{topic}-review.md                # senior-dev (only if feedback given)
```

Where:
- `YYYY-MM-DD` is today's date
- `{topic}` is a brief kebab-case description of the research topic

## Important Notes

- **All agents use `general-purpose` subagent_type** since they all need Write access for research documents
- **Always spawn codebase and external agents in parallel** for efficiency
- **The architect and senior-dev agents are spawned at the start** but told to wait for their dependencies — they receive messages from the team lead when inputs are ready
- **Track iteration count** — never exceed 3 review loops
- **If a user cancels mid-way**: send shutdown requests to all agents, wait for confirmations, then TeamDelete
- **Date format**: Use the current date for all document filenames
- **Team naming**: Use `research-{topic-slug}` where topic-slug is 2-4 words max in kebab-case
- **Message coordination**: Always use SendMessage to coordinate between agents — agents cannot see each other's output directly
- **Task tracking**: Use TaskUpdate to mark tasks as in_progress when agents start and completed when they finish
