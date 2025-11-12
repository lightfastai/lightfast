# LLM Cost Analysis for Semantic Relationship Extraction

**Date:** 2025-11-12
**Status:** Cost Estimation

---

## Token Count Estimation

### Input Tokens Per API Call

**Source Document:**
```typescript
{
  sourceType: "zendesk",
  title: "Users getting logged out after 5 minutes",  // ~15 tokens
  content: "..." // Limited to 4000 characters = ~1000 tokens
}
```
**Subtotal: ~1000 tokens**

**30 Candidate Documents:**
```typescript
Each candidate:
{
  sourceType: "github",
  documentType: "file",
  title: "Session Manager",                    // ~5 tokens
  snippet: "export class SessionManager..."    // ~200 tokens
  similarity: 0.78
}
```
**Subtotal: 30 × ~200 = ~6000 tokens**

**System Prompt + Instructions:**
```
- Task description: ~500 tokens
- Relationship types explanation: ~300 tokens
- Evaluation criteria: ~400 tokens
- Output format examples: ~300 tokens
```
**Subtotal: ~1500 tokens**

**Total Input: ~8500 tokens per document**

### Output Tokens Per API Call

**JSON Response:**
```json
[
  {
    "candidateId": "doc_abc",
    "relationshipType": "CAUSED_BY",
    "confidence": 0.88,
    "reasoning": "The Zendesk ticket reports users getting...",  // ~80 tokens
    "sourceEvidence": "getting logged out randomly...",          // ~15 tokens
    "targetEvidence": "BUG: Race condition here..."              // ~15 tokens
  }
  // ... 30 candidates × ~120 tokens each
]
```

**Total Output: ~3600 tokens per document**

---

## Claude 3.5 Sonnet Pricing

**Current Pricing (as of 2024-2025):**
- **Input:** $3.00 per million tokens = **$0.000003 per token**
- **Output:** $15.00 per million tokens = **$0.000015 per token**

**Cost Per Document:**
```
Input:  8,500 tokens × $0.000003 = $0.0255
Output: 3,600 tokens × $0.000015 = $0.0540
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:                           $0.0795 ≈ $0.08
```

**I was wrong - it's ~$0.08 per document, not $0.03!**

---

## Cost Optimization Strategies

### Strategy 1: Reduce Candidate Count

**Current:** Evaluate 30 candidates per document
**Optimized:** Evaluate top 15 candidates only

**Why?** Candidates 16-30 likely have low similarity scores (<0.65) and won't result in relationships anyway.

**New Cost:**
```
Input:  1000 (doc) + 3000 (15 candidates) + 1500 (prompt) = 5,500 tokens
Output: 1,800 tokens (15 evaluations)

Input:  5,500 × $0.000003 = $0.0165
Output: 1,800 × $0.000015 = $0.0270
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:                       $0.0435 ≈ $0.04
```

**Savings: 50% reduction**

### Strategy 2: Prompt Caching (Claude Feature)

**Cacheable parts:**
- System prompt + instructions: ~1500 tokens
- Candidate document descriptions: ~3000 tokens (if same workspace/context)

**Pricing with cache:**
- Cache write: $3.75 per million tokens (25% more)
- Cache read: $0.30 per million tokens (90% discount!)

**First call:** $0.08 (write to cache)
**Subsequent calls (cache hit):**
```
Cached input: 4,500 tokens × $0.0000003 = $0.00135
Fresh input:  1,000 tokens × $0.000003  = $0.00300
Output:       3,600 tokens × $0.000015  = $0.05400
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:                                   $0.0584 ≈ $0.06
```

**Savings: 25% reduction on subsequent calls**

### Strategy 3: Selective Extraction

**Don't extract for:**
- Documents with many explicit relationships already (API/regex found enough)
- Very short documents (<100 words)
- Documents with low vector search results (no good candidates)

**Current:** Extract for 100% of Zendesk/Sentry/Notion docs
**Optimized:** Extract for ~60% (filter out cases where it won't help)

**Effective cost:** $0.08 × 0.60 = **$0.048 per document**

### Strategy 4: Batching Multiple Documents

If we batch multiple source documents in one API call:

```typescript
// Single API call for 5 documents
{
  source_documents: [doc1, doc2, doc3, doc4, doc5],
  candidates: [shared pool of 30 candidates],
  task: "For each source document, evaluate relationships"
}
```

**Pros:**
- Amortize system prompt cost across multiple documents
- Share candidate pool (more efficient token usage)

**Cons:**
- More complex prompt
- Larger output (5x)
- Risk of hitting token limits

**Estimated cost per document:** $0.05-0.06

### Strategy 5: Use Claude Haiku for Initial Filtering

**Two-stage approach:**

**Stage 1 (Haiku - cheap):**
- Filter 30 candidates → top 10 most promising
- Simple yes/no evaluation per candidate
- Cost: ~$0.005 per document

**Stage 2 (Sonnet - expensive):**
- Detailed evaluation of top 10 only
- Full reasoning + evidence extraction
- Cost: ~$0.03 per document

**Total: $0.035 per document**

**Haiku Pricing:**
- Input: $0.25 per million tokens
- Output: $1.25 per million tokens

```
Stage 1 (Haiku):
Input:  8,500 × $0.00000025 = $0.0021
Output: 1,000 × $0.00000125 = $0.0013
Subtotal: $0.0034

Stage 2 (Sonnet - 10 candidates):
Input:  3,500 × $0.000003 = $0.0105
Output: 1,200 × $0.000015 = $0.0180
Subtotal: $0.0285

Total: $0.0319 ≈ $0.03
```

**This gets us to $0.03!** But adds complexity.

---

## Combined Optimization Strategy

**Recommended Approach:**

1. **Top 15 candidates** (not 30) → 50% cost reduction
2. **Prompt caching** for instructions → 25% additional savings
3. **Selective extraction** (only 60% of documents need it) → 40% effective reduction
4. **Occasional cache misses** → add 10% back

**Final Cost Per Document:**
```
Base:        $0.08
15 candidates: × 0.5 = $0.04
Prompt cache:  × 0.75 = $0.03
Selective:     × 0.6 = $0.018
Cache miss:    × 1.1 = $0.0198 ≈ $0.02
```

**Optimized: ~$0.02 per document**

---

## Real-World Cost Examples

### Example 1: Small Team (100 docs/month)

**Documents:**
- 50 Zendesk tickets
- 30 Sentry errors
- 20 Notion pages

**Unoptimized:**
```
100 docs × $0.08 = $8.00/month
```

**Optimized:**
```
60 docs (selective) × $0.02 = $1.20/month
```

### Example 2: Mid-Sized Team (500 docs/month)

**Documents:**
- 200 Zendesk tickets
- 150 Sentry errors
- 100 Notion pages
- 50 Linear issues (supplement API data)

**Unoptimized:**
```
500 docs × $0.08 = $40.00/month
```

**Optimized:**
```
300 docs (selective) × $0.02 = $6.00/month
```

### Example 3: Large Team (2000 docs/month)

**Documents:**
- 1000 Zendesk tickets
- 500 Sentry errors
- 300 Notion pages
- 200 Linear issues

**Unoptimized:**
```
2000 docs × $0.08 = $160.00/month
```

**Optimized:**
```
1200 docs (selective) × $0.02 = $24.00/month
```

---

## Cost vs Value Analysis

### Value Per Relationship

**Discovered relationships:**
- Avg 3-5 relationships per document (with semantic extraction)
- Precision: ~85% → ~3-4 valid relationships

**Cost per relationship:**
```
Unoptimized: $0.08 / 4 = $0.02 per relationship
Optimized:   $0.02 / 4 = $0.005 per relationship
```

### Alternative: Manual Linking

**Engineer time to find relationships manually:**
- 5 minutes per document to search and verify relationships
- 100 documents/month × 5 min = 500 min = 8.3 hours
- At $100/hour: **$833/month**

**LLM cost for same work:**
- Unoptimized: $8/month (100× cheaper!)
- Optimized: $1.20/month (700× cheaper!)

### Alternative: Miss Relationships Entirely

**Impact of missing relationships:**
- Can't answer "what code caused this customer issue?"
- Can't answer "what tickets were fixed by this PR?"
- Can't find similar past issues
- **Value: Immeasurable** (lost productivity, repeated bugs, etc.)

---

## ROI Calculation

**Scenario:** Mid-sized team, 500 documents/month

**Costs:**
- LLM extraction: $6/month (optimized)
- Infrastructure: $10/month (vector search, storage)
- **Total: $16/month**

**Benefits:**
- Saves 40 hours/month of manual linking: $4,000/month
- Prevents 2 duplicate bug investigations: $2,000/month
- Improves support response time: $1,000/month
- **Total: ~$7,000/month**

**ROI: 437× return**

---

## Monitoring Cost

**Track in production:**
```typescript
{
  documentId: "doc_123",
  timestamp: "2025-01-15T10:00:00Z",

  // Token usage
  inputTokens: 5500,
  outputTokens: 1800,
  cachedTokens: 1500,

  // Cost breakdown
  inputCost: 0.0165,
  outputCost: 0.0270,
  cacheCost: 0.0005,
  totalCost: 0.0440,

  // Results
  candidatesEvaluated: 15,
  relationshipsFound: 4,
  avgConfidence: 0.83,

  // Efficiency
  costPerRelationship: 0.011
}
```

**Alerts:**
- If avg cost > $0.05/document → investigate token usage
- If relationships found < 1 per document → adjust candidate filtering
- If confidence < 0.75 → review prompt quality

---

## Implementation Recommendations

### Phase 1: Start Unoptimized

**Why?** Validate that semantic extraction actually works and provides value before optimizing.

**Cost:** ~$8-40/month for typical workloads
**Acceptable:** Yes, small relative to value

### Phase 2: Add Basic Optimizations

Once validated, add:
1. Top 15 candidates (easy win, 50% savings)
2. Selective extraction (easy win, 40% savings)

**Cost:** ~$3-15/month
**Effort:** Low (1-2 days implementation)

### Phase 3: Add Advanced Optimizations

If cost becomes significant (>$50/month):
3. Prompt caching (moderate effort)
4. Two-stage Haiku+Sonnet (more complexity)

**Cost:** ~$1-5/month
**Effort:** Medium (1 week implementation)

---

## Conclusion

**Actual Cost:** ~$0.08 per document (unoptimized), ~$0.02 per document (optimized)

**My original estimate of $0.03 was close to the optimized cost, but significantly underestimated the unoptimized cost.**

**Recommendation:**
- Start at ~$0.08/document (simple, prove value)
- Optimize to ~$0.02/document (when volume increases)
- Monitor cost/relationship ratio
- Cost is negligible compared to manual work or missing relationships

**For typical workloads:**
- Small team: $1-8/month
- Mid-sized team: $6-40/month
- Large team: $24-160/month

**All are reasonable given the value delivered** (replacing hundreds of hours of manual work).
