---
description: Evaluate architecture document against query scenarios for coverage confidence
model: opus
---

# Evaluate Query Coverage

You are tasked with evaluating whether an architecture document can achieve the desired query scenarios defined in the codebase.

## CRITICAL: YOUR JOB IS TO EVALUATE COVERAGE CONFIDENCE

- You ARE evaluating if an architecture can answer specific query types
- You ARE identifying gaps where queries cannot be satisfied
- You ARE scoring confidence levels for each query scenario
- You ARE NOT implementing any changes (just evaluating)
- You ARE NOT modifying the architecture document
- Focus on concrete capability mapping between architecture components and query requirements

## Initial Setup:

When this command is invoked, respond with:
```
I'm ready to evaluate query coverage. Please provide:
1. **Architecture document**: Path to the architecture document to evaluate
2. **Query scenarios**: Path to query scenarios JSON (default: docs/examples/query-scenarios/query_scenarios.json)
3. **Focus area** (optional): Specific query intent to prioritize (e.g., "ownership", "dependency", "temporal")

I'll evaluate coverage confidence and identify gaps.
```

Then wait for the user's input.

## Steps to follow after receiving the evaluation request:

1. **Read the architecture document FIRST:**
   - Read the ENTIRE architecture document without limit/offset
   - **CRITICAL**: Read this file yourself in the main context before analysis
   - Identify all architectural components and their capabilities
   - Note data models, storage systems, and retrieval mechanisms

2. **Read the query scenarios:**
   - Read the full query scenarios JSON file
   - Parse each scenario's:
     - `id`: Unique identifier
     - `query`: Natural language query example
     - `intent`: Query type classification
     - `filters`: Required filtering capabilities
     - `expectedSignals`: Required retrieval signals (dense, graph, lexical, etc.)
     - `rationaleNeeded`: Whether evidence/reasoning is required
     - `notes`: Additional context

3. **Create evaluation plan using TodoWrite:**
   - Group queries by intent type
   - Map architectural components to query requirements
   - Identify which signals the architecture supports

4. **Evaluate each query scenario:**

   For each query, assess:

   **a) Data Model Coverage:**
   - Does the schema capture the required entities?
   - Are the relationships needed for the query modeled?
   - Is temporal data tracked if needed?

   **b) Retrieval Signal Support:**
   - `dense`: Vector embeddings for semantic search
   - `lexical`: Keyword/exact match capabilities
   - `graph`: Relationship traversal capabilities
   - `recency`: Temporal filtering and sorting
   - `importance`: Significance/priority scoring
   - `rerank`: Re-ranking capabilities (LLM or otherwise)
   - `profile`: Actor/user profile matching
   - `summaries`: Pre-computed summary access

   **c) Filter Capabilities:**
   - Source filtering (github, sentry, etc.)
   - Type filtering (pr, commit, error, etc.)
   - Temporal filtering (after, before dates)

   **d) Output Requirements:**
   - Can the system provide rationale/evidence if needed?
   - Can results be ranked appropriately?

5. **Assign confidence scores:**

   | Score | Label | Meaning |
   |-------|-------|---------|
   | 90-100% | **Full Support** | Architecture directly supports all requirements |
   | 70-89% | **High Confidence** | Minor gaps, workarounds possible |
   | 50-69% | **Medium Confidence** | Significant gaps, partial support |
   | 30-49% | **Low Confidence** | Major gaps, limited support |
   | 0-29% | **Not Supported** | Architecture cannot satisfy query |

6. **Gather metadata for the evaluation document:**
   - Filename: `docs/architecture/analysis/YYYY-MM-DD-query-coverage-{description}.md`
   - Format: `YYYY-MM-DD-query-coverage-{description}.md` where:
     - YYYY-MM-DD is today's date
     - description is a brief kebab-case description of the architecture evaluated
   - Example: `2025-12-09-query-coverage-neural-memory.md`

7. **Generate the evaluation document:**
   - Structure with YAML frontmatter followed by content:
     ```markdown
     ---
     title: "Query Coverage Evaluation: {Architecture Name}"
     description: Evaluation of architecture against query scenarios
     status: draft
     audience: engineering
     date: [Current date in YYYY-MM-DD format]
     architecture_doc: "{Path to evaluated architecture}"
     scenarios_doc: "{Path to query scenarios}"
     tags: [evaluation, query-coverage, architecture-name]
     ---

     # Query Coverage Evaluation: {Architecture Name}

     **Date**: [Current date]
     **Architecture Document**: [Path to architecture doc]
     **Query Scenarios**: [Path to scenarios JSON]

     ## Executive Summary

     **Overall Confidence Score: X%**

     | Category | Count | Percentage |
     |----------|-------|------------|
     | Full Support | X | X% |
     | High Confidence | X | X% |
     | Medium Confidence | X | X% |
     | Low Confidence | X | X% |
     | Not Supported | X | X% |

     [Brief summary of key findings]

     ## Coverage Matrix

     | ID | Query Intent | Confidence | Signal Support | Gaps |
     |----|--------------|------------|----------------|------|
     | Q001 | intent_type | X% | dense, recency | None |
     | Q002 | intent_type | X% | graph, dense | Missing: X |

     ## Signal Support Analysis

     ### Supported Signals

     | Signal | Architecture Component | Implementation |
     |--------|----------------------|----------------|
     | dense | Component name | How it's implemented |
     | recency | Component name | How it's implemented |

     ### Missing/Weak Signals

     | Signal | Required By | Gap Description |
     |--------|-------------|-----------------|
     | graph | Q002, Q003 | No graph database for traversal |

     ## Detailed Query Analysis

     ### Full Support Queries

     #### Q001: {Query Intent}
     **Query**: "{Example query}"
     **Confidence**: 95%

     **Architecture Support:**
     - Component X provides Y capability
     - Filter Z is supported via table W

     **Signal Mapping:**
     - `dense` → `embedding_content_id` in observations table
     - `recency` → `occurred_at` with descending index

     ---

     ### Partial Support Queries

     #### Q002: {Query Intent}
     **Query**: "{Example query}"
     **Confidence**: 55%

     **Architecture Support:**
     - Component X provides partial Y capability

     **Gaps Identified:**
     - Missing: Graph traversal for dependency relationships
     - Workaround: Could infer from entity co-occurrence

     **Recommendations:**
     1. Add relationship table for explicit edges
     2. Implement graph query capability

     ---

     ### Not Supported Queries

     #### Q003: {Query Intent}
     **Query**: "{Example query}"
     **Confidence**: 25%

     **Why Not Supported:**
     - Architecture lacks X capability entirely
     - No data model for Y relationships

     **Required Changes:**
     1. Add new table/component
     2. Implement new retrieval path

     ---

     ## Gap Summary

     ### Critical Gaps (Block multiple queries)

     | Gap | Affected Queries | Impact | Recommended Fix |
     |-----|-----------------|--------|-----------------|
     | No graph DB | Q002, Q003, Q015 | 3 queries | Add relationship table |

     ### Minor Gaps (Workarounds exist)

     | Gap | Affected Queries | Workaround |
     |-----|-----------------|------------|
     | No lexical index | Q006 | Use LLM filtering |

     ## Recommendations

     ### Priority 1: Address Critical Gaps
     1. [Specific recommendation]
     2. [Specific recommendation]

     ### Priority 2: Improve Partial Support
     1. [Specific recommendation]

     ### Priority 3: Enhance Full Support
     1. [Specific recommendation for optimization]

     ## Appendix: Query Scenario Reference

     [Include full query scenarios for reference]
     ```

8. **Present findings to user:**
   - Summarize overall confidence score
   - Highlight critical gaps that block multiple queries
   - Identify quick wins to improve coverage
   - Ask if they want to dive deeper into specific gaps
   - Offer to create architecture change proposals

## Important notes:

- Evaluate objectively - don't assume capabilities not explicitly described
- Consider both direct support and reasonable workarounds
- Group related gaps to identify systemic issues
- Prioritize gaps by number of affected queries
- Be specific about which architecture components map to which signals
- Reference specific schema tables, indexes, and functions by name
- Consider query latency implications (can it be fast enough?)
- **File reading**: Always read mentioned files FULLY (no limit/offset)
- **Critical ordering**: Follow the numbered steps exactly
  - ALWAYS read architecture doc first
  - ALWAYS read query scenarios second
  - ALWAYS complete evaluation before writing document
  - NEVER write the document with placeholder values

## Signal Definitions Reference:

| Signal | Description | Typical Implementation |
|--------|-------------|----------------------|
| `dense` | Semantic similarity via embeddings | Vector database (Pinecone, pgvector) |
| `lexical` | Keyword/exact match | Full-text search, trigram indexes |
| `graph` | Relationship traversal | Graph DB or relationship tables |
| `recency` | Time-based filtering/sorting | Timestamp columns with indexes |
| `importance` | Priority/significance scoring | Score columns, computed fields |
| `rerank` | Result re-ordering | LLM reranking, cross-encoders |
| `profile` | User/actor context matching | Profile tables, preference embeddings |
| `summaries` | Pre-computed summaries | Summary columns, materialized views |

## Query Intent Categories:

| Intent | Description | Key Signals |
|--------|-------------|-------------|
| `incident_search` | Find errors/incidents | dense, recency, importance |
| `ownership` | Find who owns something | graph, dense |
| `dependency` | Find what depends on what | graph |
| `decision` | Find why decisions were made | dense, importance, rerank |
| `temporal_diff` | Find what changed over time | dense, recency |
| `similar` | Find similar items | dense |
| `expertise` | Find who knows about X | graph, profile |
| `impact_analysis` | Find what was affected | graph, dense |
| `summary` | Synthesize information | summaries, dense |
