---
description: Analyze internal architecture against external research to identify changes
model: opus
---

# Analyze Architecture

You are tasked with analyzing the internal codebase architecture against external research findings to identify specific architectural changes needed.

## CRITICAL: YOUR JOB IS TO IDENTIFY CONCRETE ARCHITECTURAL CHANGES

- You ARE identifying gaps, improvements, and architectural changes needed
- You ARE comparing our current implementation to external best practices
- You ARE proposing specific changes with implementation details
- You ARE NOT implementing the changes (just planning them)
- You ARE NOT documenting the codebase as-is (use /research-codebase for that)
- Focus on actionable recommendations with file paths and code patterns

## Initial Setup:

When this command is invoked, respond with:
```
I'm ready to analyze the architecture. Please provide:
1. **Architecture docs to analyze**: Path to our internal architecture documentation
2. **External research**: Path to external research/analysis to compare against
3. **Focus area** (optional): Specific aspect to prioritize (e.g., "retrieval", "ingestion", "embeddings")

I'll identify gaps and propose concrete architectural changes.
```

Then wait for the user's input.

## Steps to follow after receiving the analysis request:

1. **Read the internal architecture documentation FIRST:**
   - Read ALL files in the specified architecture directory
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: Read these files yourself in the main context before spawning sub-tasks
   - Build a mental model of the current architecture

2. **Read the external research/analysis:**
   - Read the full external research document
   - Identify key patterns, concepts, and architectural innovations
   - Note specific implementation details that could apply

3. **Create analysis plan using TodoWrite:**
   - Break down the comparison into specific areas
   - Map external concepts to internal architecture components
   - Identify what sub-agents to spawn for detailed analysis

4. **Spawn parallel sub-agent tasks for deep analysis:**

   **For gap analysis:**
   - Use the **codebase-analyzer** agent to understand HOW our current implementation works
   - Use the **codebase-pattern-finder** agent to find similar patterns already in use
   - Use the **codebase-locator** agent to find WHERE changes would need to be made

   **Agent prompts should include:**
   - The specific external concept being evaluated
   - Questions about our current implementation
   - Request for file:line references

   **Example agent prompt:**
   ```
   Analyze how our retrieval system currently implements relevance filtering.

   External reference: HMLR uses a "2-Key Retrieval" pattern where:
   - Key 1: Vector search returns broad candidates (20+)
   - Key 2: LLM validates relevance of each candidate

   Questions to answer:
   1. Do we have any LLM-based filtering after vector search?
   2. What is our current flow from vector search to final results?
   3. Where in the code would Key 2 filtering be added?

   Return specific file paths and line numbers.
   ```

5. **Wait for all sub-agents to complete and synthesize:**
   - IMPORTANT: Wait for ALL sub-agent tasks to complete before proceeding
   - Compile findings into a gap analysis matrix
   - Prioritize changes by impact and complexity

6. **Gather metadata for the analysis document:**
   - Filename: `docs/architecture/analysis/YYYY-MM-DD-{description}.md`
   - Format: `YYYY-MM-DD-{description}.md` where:
     - YYYY-MM-DD is today's date
     - description is a brief kebab-case description
   - Example: `2025-12-09-hmlr-retrieval-gaps.md`

7. **Generate the analysis document:**
   - Structure with YAML frontmatter followed by content:
     ```markdown
     ---
     title: "Architecture Analysis: {Topic}"
     description: Gap analysis comparing internal architecture to {external source}
     status: draft
     audience: engineering
     date: [Current date in YYYY-MM-DD format]
     external_source: "{Link or reference to external research}"
     tags: [architecture, analysis, relevant-component-names]
     ---

     # Architecture Analysis: {Topic}

     **Date**: [Current date]
     **External Source**: [Reference to compared research]
     **Focus Area**: [Specific focus if provided]

     ## Executive Summary
     [High-level overview of key gaps and recommended changes]

     ## Gap Analysis Matrix

     | External Concept | Our Current State | Gap | Priority | Complexity |
     |-----------------|-------------------|-----|----------|------------|
     | Concept 1 | How we do it now | What's missing | High/Med/Low | High/Med/Low |

     ## Detailed Analysis

     ### Gap 1: {Concept Name}

     **External Pattern:**
     [Description of the external pattern with code examples if available]

     **Our Current Implementation:**
     - `path/to/file.ts:123` - Current approach
     - How it works today

     **Proposed Change:**
     ```typescript
     // Proposed implementation pattern
     ```

     **Files to Modify:**
     - `path/to/file1.ts` - Add X
     - `path/to/file2.ts` - Modify Y

     **Implementation Steps:**
     1. Step one
     2. Step two

     **Considerations:**
     - Trade-offs
     - Dependencies
     - Migration concerns

     ### Gap 2: {Next Concept}
     ...

     ## Implementation Roadmap

     ### Phase 1: Quick Wins (Low complexity, High impact)
     - [ ] Change 1
     - [ ] Change 2

     ### Phase 2: Core Changes (Medium complexity)
     - [ ] Change 3
     - [ ] Change 4

     ### Phase 3: Architectural Shifts (High complexity)
     - [ ] Change 5

     ## Dependencies & Risks
     [Dependencies between changes, risks to consider]

     ## References
     - [Link to external research]
     - [Links to relevant internal docs]
     ```

8. **Present findings to user:**
   - Summarize the most impactful gaps
   - Highlight quick wins
   - Ask if they want to dive deeper into any specific gap
   - Offer to create Linear tickets for implementation

## Important notes:

- Always use parallel Task agents to maximize efficiency
- Focus on ACTIONABLE changes with specific file paths
- Include code examples where helpful
- Prioritize by impact AND complexity
- Consider migration/backwards compatibility
- This is analysis, not implementation - stop at the plan
- Be specific about WHERE changes go (file:line references)
- Include TypeScript/code patterns that match our codebase style
- Reference specific functions, interfaces, and types by name
- **File reading**: Always read mentioned files FULLY (no limit/offset) before spawning sub-tasks
- **Critical ordering**: Follow the numbered steps exactly
  - ALWAYS read architecture docs first before spawning sub-tasks
  - ALWAYS wait for all sub-agents to complete before synthesizing
  - ALWAYS gather metadata before writing the document
  - NEVER write the document with placeholder values

## Common Analysis Patterns:

### For Retrieval Architecture:
- Compare vector search strategies
- Analyze reranking approaches
- Evaluate hybrid search implementations
- Check for LLM-based filtering

### For Ingestion Architecture:
- Compare chunking strategies
- Analyze parallel processing patterns
- Evaluate significance/importance scoring
- Check for topic segmentation

### For Memory Architecture:
- Compare temporal organization
- Analyze state management patterns
- Evaluate summary/synthesis approaches
- Check for fact extraction patterns
