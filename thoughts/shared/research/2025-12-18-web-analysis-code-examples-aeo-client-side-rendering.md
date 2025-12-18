---
date: 2025-12-18T10:30:00+08:00
researcher: claude-opus-4-5
topic: "Does having extensive code examples in changelogs/docs reduce AEO when using client-side components?"
tags: [research, web-analysis, aeo, seo, client-side-rendering, syntax-highlighting, ai-crawlers]
status: complete
created_at: 2025-12-18
confidence: high
sources_count: 18
---

# Web Research: Code Examples in Changelogs/Docs and AEO Impact with Client-Side Rendering

**Date**: 2025-12-18T10:30:00+08:00
**Topic**: Does having extensive code examples in changelogs/docs reduce AEO when using client-side components?
**Confidence**: High - Based on Vercel's December 2024 study and multiple corroborating sources

## Research Question

If we have too much code examples in our changelogs and docs, would that reduce AEO given that it uses client-side components?

## Executive Summary

**The answer is nuanced but critical**: Code examples themselves are **highly valuable for AEO** - they help AI answer engines provide accurate, contextual responses. However, **client-side rendering of those code examples is catastrophic for AEO** because AI crawlers (GPTBot, ClaudeBot, PerplexityBot) **cannot execute JavaScript**.

The core finding from Vercel's December 2024 study: AI crawlers fetch JavaScript files but **cannot execute them**. They only process the initial HTML response. This means:

1. **Code examples in server-rendered HTML** = Excellent for AEO
2. **Code examples loaded/enhanced via client-side JS** = Invisible to AI crawlers
3. **Client-side syntax highlighting that modifies DOM** = May affect content visibility

For Lightfast's changelogs and docs using BaseHub CMS + Next.js: Ensure all code blocks are present in the initial HTML payload via SSR/SSG. Client-side syntax highlighting is acceptable **only if** the actual code content exists in the initial HTML before JavaScript executes.

## Key Metrics & Findings

### AI Crawler JavaScript Capabilities

**Finding**: Major AI crawlers DO NOT execute JavaScript

| Crawler | Company | JavaScript Execution | Source |
|---------|---------|---------------------|--------|
| GPTBot | OpenAI | ❌ None | [Vercel Study](https://vercel.com/blog/the-rise-of-the-ai-crawler) |
| ClaudeBot | Anthropic | ❌ None | [Anthropic Privacy](https://privacy.claude.com/en/articles/8896518) |
| PerplexityBot | Perplexity | ❌ None | [Dark Visitors](https://darkvisitors.com/agents/perplexitybot) |
| ChatGPT-User | OpenAI | ❌ None | [SEO.AI](https://seo.ai/blog/does-chatgpt-and-ai-crawlers-read-javascript) |
| Googlebot | Google | ✅ Full | Traditional crawler with Chromium |

**Analysis**: 569+ million GPTBot requests analyzed showed **zero evidence of JavaScript execution**. AI crawlers behave as "text fetchers" - they retrieve raw HTML without browser rendering.

### Impact on Client-Side Rendered Content

**Finding**: 100% visibility loss for CSR content in AI search

**GSQI Case Study (August 2025)**:
- CSR pages: **0% visibility** in AI search results (ChatGPT, Perplexity, Claude)
- SSR pages: Significant citation rates
- After SSR migration: **2,300% increase** in AI search traffic

**Source**: [GSQI Analysis](https://www.gsqi.com/marketing-blog/ai-search-javascript-rendering/)

### Code Examples and AEO Value

**Finding**: Code examples are valuable for AEO, but only when accessible

**GitBook GEO Guide** recommendations:
- ✅ Provide complete, runnable snippets with known inputs/outputs
- ✅ Include language tags for code blocks
- ✅ Pair code with explanatory context
- ❌ Don't rely on JavaScript-based rendering for code content

**Source**: [GitBook GEO Guide](https://gitbook.com/docs/guides/seo-and-llm-optimization/geo-guide-how-to-optimize-your-docs-for-ai-search-and-llm-ingestion)

## Trade-off Analysis

### Scenario 1: Server-Side Rendered Code Blocks (Current Next.js SSR/SSG)

| Factor | Impact | Notes |
|--------|--------|-------|
| AEO Visibility | ✅ Excellent | Code content in initial HTML |
| AI Citations | ✅ High | AI crawlers can extract code examples |
| User Experience | ✅ Good | Fast initial render |
| Syntax Highlighting | ⚠️ Depends | Must use server-side highlighting (Shiki) |
| Bundle Size | ✅ Minimal | No client-side highlighting library |

### Scenario 2: Client-Side Rendered Code Blocks (CSR/Lazy Loading)

| Factor | Impact | Notes |
|--------|--------|-------|
| AEO Visibility | ❌ Zero | Code invisible to AI crawlers |
| AI Citations | ❌ None | Cannot be cited in AI answers |
| User Experience | ⚠️ Variable | Loading states, hydration delays |
| Syntax Highlighting | ❌ N/A | Irrelevant if content invisible |
| Bundle Size | ⚠️ Higher | Client-side library overhead |

### Scenario 3: Hybrid (SSR Content + Client-Side Enhancement)

| Factor | Impact | Notes |
|--------|--------|-------|
| AEO Visibility | ✅ Good | Core content in initial HTML |
| AI Citations | ✅ High | Code accessible before JS |
| User Experience | ✅ Best | Fast load + progressive enhancement |
| Syntax Highlighting | ✅ Excellent | SSR highlight OR client enhancement |
| Bundle Size | ⚠️ Moderate | Enhancement library if needed |

## Recommendations

Based on research findings:

### 1. **Use Server-Side Syntax Highlighting (Shiki)**
Shiki runs at build time, producing styled HTML with inline styles. No client-side JavaScript needed.

```typescript
// In Next.js with MDX/BaseHub
import { codeToHtml } from 'shiki';

// Highlight at build/server time
const html = await codeToHtml(code, { lang: 'typescript', theme: 'github-dark' });
```

**Rationale**: Vercel's research confirms AI crawlers cannot execute JavaScript. Server-side highlighting ensures code is visible in initial HTML.

### 2. **Ensure Code Content Exists in Initial HTML**
Even if using client-side enhancements, the raw code content MUST be in the initial HTML.

```html
<!-- ✅ GOOD - Code in initial HTML -->
<pre><code class="language-typescript">
const example = "AI crawlers can read this";
</code></pre>

<!-- ❌ BAD - Placeholder waiting for JS -->
<div data-code-block data-loading="true">
  <!-- Will be populated by JavaScript -->
</div>
```

**Rationale**: GSQI study showed 0% visibility for content requiring JavaScript rendering.

### 3. **Continue Having Extensive Code Examples**
Code examples are **not** the problem - client-side rendering is.

**AI crawlers value**:
- Complete, runnable code snippets
- Clear explanations around code
- Language-specific syntax highlighting (as long as content is SSR)
- Structured technical documentation

**Rationale**: GitBook GEO Guide explicitly recommends code examples for AI discoverability.

### 4. **Add Structured Data for Technical Content**

```json
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "Lightfast v0.2.0 - Neural Memory Foundation",
  "datePublished": "2025-12-18",
  "hasPart": [{
    "@type": "SoftwareSourceCode",
    "programmingLanguage": "TypeScript",
    "codeSampleType": "full"
  }]
}
```

**Rationale**: Schema.org markup helps AI understand content structure without executing JavaScript.

## Detailed Findings

### How AI Crawlers See Your Page

**Question**: What do GPTBot, ClaudeBot, and PerplexityBot actually see?

**Finding**: They see ONLY the initial HTML response - equivalent to viewing page source.

**Source**: [Vercel Blog - December 2024](https://vercel.com/blog/the-rise-of-the-ai-crawler)

**Relevance**: Your Next.js pages must have all code content in the initial HTML. With BaseHub CMS, ensure data fetching happens server-side (RSC or SSR), not client-side.

### The Syntax Highlighting Problem

**Question**: Do client-side syntax highlighters (Prism.js, Highlight.js) hurt AEO?

**Finding**: It depends on implementation:

1. **If the code content is in initial HTML** and highlighting adds CSS classes = OK
2. **If the code is loaded via JavaScript** = Invisible to AI crawlers
3. **If highlighting restructures the DOM** (e.g., splitting into `<span>` elements) = Original content should still be present

**Best Practice**: Use Shiki (server-side) or ensure client-side highlighters only ADD styling without changing text content.

**Source**: [Salt Agency - October 2025](https://salt.agency/blog/ai-crawlers-javascript/)

### Real-World Performance Data

**Question**: How much does CSR actually hurt AI search visibility?

**Finding**: Complete invisibility for CSR content.

**Data Points**:
- B2B Industrial Company: 0% → 2,300% traffic after SSR migration
- GSQI Test: CSR pages showed in 0% of AI search results
- SSR pages: Regular citations in ChatGPT, Perplexity, Claude responses

**Source**: [GSQI Case Study](https://www.gsqi.com/marketing-blog/ai-search-javascript-rendering/)

### Code Quality Impact on AEO

**Question**: Does the quantity of code examples matter?

**Finding**: Quality and accessibility matter more than quantity.

**AI-Optimized Code Practices**:
- ✅ Complete, runnable examples
- ✅ Clear context and explanations
- ✅ Language tags (`class="language-typescript"`)
- ✅ Semantic HTML (`<pre><code>`)
- ✅ Server-side rendering

**Source**: [GitBook GEO Guide](https://gitbook.com/docs/guides/seo-and-llm-optimization)

## Risk Assessment

### High Priority
- **Client-side code loading**: Any code loaded via `useEffect`, `fetch`, or dynamic imports will be invisible to AI crawlers
  - **Mitigation**: Ensure all code content is in initial HTML via SSR/SSG

### Medium Priority
- **JavaScript-dependent syntax highlighting**: If using client-side highlighters that modify DOM structure
  - **Mitigation**: Switch to Shiki (server-side) or ensure base content exists pre-JS

### Low Priority
- **Too many code examples**: Not a problem for AEO
  - **Mitigation**: N/A - code examples are beneficial when properly rendered

## Open Questions

1. **Shiki Integration with BaseHub**: How does BaseHub's rich text handling interact with server-side syntax highlighting? May need custom component in `vendor/cms/components/body.tsx`

2. **Build Performance**: Heavy syntax highlighting at build time could slow down SSG. What's the impact with many changelogs?

3. **Future AI Crawler Capabilities**: Will AI crawlers add JavaScript rendering? No evidence yet, but worth monitoring.

## Sources

### Official Documentation
- [OpenAI GPTBot Documentation](https://platform.openai.com/docs/bots) - OpenAI, 2024
- [Anthropic ClaudeBot Privacy](https://privacy.claude.com/en/articles/8896518) - Anthropic, July 2024
- [Schema.org releaseNotes](https://schema.org/releaseNotes) - Schema.org

### Performance & Benchmarks
- [The Rise of the AI Crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) - Vercel, December 17, 2024
- [AI Search and JavaScript Rendering](https://www.gsqi.com/marketing-blog/ai-search-javascript-rendering/) - GSQI, August 2025
- [Does ChatGPT Read JavaScript](https://seo.ai/blog/does-chatgpt-and-ai-crawlers-read-javascript) - SEO.AI, May 2025

### Best Practices & Guides
- [GitBook GEO Guide](https://gitbook.com/docs/guides/seo-and-llm-optimization/geo-guide-how-to-optimize-your-docs-for-ai-search-and-llm-ingestion) - GitBook, 2024
- [AEO Tactical Playbook](https://shellypalmer.com/2025/06/the-aeo-tactical-playbook-machine-readable-websites-answer-engine-optimization/) - Shelly Palmer, June 2025
- [AI Crawlers and JavaScript](https://salt.agency/blog/ai-crawlers-javascript/) - Salt Agency, October 2025

### Technical Analysis
- [Dark Visitors - PerplexityBot](https://darkvisitors.com/agents/perplexitybot) - Dark Visitors, 2024
- [SEO News December 2024](https://www.lumar.io/blog/industry-news/seo-news-december-2024-another-google-core-update-ai-web-crawlers-more/) - Lumar, December 2024
- [Schema Markup for AI Search](https://wpriders.com/schema-markup-for-ai-search-types-that-get-you-cited/) - WP Riders, December 2025

---

**Last Updated**: 2025-12-18
**Confidence Level**: High - Based on Vercel's comprehensive December 2024 study analyzing millions of requests, plus multiple corroborating case studies
**Next Steps**:
1. Audit current changelog/docs rendering to ensure SSR
2. Verify syntax highlighting approach (recommend Shiki)
3. Check BaseHub CMS integration for server-side data fetching
