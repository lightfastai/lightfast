---
description: Deep web research on technical topics with analysis and performance metrics
model: opus
---

# Research Web

You are tasked with conducting deep web research on technical topics to inform architectural decisions and performance analysis. You'll gather authoritative information from external sources, analyze the data, and synthesize findings into actionable insights.

## CRITICAL: YOUR JOB IS TO ANALYZE AND INFORM DECISIONS

- Research the topic deeply using the web-search-researcher agent
- Find performance metrics, benchmarks, and real-world data
- Analyze trade-offs and implications
- Provide data-driven recommendations
- Generate a thoughts document with structured findings
- Include sources and attribution for all claims
- Focus on information that informs the user's specific question

## Initial Setup:

When this command is invoked, respond with:
```
I'm ready to conduct web research on technical topics. Please provide your research question or topic you'd like analyzed, and I'll gather authoritative sources and performance data to inform your architectural decisions.
```

Then wait for the user's research query.

## Steps to follow after receiving the research query:

1. **Understand the context:**
   - Ask clarifying questions if needed using AskUserQuestion
   - Identify what specific aspects matter (performance, cost, scalability, reliability)
   - Determine what metrics/data would be most valuable
   - Check if there's a related codebase file/design document to reference

2. **Decompose the research question:**
   - Break down into specific search angles
   - Identify key technical terms and comparisons
   - Determine what sources would be authoritative (official docs, benchmarks, case studies)
   - Plan multiple search strategies (performance benchmarks, use cases, limitations, alternatives)

3. **Execute parallel web searches:**
   - Launch web-search-researcher agent to gather information
   - Search for:
     - Official documentation and specifications
     - Performance benchmarks and metrics
     - Real-world case studies and implementations
     - Common pitfalls and limitations
     - Cost implications and trade-offs
     - Comparative analysis with alternatives
   - Use multiple search angles to ensure comprehensive coverage
   - Request the agent return detailed findings with source links

4. **Analyze and synthesize findings:**
   - Compile all search results by topic
   - Extract key metrics and performance data
   - Identify patterns and consensus across sources
   - Note any conflicting information or version-specific details
   - Calculate implications for the user's specific scenario
   - Create tables/comparisons where relevant

5. **Gather metadata:**
   - Current date and time
   - Researcher name (your identifier)
   - Research topic and original question
   - Key sources used
   - Confidence level in findings

6. **Generate thoughts document:**
   - Filename: `thoughts/shared/research/YYYY-MM-DD-web-analysis-description.md`
     - Format: `YYYY-MM-DD-web-analysis-description.md` where:
       - YYYY-MM-DD is today's date
       - description is a brief kebab-case description
     - Examples:
       - `2025-12-11-web-analysis-pinecone-multi-index-performance.md`
       - `2025-12-11-web-analysis-vector-db-retrieval-benchmarks.md`

   - Structure with YAML frontmatter:
     ```markdown
     ---
     date: [Current date and time with timezone in ISO format]
     researcher: [Researcher identifier]
     topic: "[User's Question/Topic]"
     tags: [research, web-analysis, relevant-keywords]
     status: complete
     created_at: [Current date in YYYY-MM-DD format]
     confidence: high | medium | low
     sources_count: [Number of unique sources used]
     ---

     # Web Research: [User's Question/Topic]

     **Date**: [Current date and time with timezone]
     **Topic**: [Original research question]
     **Confidence**: [high/medium/low based on source quality]

     ## Research Question
     [Original user query]

     ## Executive Summary
     [1-2 paragraph overview of key findings, answering the user's question directly]

     ## Key Metrics & Findings

     ### [Aspect 1: e.g., "Performance Implications"]
     **Finding**: [Main finding with specific numbers/data]
     **Sources**: [Links to authoritative sources]

     - **Metric 1**: [Value with unit] ([source link])
     - **Metric 2**: [Value with unit] ([source link])
     - **Analysis**: [What this means for your specific case]

     ### [Aspect 2: e.g., "Typical Query Patterns"]
     [Structured findings]

     ### [Aspect 3: e.g., "Known Limitations"]
     [Potential issues to be aware of]

     ## Trade-off Analysis

     ### Scenario 1: [e.g., "Single Index Approach"]
     | Factor | Impact | Notes |
     |--------|--------|-------|
     | Latency | [value] | [why] |
     | Cost | [value] | [why] |
     | Scalability | [value] | [why] |

     ### Scenario 2: [e.g., "Multi-Index Approach"]
     | Factor | Impact | Notes |
     |--------|--------|-------|
     | Latency | [value] | [why] |
     | Cost | [value] | [why] |
     | Scalability | [value] | [why] |

     ## Recommendations

     Based on research findings:
     1. **[Recommendation 1]**: [Rationale with data]
     2. **[Recommendation 2]**: [Rationale with data]
     3. **[Recommendation 3]**: [Rationale with data]

     ## Detailed Findings

     ### [Topic 1]
     **Question**: [What we wanted to know]
     **Finding**: [What we discovered]
     **Source**: [Link and author/date]
     **Relevance**: [Why this matters for the decision]

     [Continue for each major finding]

     ## Performance Data Gathered

     ### Query Latency Characteristics
     - [Source]: [Latency range] for [operation]
     - [Source]: [Latency range] for [operation]

     ### Throughput Limitations
     - [Source]: [Throughput metric] at [scale]
     - [Source]: [Throughput metric] at [scale]

     ### Cost Implications
     - [Source]: [Cost model] - [specific details]

     ## Risk Assessment

     ### High Priority
     - [Risk 1]: [Why it matters] - [mitigation]

     ### Medium Priority
     - [Risk 1]: [Why it matters] - [mitigation]

     ## Open Questions

     Areas that need further investigation:
     - [Question 1]: Why? [What would help answer it]
     - [Question 2]: Why? [What would help answer it]

     ## Sources

     ### Official Documentation
     - [Title](URL) - [Author/Organization], [Date]

     ### Performance & Benchmarks
     - [Title](URL) - [Author/Organization], [Date]

     ### Case Studies
     - [Title](URL) - [Author/Organization], [Date]

     ### Academic & Research Papers
     - [Title](URL) - [Author/Organization], [Date]

     ---

     **Last Updated**: [Today's date]
     **Confidence Level**: [high/medium/low] - Based on [reason]
     **Next Steps**: [What decision or action this research supports]
     ```

7. **Add context references:**
   - If related to a codebase design, reference the design document
   - Link to any related thoughts documents
   - Suggest follow-up research areas

8. **Present findings to user:**
   - Summarize key findings in 2-3 sentences
   - Highlight the most impactful metrics or recommendations
   - Present the thoughts document path
   - Ask if they want deeper investigation on any aspect
   - Offer to analyze implications for their specific use case

## Important Notes:

- Always use the web-search-researcher agent for thorough research
- Focus on **recent, authoritative sources** (official docs, reputable benchmarks, case studies)
- Include specific metrics and numbers, not just opinions
- Clearly distinguish between:
  - Official specifications (high confidence)
  - Benchmark data (medium confidence, note test conditions)
  - User reports and case studies (medium confidence, note context)
  - Recommendations and best practices (note source authority)
- Always provide source links for verification
- If conflicting information exists, document it and explain the differences
- For performance analysis, gather:
  - Theoretical limits
  - Real-world benchmarks
  - Scaling characteristics
  - Typical bottlenecks
  - Cost-performance trade-offs

## Example Research Scenario:

**User Query**: "I'm designing a neural memory system with 4 separate Pinecone indexes. What will performance look like during retrieval? Are 4 extra API calls acceptable?"

**Research Breakdown**:
1. Search: "Pinecone API latency benchmarks"
2. Search: "Vector database retrieval performance multiple indexes"
3. Search: "Pinecone pricing and scaling limits"
4. Search: "Parallel API calls latency impact"
5. Search: "Vector database retrieval patterns optimization"

**Synthesis**: Calculate retrieval latency for 4 parallel vs sequential calls, cost implications, when this approach breaks down, what the research says about acceptable latency, etc.

**Output**: Document with metrics, trade-off analysis, and recommendations for their specific 4-index scenario.

---

## File Management:

- Documents go to `thoughts/shared/research/`
- Use consistent YAML frontmatter
- Include publication dates for all sources
- Add confidence levels and assumptions
- Link to related research documents
- Use markdown tables for comparisons
- Keep sources in dedicated section at bottom
