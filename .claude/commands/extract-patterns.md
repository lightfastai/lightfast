---
description: Extract relevant architecture patterns from external research for Lightfast's search-driven model
model: opus
---

# Extract Patterns for Lightfast

You are tasked with extracting architecturally relevant patterns from external codebase research and adapting them for Lightfast's **search-driven** (not chat-driven) architecture.

## CRITICAL: UNDERSTAND THE ARCHITECTURAL DIFFERENCE

**External systems (like HMLR)** are often:
- Chat/conversation-driven (stateful, multi-turn)
- Session-aware (context builds over turns)
- Memory-focused (long-term state persistence)

**Lightfast** is:
- Search-driven (stateless, single-query)
- Request-isolated (each search is independent)
- Index-focused (pre-computed knowledge, fast retrieval)

Your job is to **translate** patterns from conversational architectures into search-appropriate equivalents.

## Initial Setup:

When this command is invoked, respond with:
```
I'm ready to extract patterns for Lightfast. Please provide:
1. **External research file**: Path to the analysis (e.g., `.claude/research/hmlr-analysis.md`)
2. **Focus area** (optional): Specific pattern category to prioritize (e.g., "retrieval", "chunking", "filtering")

I'll analyze the external architecture and extract patterns suitable for Lightfast's stateless search model.
```

Then wait for the user's input.

## Steps to follow after receiving the extraction request:

### Step 1: Read the external research FULLY

- Read the ENTIRE external research file without limit/offset
- **CRITICAL**: Read this yourself in the main context before spawning sub-tasks
- Identify ALL architectural patterns, concepts, and techniques mentioned
- Note which patterns are inherently stateful vs stateless

### Step 2: Categorize patterns by adaptability

Create a mental model using this framework:

| Category | Description | Lightfast Fit |
|----------|-------------|---------------|
| **Direct Apply** | Pattern works as-is for search | High |
| **Adapt** | Pattern needs modification for stateless context | Medium |
| **Inspire** | Core concept valuable, implementation differs entirely | Low |
| **Skip** | Pattern fundamentally requires statefulness | None |

### Step 3: Create extraction plan using TodoWrite

Break down extraction into:
- Patterns to analyze from external research
- Lightfast components to investigate for integration points
- Sub-agent tasks needed

### Step 4: Spawn parallel sub-agents for Lightfast context

**CRITICAL**: Agents research the LOCAL Lightfast codebase (not external repo).

**Agent 1: codebase-locator**
```
Find all search and retrieval related code in Lightfast.

Look for:
- Search API implementations
- Retrieval/query processing
- Chunking and indexing logic
- Reranking or filtering
- Vector search implementations

Return organized file paths grouped by function.
```

**Agent 2: codebase-analyzer**
```
Analyze Lightfast's current search architecture.

Focus on:
- How queries are processed (entry → result)
- Current retrieval strategies
- Chunking approach for documents
- Any post-retrieval filtering/reranking
- Response assembly patterns

Include file:line references for all claims.
```

**Agent 3: codebase-pattern-finder**
```
Find existing patterns in Lightfast that relate to:
- Parallel processing / async operations
- Document/chunk identification schemes
- Metadata extraction and storage
- Search result ranking/scoring
- API response structures

Show actual code snippets with file:line references.
```

### Step 5: Wait for all sub-agents and synthesize

**IMPORTANT**: Wait for ALL sub-agents to complete before proceeding.

Map external patterns to Lightfast integration points.

### Step 6: Gather metadata for the extraction document

- Filename: `docs/architecture/analysis/YYYY-MM-DD-{source}-patterns.md`
- Example: `2025-12-09-hmlr-patterns.md`

### Step 7: Generate the extraction document

Structure with YAML frontmatter:

```markdown
---
title: "Pattern Extraction: {Source Name}"
description: Architecture patterns adapted from {source} for Lightfast search
status: draft
audience: engineering
date: [Current date in YYYY-MM-DD format]
external_source: "{Link or reference to external research}"
tags: [architecture, patterns, retrieval, search]
---

# Pattern Extraction: {Source Name}

**Date**: [Current date]
**External Source**: [Reference to analyzed research]
**Focus Area**: [Specific focus if provided]

## Executive Summary

[2-3 sentences: What patterns were extracted and their potential value]

## Architectural Translation

### Source Architecture: {External System}
- **Model**: [Chat-driven / Conversation-based / etc.]
- **State**: [Stateful across sessions / etc.]
- **Key Innovation**: [What makes it special]

### Target Architecture: Lightfast
- **Model**: Search-driven (stateless)
- **State**: Request-isolated (no cross-query state)
- **Constraint**: Each search independent, sub-second latency

## Pattern Extraction Matrix

| External Pattern | Category | Lightfast Adaptation | Priority |
|-----------------|----------|---------------------|----------|
| Pattern 1 | Direct/Adapt/Inspire | How it translates | High/Med/Low |
| Pattern 2 | ... | ... | ... |

## Extracted Patterns

### Pattern 1: {Name}

**Source Context:**
[How the external system uses this pattern]
```language
// Code from external research showing the pattern
```

**Lightfast Translation:**

*Why it applies:*
[Explanation of relevance to search-driven model]

*Adaptation required:*
[What changes for stateless context]

*Integration point:*
- `path/to/lightfast/file.ts:123` - Where this would integrate
- Current approach: [What Lightfast does now]
- Proposed approach: [How pattern would work]

*Example transformation:*
```typescript
// Before (chat-driven pattern)
async function processWithContext(query: string, sessionHistory: Message[]) {
  const context = buildContext(sessionHistory);
  return await retrieve(query, context);
}

// After (search-driven adaptation)
async function processSearch(query: string, workspaceId: string) {
  // No session history - query-time context only
  const context = await buildQueryContext(query, workspaceId);
  return await retrieve(query, context);
}
```

*Considerations:*
- Trade-offs in stateless context
- Performance implications
- What's lost vs gained

### Pattern 2: {Name}
...

## Patterns NOT Applicable

| Pattern | Reason | Alternative |
|---------|--------|-------------|
| Session memory | Requires multi-turn state | Pre-computed workspace context |
| Topic tracking | Assumes conversation flow | Query intent classification |

## Implementation Recommendations

### Quick Wins (Direct Apply)
- [ ] Pattern A - Can integrate immediately
- [ ] Pattern B - Minimal changes needed

### Medium Effort (Adapt)
- [ ] Pattern C - Requires modification for stateless
- [ ] Pattern D - Core concept applies, new implementation

### Research Needed (Inspire)
- [ ] Pattern E - Interesting concept, needs design work

## Integration Points in Lightfast

| Component | File | Relevant Patterns |
|-----------|------|-------------------|
| Search API | `path/to/search.ts` | Pattern 1, 3 |
| Retrieval | `path/to/retrieval.ts` | Pattern 2 |

## Key Insights

[Bullet points of the most valuable learnings for Lightfast's search model]

## References
- [Link to external research file]
- [Links to relevant Lightfast architecture docs]
```

### Step 8: Present findings to user

- Summarize the most valuable patterns for search-driven architecture
- Highlight quick wins that could be integrated immediately
- Note patterns that require more design work
- Ask if they want to dive deeper into any specific pattern
- Offer to create implementation tickets

## Translation Guidelines

### Chat → Search Translations

| Chat Pattern | Search Equivalent |
|--------------|-------------------|
| Session context | Query-time context enrichment |
| Conversation history | Workspace document index |
| Memory retrieval | Pre-computed knowledge graph |
| Topic continuity | Query intent classification |
| User profile updates | Workspace metadata |
| Turn-by-turn processing | Single-pass query processing |
| Sliding window | Fixed retrieval budget (topK) |
| Context accumulation | Document expansion |

### What Transfers Well

1. **Retrieval strategies** (vector search, hybrid search, reranking)
2. **Chunking approaches** (hierarchical, semantic)
3. **Filtering/gating patterns** (LLM validation, relevance scoring)
4. **Parallel execution** (concurrent operations)
5. **Structured extraction** (entity extraction, metadata)
6. **ID schemes** (immutable identifiers, lineage tracking)

### What Needs Adaptation

1. **State management** → Pre-computed indexes
2. **Session awareness** → Workspace context
3. **Memory persistence** → Document storage
4. **Topic detection** → Query classification
5. **Context windows** → Token budgets per query

### What Doesn't Transfer

1. Multi-turn reasoning (single query only)
2. Progressive context building
3. User affect/mood tracking
4. Open loop tracking
5. Conversation flow management

## Important Notes

- **Always read external research FULLY** before spawning sub-tasks
- **Focus on actionable patterns** - skip philosophical observations
- **Include code examples** showing before/after translations
- **Reference specific Lightfast files** for integration points
- **Prioritize by impact** - what gives the most search quality improvement
- **Be realistic** about what transfers to stateless architecture
- **Document trade-offs** - what's lost when adapting patterns
- **Critical ordering**: Follow the numbered steps exactly
  - ALWAYS read research file first before spawning sub-tasks
  - ALWAYS wait for all sub-agents to complete before synthesizing
  - ALWAYS gather metadata before writing the document
  - NEVER write the document with placeholder values
