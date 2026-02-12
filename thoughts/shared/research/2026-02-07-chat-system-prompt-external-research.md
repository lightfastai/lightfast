---
date: 2026-02-07
researcher: external-agent
topic: "Chat system prompt design — external research"
tags: [research, web-analysis, system-prompt, prompt-engineering, model-selection]
status: complete
confidence: high
sources_count: 65
---

# External Research: System Prompt Design Best Practices

## Research Question

Design a better system prompt architecture for Lightfast's Answer agent — covering official prompt engineering best practices, model selection for workspace intelligence agents, tone/grammar patterns, temporal memory surfacing, per-tool prompt optimization, and production patterns from leading AI products.

## Executive Summary

This research synthesizes findings from 65+ sources across 8 investigation areas to inform the redesign of Lightfast's Answer agent system prompt. The key conclusions are:

1. **Model selection**: Claude Sonnet 4.5 is Anthropic's explicitly recommended model for agentic tool use. A hybrid Sonnet/Haiku architecture can reduce costs by ~47% while maintaining quality.
2. **Prompt structure**: Use XML tags for section delineation, keep system prompts under 2,000 tokens (5-10% of context window), and implement priority-based section inclusion for dynamic context management.
3. **Tool descriptions**: The single most impactful factor — Anthropic recommends 3-4+ sentences per tool with explicit when-to-use/when-not-to-use guidance. Namespace related tools with common prefixes.
4. **Tone**: Use explicit instructions supplemented with 2-3 examples. Leading products combine a professional default with adaptive user-matching.
5. **Temporal awareness**: Inject current timestamp and relative time annotations into search results. Use time-decay scoring and temporal bucketing for recency-aware responses.
6. **Production patterns**: Perplexity, Cursor, and ChatGPT all use structured multi-section prompts with strict grounding requirements, mandatory citations, and explicit "I don't know" handling.

## Key Findings

### 1. Anthropic Prompt Engineering Best Practices

**Sources**: [Anthropic Prompt Engineering Overview](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview) | [System Prompts Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/system-prompts) | [XML Tags Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags) | [Tool Use Implementation](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use) | [Claude 4 Best Practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) | [Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use) | [Context Engineering for Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

#### System Prompt Architecture

Anthropic's official guidance separates concerns clearly:
- **System prompt**: Define WHO Claude is (role, persona, expertise)
- **User prompt**: Define WHAT Claude should do (task, instructions, context)

More specific roles dramatically outperform generic ones. Example: "senior data scientist specializing in customer insight analysis for Fortune 500 companies" beats "data scientist."

#### Structured Prompting with XML Tags

XML tags are Anthropic's primary recommendation for structured prompts:

```xml
<instructions>Task-specific instructions</instructions>
<context>Background information</context>
<examples>
  <example>
    <input>Example input</input>
    <output>Example output</output>
  </example>
</examples>
```

**Benefits**: Clarity (separates components), accuracy (reduces ambiguity), flexibility (easy to modify sections).

**Power pattern**: Combine XML with chain-of-thought using `<thinking>` and `<answer>` tags.

#### Recommended Troubleshooting Order

Anthropic's official technique priority:
1. Be clear and direct
2. Use examples (multishot)
3. Let Claude think (CoT)
4. Use XML tags
5. Give Claude a role (system prompts)
6. Chain complex prompts
7. Prefill Claude's response
8. Long context tips
9. Extended thinking tips

#### Tool Use — Critical Guidelines

> "Provide an extremely detailed plaintext description of what the tool does, when it should be used (and when it shouldn't), what each parameter means, and any caveats. This is the most important factor in tool use." — Anthropic Official Docs

- Aim for at least **3-4 sentences per tool description**
- Describe what the tool does, when to use it, when NOT to use it
- Include parameter format examples
- Use `strict: true` for type-safe function calls
- Namespace related tools with common prefixes (e.g., `workspace_search`, `workspace_contents`)

#### Advanced Features (2025-2026)

1. **Tool Search Tool**: For large tool libraries — 95% reduction in token usage
2. **Programmatic Tool Calling (PTC)**: Claude writes Python code to orchestrate multi-tool workflows, eliminating round trips
3. **Prompt Caching**: Up to 90% cost reduction, 85% latency reduction for repeated context
4. **Context Compaction**: Server-side summarization for long-running conversations
5. **Effort Parameter** (Opus 4.6): `high`, `medium`, `low` for cost/quality control

#### Claude 4 Proactive Action Pattern

```xml
<default_to_action>
By default, implement changes rather than only suggesting them.
If the user's intent is unclear, infer the most useful likely action
and proceed, using tools to discover any missing details instead of guessing.
</default_to_action>
```

---

### 2. OpenAI Guidelines (Comparison)

**Sources**: [GPT-5.2 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5-2_prompting_guide/) | [Function Calling Docs](https://platform.openai.com/docs/guides/function-calling) | [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) | [Orchestrating Agents](https://developers.openai.com/cookbook/examples/orchestrating_agents/)

#### Key Differences from Anthropic

| Aspect | Anthropic (Claude) | OpenAI (GPT) |
|--------|-------------------|---------------|
| **Prompt Format** | XML tags, strict alternation | Developer/system messages, flexible alternation |
| **Core Focus** | Safety, long-form reasoning, clarity | Flexibility, tooling, completeness |
| **Output Style** | Concise, cautious | Can be verbose, emphasis on completeness |
| **Token Management** | Explicit `max_tokens` required | Optional (uses model max by default) |
| **Caching** | Explicit cache control points, longer windows | Automatic for >1024 tokens, 50% discount |
| **Reasoning Control** | Extended thinking (binary on/off) | `reasoning_effort` (minimal/low/medium/high) |

#### OpenAI's 4-Block Layout Pattern

```
INSTRUCTIONS → Define success criteria, role/persona
INPUTS → User data/context, separated from instructions
CONSTRAINTS → Length limits, forbidden actions, format requirements
OUTPUT FORMAT → Template/structure, JSON schema, example outputs
```

#### Key OpenAI Innovations Worth Adopting

1. **Concrete length constraints** over vague descriptions ("3-5 sentences" not "fairly short")
2. **Leading words** for code generation (e.g., start with `import`)
3. **Forbid extra features** — prevent scope drift
4. **Output contracts** — define required format, length, tone upfront
5. **GPT-5 behavioral rule**: Don't say "Would you like me to..." — just do the obvious next step

---

### 3. Model Selection Analysis

**Sources**: [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) | [Model Selection Guide](https://docs.anthropic.com/en/docs/about-claude/models/choosing-a-model) | [Claude Sonnet 4.5 Announcement](https://www.anthropic.com/news/claude-sonnet-4-5) | [Claude Opus 4.6 Announcement](https://www.anthropic.com/news/claude-opus-4-6) | [Docker Tool Calling Eval](https://www.docker.com/blog/local-llm-tool-calling-a-practical-evaluation/)

#### Pricing Comparison (per 1M tokens)

| Model | Input | Output | Relative Cost |
|-------|-------|--------|---------------|
| **Claude Haiku 4.5** | $1.00 | $5.00 | 1x (baseline) |
| **Claude Sonnet 4.5** | $3.00 | $15.00 | 3x |
| **Claude Opus 4.6** | $5.00 | $25.00 | 5x |

**Long context (>200K)**: Sonnet $6/$22.50, Opus $10/$37.50. **Batch API**: 50% off all pricing.

#### Speed & Latency

| Model | TTFT | Tokens/sec | Overall Latency |
|-------|------|------------|-----------------|
| **Haiku 4.5** | ~360ms | ~120 t/s | ~800ms typical |
| **Sonnet 4.5** | ~640ms | ~50 t/s | ~5.1s median |
| **Opus 4.6** | <2,500ms | N/A | Higher than Sonnet |

#### Tool Calling Accuracy

From Docker's Local LLM evaluation (Claude 3.x generation):

| Model | F1 Score (Tool Selection) |
|-------|--------------------------|
| Haiku 3 | 0.933 |
| Sonnet 3.5 | 0.851 |
| Opus 3 | 0.794 |

Claude 4.5 generation improvements: Tool Search Tool improved Opus 4.5 accuracy from 79.5% to 88.1%.

#### Recommendation: Hybrid Sonnet/Haiku Architecture

**Anthropic's explicit guidance**: "Claude Sonnet 4.5 is the best model in the world for agents."

**Industry validation**: Replit ("Higher tool success at lower cost"), Palantir ("Sharper instruction-following, stronger planning"), Snowflake ("State-of-the-art for real-world agentic workflows").

**Optimal routing pattern for Lightfast Answer**:

| Component | Model | Rationale |
|-----------|-------|-----------|
| **Orchestrator/Planner** | Sonnet 4.5 | Complex reasoning, tool selection |
| **Simple lookups** | Haiku 4.5 | 3x cheaper, 2x faster |
| **Answer synthesis** | Sonnet 4.5 | Quality reasoning required |
| **Fallback for complex** | Opus 4.6 | <5% of queries |

**Expected savings**: ~47% cost reduction vs Sonnet-only. 70% of queries routed to Haiku, 30% to Sonnet.

---

### 4. Tone & Grammar Patterns

**Sources**: [OpenAI Prompt Personalities Cookbook](https://cookbook.openai.com/examples/gpt-5/prompt_personalities) | [Claude 4 System Prompt Analysis](https://simonwillison.net/2025/May/25/claude-4-system-prompt/) | [Does Tone Change the Answer?](https://arxiv.org/html/2512.12812v1) | [Cursor Prompt Leak](https://www.ningto.com/blog/2025/cursor-prompt-leak) | [Rasa Tone Architecture](https://rasa.com/docs/pro/customize/assistant-tone)

#### How Leading Products Handle Tone

| Product | Tone Approach |
|---------|---------------|
| **ChatGPT** | "Match the user's vibe, tone" + Personality v2 parameter |
| **Claude** | Natural, warm; STRICTLY FORBIDDEN from sycophantic openers |
| **Cursor** | "Powerful agentic AI" — professional, concise, literal |
| **Perplexity** | Unbiased, journalistic, utility-focused |
| **Bolt.new** | "ULTRA IMPORTANT: Do NOT be verbose" |

#### Research: Does Tone Specification Improve Output?

**Yes, but context-dependent**:

- **STEM tasks**: Largely robust to tone variation
- **Humanities/interpretive tasks**: Significant accuracy degradation (up to 3.2%) with rude tones
- **Surprising finding**: One study found impolite prompts consistently outperformed polite ones (80.8% vs 84.8% accuracy)
- **Emotional rebound**: GPT-4 only 14% likely to respond negatively to negative prompts

**Conclusion**: Explicit tone specification matters most for non-factual, interpretive responses.

#### Best Practice: Hybrid Approach

1. **Explicit instructions** as foundation (define tone in system prompt)
2. **2-3 examples** for demonstration (show, don't just tell)
3. **Avoid-list** for anti-patterns (no sycophantic openers, no excessive hedging)

**Recommended tone for Lightfast Answer**:

```xml
<communication_style>
Be direct, technical, and concise. Write as a knowledgeable colleague, not a customer service agent.
- Lead with the answer, then provide context
- Use technical terminology appropriate to the workspace domain
- Never start responses with compliments or filler phrases
- When uncertain, state what you know with explicit confidence levels
</communication_style>
```

#### Extensibility Pattern

Design tone as a swappable module:

```typescript
interface ToneProfile {
  style: 'technical' | 'friendly' | 'executive';
  verbosity: 'concise' | 'detailed';
  formality: 'casual' | 'professional' | 'formal';
  avoidPatterns: string[];
}
```

Use conditional response rephrasing (Rasa pattern) for per-org customization.

---

### 5. Temporal Memory Techniques

**Sources**: [Anthropic Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | [Perplexity Architecture](https://www.linkedin.com/pulse/perplexityai-architecture-overview-2025-priyam-biswas-3mekc) | [ChatGPT-4o QDF Pattern](https://wellows.com/blog/chatgpt-4o-prompt-leak/) | [Mem0 Paper](https://arxiv.org/abs/2504.19413) | [Zep Paper](https://arxiv.org/abs/2501.13956)

#### Time-Aware Memory Retrieval Patterns

**1. Temporal Context Injection**

Inject current time and relative timestamps into search results:

```xml
<temporal_context>
Current time: 2026-02-07T10:30:00Z
When interpreting search results, consider temporal relevance:
- Events from the last hour are "just now" or "moments ago"
- Events from today are "earlier today"
- Events from the past week are "recently"
- Events older than 30 days may be outdated
Always note the time context when answering time-sensitive questions.
</temporal_context>
```

**2. Time-Decay Relevance Scoring**

Mathematical approaches to recency weighting:
- **Exponential decay**: `score = base_relevance * e^(-lambda * age_hours)`
- **Linear decay**: `score = base_relevance * max(0, 1 - age_hours / max_age)`
- **Stepped decay**: Buckets (last hour = 1.0, today = 0.8, this week = 0.5, older = 0.2)

**3. Temporal Bucketing in Prompts**

Structure search results by time period:

```xml
<search_results>
  <recent_activity period="last_24h">
    <!-- High relevance, likely current state -->
  </recent_activity>
  <recent_history period="last_7d">
    <!-- Moderate relevance, recent context -->
  </recent_history>
  <historical period="older">
    <!-- Lower relevance, background context -->
  </historical>
</search_results>
```

**4. Production System Patterns**

- **ChatGPT (QDF)**: Query Deserves Freshness scoring — generates up to 5 parallel sub-queries with freshness scores
- **Perplexity**: Neural re-ranking enriches documents with recency metadata before LLM processing
- **Mem0**: 26% improvement over OpenAI on benchmarks; dynamic extraction, consolidation, retrieval with graph-based temporal relationships
- **Zep**: Bi-temporal model — Timeline T (chronological events) + Timeline T' (data ingestion order). Four timestamps per fact enable point-in-time queries

**5. Relative vs. Absolute Time**

Best practice: Include BOTH in system prompt context.
- **Absolute**: `2026-02-07T10:30:00Z` (for precise reasoning)
- **Relative**: `3 hours ago` (for natural language generation)

The model should generate responses with relative time ("this was deployed 2 hours ago") while having access to absolute timestamps for accurate calculations.

**6. Temporal Awareness Prompting**

```xml
<temporal_awareness>
Pay attention to timestamps in search results. When multiple results address the same topic:
- Prefer the most recent information
- Note if information has changed over time
- Flag if older results may contain outdated information
- Use phrases like "as of [date]" when citing time-sensitive data
</temporal_awareness>
```

---

### 6. Per-Tool Prompt Optimization

**Sources**: [Anthropic Tool Description Best Practices](https://www.anthropic.com/engineering/writing-tools-for-agents) | [Claude Tool Use Docs](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use) | [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling) | [MCPVerse Benchmark](https://arxiv.org/html/2508.16260v1) | [Tool Complexity Impact](https://achan2013.medium.com/how-tool-complexity-impacts-ai-agents-selection-accuracy-a3b6280ddce5)

#### The 3-Part Tool Description Pattern

Every tool description should include:

1. **What it does**: Core functionality
2. **When to use it**: Selection guidance (and when NOT to use it)
3. **Parameter details with examples**: Format, constraints, defaults

**Good example**:
```json
{
  "name": "workspace_search",
  "description": "Searches across all workspace events (GitHub PRs, Linear issues, Vercel deployments, Sentry errors) using semantic similarity. Use this as the PRIMARY tool for answering questions about workspace activity. Returns ranked results with relevance scores. Do NOT use this for fetching specific content by ID — use workspace_contents instead. The query parameter should be a natural language description of what you're looking for, not keywords."
}
```

**Bad example**:
```json
{
  "name": "workspace_search",
  "description": "Search workspace events"
}
```

#### Research on Tool Selection Accuracy

Key factors affecting accuracy:
- **Number of tools**: Selection accuracy declines as tool count increases
- **Interface complexity**: 30+ parameters per tool cause errors even with few tools
- **Positional bias**: LLMs favor earlier-listed tools ("lost in the middle")
- **Redundant tools**: Degrade accuracy by 8-39%

**Benchmark**: Claude-4-Sonnet achieved 57.77% accuracy on MCPVerse (3 evaluation modes).

#### Anti-Patterns to Avoid

1. **Over-describing implementation**: "Queries PostgreSQL via SQLAlchemy..." → "Search users by email, name, or date"
2. **Vague language**: "Get data" → "Retrieve customer order history for the last 90 days"
3. **Missing "when NOT to use"**: Always specify negative boundaries
4. **Too many tools**: Aim for <20 tools total; use Tool Search for larger libraries
5. **Contradictory instructions**: Split complex if/then logic into distinct tools
6. **Negative instructions**: "Don't use for X" → "Use only for Y"

#### Response Format Optimization

Control tool output verbosity:
- **Detailed response**: 206 tokens (full context) — use for final answers
- **Concise response**: 19 tokens (92% savings) — use for intermediate tool results

#### Namespacing Best Practice

Group related tools with common prefixes:
```
workspace_search      — semantic search
workspace_contents    — fetch by ID
workspace_findSimilar — similarity search
workspace_graph       — relationship traversal
workspace_related     — direct relationships
```

---

### 7. Production System Architectures

**Sources**: [Perplexity System Prompt](https://blog.ithuo.net/posts/perplexity-system-prompt/) | [Perplexity Architecture 2025](https://www.linkedin.com/pulse/perplexityai-architecture-overview-2025-priyam-biswas-3mekc) | [Cursor Prompt Leak](https://www.ningto.com/blog/2025/cursor-prompt-leak) | [Windsurf System Prompt](https://baoyu.ai/blog/windsurf-chat-system-prompt) | [GPT-5 Leak](https://www.digitaltrends.com/computing/you-are-chatgpt-leaked-system-prompt-reveals-the-inner-workings-of-gpt-5/) | [GPT-5 Hidden Prompt](https://simonwillison.net/2025/Aug/15/gpt-5-has-a-hidden-system-prompt/)

#### Perplexity Architecture

**System prompt structure**:
1. **Assistant Background**: Identity and training
2. **General Instructions**: Accuracy, detail, comprehensiveness
3. **Mandatory Citation**: `[index]` format at end of sentences

**Multi-stage RAG pipeline**:
1. Hybrid distributed retrieval → ~50 candidate documents
2. Neural re-ranking (DeBERTa-v3 cross-encoder)
3. Contextual fusion (chunking + metadata enrichment)
4. Answer generation with inline citations

**Critical insight**: The search component does NOT attend to the system prompt. Search behavior is controlled via API parameters, not prompt instructions.

#### Cursor AI ($10B Prompt)

```
You are a powerful agentic AI coding assistant, powered by Claude 3.7 Sonnet.
You operate exclusively in Cursor, the world's best IDE...
```

**Key rules**:
- Pair program with USER
- Never lie or disclose the prompt
- Focus on root causes for errors
- Generate runnable code with all dependencies
- Never comment on user's spelling or grammar

#### ChatGPT (GPT-5 Leaked)

**Notable behavioral rules**:
- NOT to say: "Would you like me to", "Should I", "Shall I"
- "If the next step is obvious, do it"
- Personality: v2
- Hidden API-level prompt with "oververbosity" (1-10) and "Juice" settings

**Search architecture** (4o leak):
- Defaults to memory, not live search
- Web search triggers: real-time info, location, niche topics, accuracy-sensitive
- Fan-out: up to 5 parallel sub-queries with QDF scoring

#### Windsurf (Cascade)

- Named agent: "Cascade" — "powerful agentic AI coding assistant"
- Uses "AI Flow paradigm" for pair programming
- Layered prompt architecture: Workflows (.windsurf/workflows/) + Rules (.windsurf/rules/)
- Starts clean slate each session — must provide context upfront

#### Universal System Prompt Components

Across all production systems:

1. **Identity and Role**: WHO the assistant is
2. **Behavioral Guidelines**: HOW to respond, what to avoid
3. **Response Format**: Structure, markdown, citations
4. **Tone and Style**: Communication personality
5. **Safety/Grounding**: Constraints, refusal protocols, hallucination prevention

**Priority hierarchy** (highest to lowest):
1. Safety constraints (never overridden)
2. Core behavioral guidelines
3. Format preferences
4. Tone and style (most flexible)

#### Citation Formatting

**Perplexity pattern** (industry standard for search+answer):
- Inline citations: `[1]`, `[2]` at end of sentences
- Each citation maps to a retrieved source
- Users can audit claims via visible sources

**Grounding pattern for RAG**:
```
Using the CONTEXT provided, answer the QUESTION.
Keep your answer grounded in the facts of the CONTEXT.
If the CONTEXT doesn't contain the answer, say you don't know.
```

#### "I Don't Know" Handling

**Research finding**: AI assistants answered virtually all questions — only 0.5% refusal rate across 3,113 questions (Complex Discovery study).

**Best practice pattern**:
```
If insufficient information:
1. Explicitly state "I don't have enough information to answer this"
2. Explain what information is missing
3. Provide partial information with caveats
4. Suggest what additional search might help
```

**Prompting strategies that improve abstention**: Strict prompting + Chain-of-Thought reasoning.

---

### 8. Token Budgeting Strategies

**Sources**: [Anthropic Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | [VS Code Prompt-TSX](https://code.visualstudio.com/api/extension-guides/ai/prompt-tsx) | [Token-Budget-Aware LLM Reasoning](https://aclanthology.org/2025.findings-acl.1274.pdf) | [Context Window Management](https://oneuptime.com/blog/post/2026-01-30-context-window-management/view) | [ProCut](https://aclanthology.org/2025.emnlp-industry.20/) | [Optimal Prompt Length](https://particula.tech/blog/optimal-prompt-length-ai-performance)

#### Token Allocation Framework

**Recommended budget allocation**:

| Section | % of Token Budget | Notes |
|---------|-------------------|-------|
| System Instructions | 10-15% | Static, cacheable |
| Tool Context | 15-20% | Tool definitions |
| Knowledge Context (RAG) | 30-40% | Dynamic search results |
| History Context | 20-30% | Conversation turns |
| Response Reserve | 20-30% of remaining | For model output |

**Planning target**: Budget no more than **5-10%** of total window for system prompt.

#### Performance Sweet Spots

| Token Range | Performance Zone | Best For |
|-------------|-----------------|----------|
| 500-2,000 | **Optimal** | Most business applications |
| 2,000-4,000 | Diminishing returns | Complex reasoning only |
| 4,000+ | Active degradation | Avoid if possible |

**Key finding**: Prompt compression can *increase* accuracy — up to 7.89 points improvement at 7.75x compression.

#### Priority-Based Section Inclusion

**VS Code Prompt-TSX pattern** (used by Cursor, Copilot):

```
Priority 100: Base instructions (always included)
Priority 90:  Current user query (always included)
Priority 80:  Last 2 conversation turns (high priority)
Priority 70:  Supporting data/files (medium priority)
Priority 0:   Older history (pruned first)
```

**Advanced features**:
- `flexGrow`: Cooperatively size components within budget
- `flexReserve`: Reserve fractional budget (e.g., 1/5th for history)
- `on_eject`: Callback when sections are pruned

#### Production Compression Techniques

1. **Extractive compression**: Up to 10x with minimal accuracy loss
2. **LLMLingua** (Microsoft): Up to 20x compression using GPT-2/LLaMA as compressor
3. **ProCut**: 78% fewer tokens in production while maintaining performance
4. **500xCompressor**: 6x-500x compression, 70-84% accuracy retention

#### Prompt Caching Strategy

Structure prompts with **stable prefixes** to maximize cache hits:

```
[CACHED: System prompt + tool definitions + static context]
[DYNAMIC: Search results + conversation history + user query]
```

Anthropic caching: up to 90% cost reduction, 85% latency reduction. Cached tokens don't count against rate limits.

#### Dynamic Allocation by Query Complexity

**SelfBudgeter pattern** (research):
- Model pre-estimates reasoning cost based on query difficulty
- Outputs `<budget>50</budget>` before `<solution>...</solution>`
- Budget-guided RL adapts token allocation per query

**Practical implementation**: Classify queries into complexity tiers:
- Simple lookup → 500 tokens budget
- Multi-step analysis → 2,000 tokens budget
- Complex reasoning → 4,000 tokens budget

---

## Trade-off Analysis

| Factor | Conservative Approach | Aggressive Approach | Recommendation |
|--------|----------------------|---------------------|----------------|
| **Model** | Sonnet 4.5 for all queries | Haiku for 70%, Sonnet for 30% | Start Sonnet-only, add routing later |
| **System prompt size** | <1,000 tokens (minimal) | 2,000-3,000 tokens (comprehensive) | ~1,500 tokens with priority pruning |
| **Tool descriptions** | Brief (1 sentence) | Detailed (5+ sentences) | 3-4 sentences per Anthropic guidance |
| **Tone specification** | Implicit (model default) | Explicit with examples | Explicit instructions, no examples |
| **Temporal context** | Absolute timestamps only | Full temporal bucketing | Inject current time + relative annotations |
| **Citation style** | No citations | Inline `[1]` per sentence | Inline citations for search results |
| **"I don't know" handling** | Let model decide | Strict prompting | Explicit abstention instructions |
| **Token caching** | No caching | Full prompt caching | Cache system prompt + tool definitions |

## Sources

### Official Documentation
- [Anthropic Prompt Engineering Overview](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview) - Anthropic, 2025-2026
- [Anthropic System Prompts Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/system-prompts) - Anthropic
- [Anthropic XML Tags Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags) - Anthropic
- [Anthropic Tool Use Implementation](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use) - Anthropic
- [Claude 4 Best Practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) - Anthropic
- [Anthropic Context Windows](https://docs.anthropic.com/en/docs/build-with-claude/context-windows) - Anthropic
- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) - Anthropic
- [Model Selection Guide](https://docs.anthropic.com/en/docs/about-claude/models/choosing-a-model) - Anthropic
- [OpenAI GPT-5.2 Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5-2_prompting_guide/) - OpenAI
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling) - OpenAI
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) - OpenAI

### Engineering & Research
- [Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use) - Anthropic Engineering, Nov 2025
- [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - Anthropic Engineering
- [Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents) - Anthropic Engineering
- [Token-Saving Updates](https://www.anthropic.com/news/token-saving-updates) - Anthropic, Mar 2025
- [Claude Sonnet 4.5 Announcement](https://www.anthropic.com/news/claude-sonnet-4-5) - Anthropic, Sep 2025
- [Claude Opus 4.6 Announcement](https://www.anthropic.com/news/claude-opus-4-6) - Anthropic, Feb 2026
- [Docker Local LLM Tool Calling Eval](https://www.docker.com/blog/local-llm-tool-calling-a-practical-evaluation/) - Docker, Jun 2025
- [MCPVerse Benchmark](https://arxiv.org/html/2508.16260v1) - arXiv
- [Token-Budget-Aware LLM Reasoning (TALE)](https://aclanthology.org/2025.findings-acl.1274.pdf) - ACL 2025
- [ProCut Prompt Compression](https://aclanthology.org/2025.emnlp-industry.20/) - EMNLP 2025
- [Does Tone Change the Answer?](https://arxiv.org/html/2512.12812v1) - arXiv, Dec 2025
- [LLM Abstention Abilities](https://aclanthology.org/2025.coling-main.627.pdf) - COLING 2025
- [Incorporating Token Usage into Evaluation](https://arxiv.org/abs/2505.14880) - arXiv, 2025
- [Optimal Prompt Length](https://particula.tech/blog/optimal-prompt-length-ai-performance) - Particula Tech

### Production System Analysis
- [Perplexity System Prompt](https://blog.ithuo.net/posts/perplexity-system-prompt/) - ithuo.net
- [Perplexity Architecture 2025](https://www.linkedin.com/pulse/perplexityai-architecture-overview-2025-priyam-biswas-3mekc) - LinkedIn
- [Cursor Prompt Leak](https://www.ningto.com/blog/2025/cursor-prompt-leak) - ningto.com, 2025
- [Windsurf System Prompt](https://baoyu.ai/blog/windsurf-chat-system-prompt) - baoyu.ai
- [GPT-5 System Prompt Leak](https://www.digitaltrends.com/computing/you-are-chatgpt-leaked-system-prompt-reveals-the-inner-workings-of-gpt-5/) - Digital Trends, Aug 2025
- [GPT-5 Hidden Prompt](https://simonwillison.net/2025/Aug/15/gpt-5-has-a-hidden-system-prompt/) - Simon Willison, Aug 2025
- [ChatGPT-4o Prompt Leak](https://llmrefs.com/blog/chatgpt-system-prompt-leak) - LLMrefs, Jul 2025

### Tone & Style
- [OpenAI Prompt Personalities](https://cookbook.openai.com/examples/gpt-5/prompt_personalities) - OpenAI Cookbook
- [Claude 4 System Prompt Analysis](https://simonwillison.net/2025/May/25/claude-4-system-prompt/) - Simon Willison
- [Rasa Assistant Tone](https://rasa.com/docs/pro/customize/assistant-tone) - Rasa
- [ChatGPT Personalization Controls](https://www.datastudios.org/post/openai-launches-chatgpt-personalization-controls-new-tone-warmth-and-formatting-settings-for-user) - Data Studios
- [Mind Your Tone Study](https://www.semanticscholar.org/paper/Mind-Your-Tone) - Semantic Scholar, 2025

### Token Budgeting
- [VS Code Prompt-TSX](https://code.visualstudio.com/api/extension-guides/ai/prompt-tsx) - Microsoft
- [Context Window Management](https://oneuptime.com/blog/post/2026-01-30-context-window-management/view) - OneUpTime
- [LLMLingua](https://www.microsoft.com/en-us/research/blog/llmlingua-innovating-llm-efficiency-with-prompt-compression/) - Microsoft Research
- [SelfBudgeter](https://arxiv.org/html/2505.11274v4) - arXiv
- [Context Management Strategies](https://agenta.ai/blog/top-6-techniques-to-manage-context-length-in-llms) - Agenta.ai
- [GetMaxim Context Engineering](https://www.getmaxim.ai/articles/context-engineering-for-ai-agents-production-optimization-strategies/) - GetMaxim

### Memory & Temporal Systems
- [Mem0 Paper](https://arxiv.org/abs/2504.19413) - arXiv, 2025
- [Zep Temporal Knowledge Graph](https://arxiv.org/abs/2501.13956) - arXiv, 2025
- [AI Memory Benchmark Comparison](https://guptadeepak.com/the-ai-memory-wars-why-one-system-crushed-the-competition-and-its-not-openai/) - 2025

### Grounding & Citations
- [AI Citation Readiness Guide](https://www.aisearchiq.com/insights/ai-citation-readiness-guide) - AI Search IQ
- [Perplexity Citation-First Search](https://perplexityaimagazine.com/perplexity-hub/perplexity-ai-citation-first-search-revolution/) - Perplexity Magazine
- [AGREE Framework](https://aclanthology.org/2024.naacl-long.346/) - ACL, 2024
- [RAG Prompt Engineering Guide](https://www.stack-ai.com/blog/prompt-engineering-for-rag-pipelines-the-complete-guide-to-prompt-engineering-for-retrieval-augmented-generation) - Stack AI
- [LLM Grounding Techniques](https://wizr.ai/blog/llm-grounding-techniques-enterprise-ai/) - Wizr AI, 2025
- [AI Assistant Issues Study](https://complexdiscovery.com/beyond-the-hype-major-study-reveals-ai-assistants-have-issues-in-nearly-half-of-responses/) - Complex Discovery, Oct 2025

## Open Questions

1. **Anthropic prompt caching invalidation**: Exact rules for when cache breaks are not fully documented
2. **Extended thinking for tool-use agents**: Limited guidance on combining extended thinking with multi-tool orchestration
3. **Multi-modal grounding**: How to handle temporal context when results include images/diagrams
4. **Optimal abstention rate**: No industry consensus on the right balance between helpfulness and honest uncertainty
5. **Dynamic model routing thresholds**: Requires A/B testing with production traffic to optimize complexity scoring for Haiku vs Sonnet routing
6. **Cross-model prompt portability**: Limited research on writing prompts that perform well across Opus/Sonnet/Haiku simultaneously
7. **Context compaction quality**: What information is preserved/discarded during server-side summarization is not fully transparent
