---
date: 2025-12-12T22:45:00+08:00
researcher: claude-opus-4-5
topic: "Optimal Mastra + BaseHub Blog Generation Pipeline for Lightfast"
tags: [research, web-analysis, mastra, basehub, aeo, seo, blog-generation, workflows]
status: complete
created_at: 2025-12-12
confidence: high
sources_count: 25
---

# Web Research: Optimal Mastra + BaseHub Blog Generation Pipeline

**Date**: 2025-12-12T22:45:00+08:00
**Topic**: Designing an end-to-end AI blog generation pipeline using Mastra workflows and BaseHub CMS with AEO/SEO optimization
**Confidence**: High - based on official documentation and authoritative sources

## Research Question

How should Lightfast structure its blog generation pipeline using Mastra workflows and BaseHub CMS, migrating from Claude Code agents to a production-ready system with AEO/SEO optimization?

## Executive Summary

The research reveals a clear path forward: **Mastra's vNext workflow system** (stable since v0.9.1) provides the ideal foundation for migrating from Claude Code agents to production-ready AI pipelines. The existing `packages/cms-workflows` implementation is well-architected but incomplete. Combined with **BaseHub's type-safe GraphQL API** and **AEO-first content structure** (answer-first format, FAQ schema, E-E-A-T signals), Lightfast can build a differentiated blog pipeline that optimizes for both traditional SEO and AI answer engine citations.

Key findings:
1. Mastra's `createStep` and `createWorkflow` APIs map directly to the existing blog workflow structure
2. BaseHub's mutation API supports programmatic content creation with rich schema types
3. AEO optimization requires specific structural elements (TL;DR blocks, FAQ schema, author attribution with `sameAs` links)
4. The Claude Code agents (blog-brief-planner, blog-writer) contain valuable prompts that should be preserved in Mastra step definitions

## Key Metrics & Findings

### 1. Mastra Workflow Architecture (2025 vNext)

**Finding**: Mastra vNext workflows provide graph-based execution with type-safe step composition, directly compatible with the existing workflow structure.

**Sources**:
- [Mastra Workflows Overview](https://mastra.ai/docs/workflows/overview)
- [Mastra vNext Migration](https://mastra.ai/docs/workflows)

**Key Capabilities**:
- **Step Operators**: `.then()`, `.parallel()`, `.branch()`, `.after()`, `.map()`
- **Agent Integration**: Agents can be used directly as steps via `createStep(agent)`
- **Tool Composition**: Tools created with `createTool()` can be converted to steps
- **State Management**: `state` / `setState` for cross-step data sharing
- **Human-in-the-Loop**: `suspend()` / `resume()` for approval workflows
- **Error Handling**: Step-level and workflow-level retry configuration

**Current Implementation Gap**: The existing `lightfastBlogWorkflow` uses `createStep` and `createWorkflow` correctly but lacks:
- Error handling with retries
- Human-in-the-loop for approval
- Observability/logging
- External data fetching (related posts, existing content)

### 2. BaseHub CMS Integration

**Finding**: BaseHub provides type-safe content management with a blocks-based schema system and mutation API for programmatic content creation.

**Sources**:
- [BaseHub Documentation](https://docs.basehub.com)
- [BaseHub Mutation API](https://docs.basehub.com/api-reference)

**Schema Architecture**:
```
Root
└── Blog (Document Block)
    ├── Authors (Collection)
    │   └── Template: name, avatar, bio, linkedIn, credentials
    ├── Categories (Collection)
    │   └── Template: name, slug, description
    └── Posts (Collection)
        └── Template: title, slug, body (Rich Text), excerpt,
            seo (Component), distribution (Component),
            engagement (Component), author (Reference), categories (Reference)
```

**Mutation Pattern** (from existing `packages/cms-workflows/src/mutations/blog.ts`):
```typescript
client.mutation({
  transaction: {
    __args: {
      autoCommit: `AI: Create post - ${title}`,
      data: {
        type: "create",
        _table: "blog.post",
        _title: title,
        // ... fields
      }
    }
  }
})
```

**Integration Requirements**:
- Environment variable: `BASEHUB_ADMIN_TOKEN`
- Type safety: Zod schemas must mirror BaseHub scalar types
- Rich text: Use `{ type: "rich-text", markdown: content }` format

### 3. AEO/SEO Content Structure

**Finding**: Pages scoring 7.0+ on AEO metrics are significantly more likely to be cited by AI answer engines. The key structural elements are: answer-first format, FAQ schema, and E-E-A-T signals.

**Sources**:
- [AEO Audit Scoring](https://www.aeoaudit.app/learn-more)
- [Klizos AEO Playbook 2025](https://klizos.com/answer-engine-optimization-aeo-playbook-2025/)
- [Profound AEO Guide](https://www.tryprofound.com/guides/what-is-answer-engine-optimization)

**AEO Scoring Weights**:
| Factor | Points | Requirements |
|--------|--------|--------------|
| Answer Clarity | 3.0 | Direct answer in first 50 words, question-based headers |
| Content Structure | 2.0 | Lists, tables, FAQ sections |
| Discoverability | 2.0 | Clear titles, H1→H2→H3 hierarchy, clean URLs |
| Specificity & Authority | 2.0 | Concrete examples, citations, expert quotes |
| Schema Implementation | 1.0 | FAQ, HowTo/Article schema, speakable markup |

**Required Content Elements**:
1. **Answer Block** (50-80 words): Concise upfront answer to main query
2. **TL;DR Section**: 3-5 self-contained bullet points immediately after opening
3. **Definition Block**: "What is X?" section with clear one-sentence definition
4. **FAQ Section**: 5-10 questions with <50 word answers, using FAQPage schema
5. **Author Attribution**: Name, role, experience, LinkedIn (`sameAs` property)
6. **External Citations**: 5-10 authoritative sources with links

**Schema.org Requirements**:
```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Title",
  "author": {
    "@type": "Person",
    "@id": "https://lightfast.ai/author/name",
    "name": "Author Name",
    "sameAs": ["https://linkedin.com/in/author"]
  },
  "datePublished": "2025-01-15T08:00:00Z",
  "dateModified": "2025-01-20T10:30:00Z"
}
```

### 4. Profound Blog Structure Analysis

**Finding**: Profound (leading AEO platform) structures their blog with category filtering, author attribution with photos/LinkedIn links, prominent dates, and RSS feeds.

**Sources**: [Profound Blog](https://www.tryprofound.com/blog)

**Content Categories Used**:
- Company, Data, AI, Guides, Research, Technology, Blueprints, Product

**Structural Patterns**:
- Grid layout with chronological ordering
- Category tags on each post
- Multi-author support with stacked profile pictures
- Publication date format: "DD Mon, YYYY"
- RSS feed availability for syndication
- Title limited to 3 lines, description to 2 lines

## Trade-off Analysis

### Option 1: Migrate Claude Agents to Mastra (Recommended)

| Factor | Impact | Notes |
|--------|--------|-------|
| Development Effort | Medium | Port prompts to step definitions, add error handling |
| Type Safety | High | Zod schemas provide runtime validation |
| Observability | High | Built-in logging, tracing, metrics |
| Human-in-the-Loop | High | Native suspend/resume support |
| Scalability | High | Async execution, retry logic, parallel steps |
| Maintenance | Low | Single codebase, version controlled |

### Option 2: Keep Claude Agents Separate

| Factor | Impact | Notes |
|--------|--------|-------|
| Development Effort | Low | No migration work |
| Type Safety | Low | Manual validation, no schema enforcement |
| Observability | Low | Requires custom instrumentation |
| Human-in-the-Loop | Medium | Requires custom implementation |
| Scalability | Low | No built-in retry, parallel execution |
| Maintenance | High | Two systems to maintain, prompts in markdown |

### Option 3: Hybrid Approach

| Factor | Impact | Notes |
|--------|--------|-------|
| Development Effort | Medium-High | Integrate agents as Mastra tools |
| Type Safety | Medium | Partial coverage |
| Observability | Medium | Mixed instrumentation |
| Human-in-the-Loop | High | Mastra handles orchestration |
| Scalability | High | Mastra workflow benefits |
| Maintenance | Medium | Complexity in integration layer |

## Recommendations

Based on research findings:

### 1. **Migrate to Mastra-First Architecture**

The existing `packages/cms-workflows` structure is correct. Complete the implementation:

```typescript
// Recommended final workflow structure
export const lightfastBlogWorkflow = createWorkflow({
  id: "lightfast-blog-post",
  inputSchema: workflowInputSchema,
  outputSchema: finalOutputSchema,
  retryConfig: { attempts: 3, delay: 2000 },
})
  .then(validateInputStep)           // New: Validate before AI calls
  .then(fetchContextStep)            // New: Get related posts, author info
  .then(deriveAeoPlanStep)           // Existing: AEO planning
  .then(planBlogBriefStep)           // Existing: Brief generation
  .then(writeBlogPostStep)           // Existing: Post writing
  .then(generateSchemaStep)          // New: JSON-LD structured data
  .then(humanApprovalStep)           // New: Human-in-the-loop
  .then(publishToBasehubStep)        // New: CMS mutation
  .commit();
```

### 2. **Preserve Claude Agent Prompts as Step System Instructions**

Extract the detailed prompts from `.claude/agents/blog-brief-planner.md` and `.claude/agents/blog-writer.md` into constants:

```typescript
const BLOG_BRIEF_PLANNER_INSTRUCTIONS = `
You are the Blog Brief Planner for Lightfast, a memory system built for teams.
[... extracted from blog-brief-planner.md ...]
`;

const planBlogBriefStep = createStep({
  id: "plan-blog-brief",
  // ... schema definitions
  execute: async ({ inputData }) => {
    const { object } = await generateObject({
      model: anthropic("claude-3-5-sonnet-latest"),
      system: BLOG_BRIEF_PLANNER_INSTRUCTIONS,
      schema: briefSchema,
      prompt: JSON.stringify(inputData),
    });
    return object;
  }
});
```

### 3. **Add AEO-Specific Schema Generation Step**

```typescript
const generateSchemaStep = createStep({
  id: "generate-schema",
  inputSchema: postWithMetadataSchema,
  outputSchema: postWithSchemaSchema,
  execute: async ({ inputData }) => {
    const { post, author } = inputData;

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.seo.metaDescription,
      datePublished: new Date().toISOString(),
      author: {
        "@type": "Person",
        name: author.name,
        sameAs: [author.linkedIn].filter(Boolean),
      },
      publisher: {
        "@type": "Organization",
        name: "Lightfast",
        logo: { "@type": "ImageObject", url: "https://lightfast.ai/logo.png" }
      }
    };

    // Add FAQPage if FAQ items present
    if (post.faqItems?.length > 0) {
      structuredData["@graph"] = [{
        "@type": "FAQPage",
        mainEntity: post.faqItems.map(faq => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer
          }
        }))
      }];
    }

    return { ...inputData, structuredData };
  }
});
```

### 4. **Implement Human-in-the-Loop Approval**

```typescript
const humanApprovalStep = createStep({
  id: "human-approval",
  execute: async ({ inputData, suspend }) => {
    // Suspend workflow for human review
    const approval = await suspend({
      event: "blog_post_review",
      data: {
        post: inputData.post,
        brief: inputData.brief,
        previewUrl: `https://lightfast.ai/preview/${inputData.post.slugSuggestion}`
      }
    });

    if (!approval.approved) {
      throw new Error(`Post rejected: ${approval.feedback}`);
    }

    return {
      ...inputData,
      approvedBy: approval.approver,
      approvedAt: new Date().toISOString(),
      edits: approval.edits
    };
  }
});
```

### 5. **Expose Workflow via API Route**

```typescript
// api/console/src/routes/blog-workflow.ts
import { mastra } from "@vendor/mastra";
import { lightfastBlogWorkflow } from "@repo/cms-workflows";

export async function POST(req: Request) {
  const input = await req.json();

  const { runId, start } = await mastra
    .getWorkflow("lightfastBlogWorkflow")
    .createRun();

  // Start workflow (async)
  const result = await start({ triggerData: input });

  return Response.json({ runId, status: result.status });
}
```

## Detailed Architecture

### Complete Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LIGHTFAST BLOG PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ rawTopic, businessGoal, targetPersona, campaignTag, targetQuestions │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 1: VALIDATE & ENRICH ──────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Validate input against schema                                      │   │
│  │ • Fetch related posts from BaseHub                                   │   │
│  │ • Fetch author details and credentials                               │   │
│  │ • Check for duplicate content                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 2: DERIVE AEO PLAN (Claude 3.5 Sonnet) ────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Output:                                                              │   │
│  │ • aiVisibilityGoal: string                                           │   │
│  │ • funnelStage: top | mid | bottom                                    │   │
│  │ • targetQuestions: string[] (5-10)                                   │   │
│  │ • entitiesToHighlight: string[] (3-6)                                │   │
│  │ • structuralDirectives: string[] (4-8)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 3: PLAN BLOG BRIEF (Claude 3.5 Sonnet) ────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Output:                                                              │   │
│  │ • topic, angle, businessGoal                                         │   │
│  │ • keywords: { primary, secondary[] }                                 │   │
│  │ • tldrPoints: string[] (3-5)                                         │   │
│  │ • readerProfile: { role, painPoints, priorKnowledge }                │   │
│  │ • outline: { heading, goal, notes }[]                                │   │
│  │ • faqQuestions: { question, answerApproach }[]                       │   │
│  │ • externalSources: { domain, purpose, relevance }[]                  │   │
│  │ • visualAssets: { type, purpose, placement, description }[]          │   │
│  │ • constraints: string[]                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 4: WRITE BLOG POST (Claude 3.5 Sonnet) ────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Output:                                                              │   │
│  │ • title, slugSuggestion, description, excerpt                        │   │
│  │ • content: markdown with TL;DR, FAQs, author bio                     │   │
│  │ • contentType: tutorial | announcement | thought-leadership | ...    │   │
│  │ • seo: { metaTitle, metaDescription, focusKeyword, ... }             │   │
│  │ • distribution: { businessGoal, primaryProductArea, ... }            │   │
│  │ • faqItems: { question, answer }[]                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 5: GENERATE STRUCTURED DATA ───────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Output:                                                              │   │
│  │ • BlogPosting schema (JSON-LD)                                       │   │
│  │ • FAQPage schema (if FAQ items present)                              │   │
│  │ • Author Person schema with sameAs                                   │   │
│  │ • Organization schema                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 6: HUMAN APPROVAL (suspend/resume) ────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Generate preview URL                                               │   │
│  │ • Suspend workflow for human review                                  │   │
│  │ • Capture edits, feedback, approval                                  │   │
│  │ • Resume on approval or reject on decline                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  STEP 7: PUBLISH TO BASEHUB ─────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Create post via BaseHub mutation API                               │   │
│  │ • Link author, categories, related posts                             │   │
│  │ • Set status: draft | published                                      │   │
│  │ • Return post ID and URL                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  OUTPUT                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ { postId, slug, url, status, runId }                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### File Structure After Migration

```
packages/cms-workflows/
├── src/
│   ├── index.ts                    # Package exports
│   ├── workflows/
│   │   ├── blog.ts                 # Main blog workflow (enhanced)
│   │   └── blog.test.ts            # Workflow tests
│   ├── steps/
│   │   ├── validate-input.ts       # New: Input validation
│   │   ├── fetch-context.ts        # New: Related posts, authors
│   │   ├── derive-aeo-plan.ts      # Extracted from blog.ts
│   │   ├── plan-blog-brief.ts      # Extracted from blog.ts
│   │   ├── write-blog-post.ts      # Extracted from blog.ts
│   │   ├── generate-schema.ts      # New: JSON-LD generation
│   │   ├── human-approval.ts       # New: Suspend/resume
│   │   └── publish-to-basehub.ts   # New: CMS mutation
│   ├── prompts/
│   │   ├── aeo-planner.ts          # System instructions
│   │   ├── brief-planner.ts        # Extracted from Claude agent
│   │   └── post-writer.ts          # Extracted from Claude agent
│   ├── mutations/
│   │   └── blog.ts                 # Existing: BaseHub mutations
│   ├── queries/
│   │   ├── posts.ts                # New: Fetch related posts
│   │   └── authors.ts              # New: Fetch author details
│   └── schemas/
│       ├── input.ts                # Workflow input schemas
│       ├── output.ts               # Workflow output schemas
│       └── structured-data.ts      # JSON-LD schemas
├── package.json
└── tsconfig.json
```

## Risk Assessment

### High Priority
- **Schema Drift**: Zod schemas must stay in sync with BaseHub generated types
  - Mitigation: Implement codegen to generate Zod from BaseHub schema
  - Mitigation: Add CI check comparing schemas

### Medium Priority
- **AI Model Costs**: Multiple Claude calls per post (3 steps × ~$0.03-0.10)
  - Mitigation: Cache intermediate results, implement cost tracking

- **Token Limits**: Long content may exceed context windows
  - Mitigation: Implement content chunking, use streaming for long outputs

### Low Priority
- **Rate Limiting**: BaseHub API limits on mutations
  - Mitigation: Implement queue for batch publishing

## Open Questions

Areas that need further investigation:

1. **Author Attribution**: How should author credentials be stored and linked?
   - Need: Define author entity in BaseHub with E-E-A-T fields

2. **Image Generation**: Should visual assets be generated?
   - Need: Evaluate DALL-E/Midjourney integration for diagrams

3. **Distribution Automation**: How to automate social media posting?
   - Need: Evaluate integration with Buffer/Typefully APIs

4. **Analytics Integration**: How to track AEO performance?
   - Need: Evaluate Profound or similar AEO analytics platform

## Sources

### Official Documentation
- [Mastra Workflows Overview](https://mastra.ai/docs/workflows/overview) - Mastra, 2025
- [Mastra Agents](https://mastra.ai/docs/agents/overview) - Mastra, 2025
- [BaseHub Documentation](https://docs.basehub.com) - BaseHub, 2025
- [BaseHub Mutation API](https://docs.basehub.com/api-reference) - BaseHub, 2025

### AEO/SEO Research
- [AEO Audit Scoring System](https://www.aeoaudit.app/learn-more) - AEO Audit, 2025
- [Klizos AEO Playbook 2025](https://klizos.com/answer-engine-optimization-aeo-playbook-2025/) - Klizos, 2025
- [Profound AEO Guide](https://www.tryprofound.com/guides/what-is-answer-engine-optimization) - Profound, 2025
- [E-E-A-T for AEO](https://www.maximuslabs.ai/answer-engine-optimizations/e-e-a-t-for-aeo) - Maximus Labs, 2025

### Schema & Structured Data
- [Schema.org BlogPosting](https://schema.org/BlogPosting) - Schema.org
- [Interrupt Media Schema Guide](https://interruptmedia.com/master-schema-json-ld-elevate-your-seo-strategy-in-2025/) - Interrupt Media, 2025

### Case Studies
- [Profound Blog](https://www.tryprofound.com/blog) - Profound, 2025
- [Mastering Mastra AI Workflows](https://khaledgarbaya.net/blog/mastering-mastra-ai-workflows/) - Khaled Garbaya, 2025

---

**Last Updated**: 2025-12-12
**Confidence Level**: High - Based on official documentation and established AEO research
**Next Steps**: Implement recommended architecture, starting with step extraction and test coverage
