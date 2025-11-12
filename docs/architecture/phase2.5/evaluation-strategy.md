# Phase 2.5: Evaluation Strategy for Relationship Extraction

**Date:** 2025-11-12
**Status:** Design Specification
**Tool:** Braintrust

---

## Overview

Relationship extraction quality is critical for Phase 2.5. We need comprehensive evaluations to:
1. Validate LLM relationship proposals accuracy
2. Optimize confidence thresholds
3. Measure precision/recall across sources
4. Tune prompts for semantic extraction
5. Monitor production quality over time

**Framework:** Braintrust (already used in chat app)

---

## Evaluation Suites

### Suite 1: Semantic Relationship Extraction (LLM)

**Goal:** Evaluate LLM's ability to identify relationships between documents

**File:** `apps/console/src/eval/semantic-relationships.eval.ts`

```typescript
import { Eval, initLogger } from "braintrust";
import type { EvalCase, EvalScorerArgs } from "braintrust";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { getBraintrustConfig } from "@repo/ai/braintrust-env";

// Test case structure
interface RelationshipTestInput {
  sourceDocument: {
    id: string;
    type: string;
    title: string;
    content: string;
  };
  candidateDocument: {
    id: string;
    type: string;
    title: string;
    content: string;
  };
  metadata: {
    sourceType: string;
    candidateType: string;
    temporalGap: string; // e.g., "1 day", "same day", "2 weeks"
  };
}

interface RelationshipTestExpected {
  hasRelationship: boolean;
  relationshipType?: "CAUSED_BY" | "FIXED_BY" | "IMPLEMENTS" | "RELATES_TO" | "REFERENCES";
  confidence: number; // 0.0-1.0
  reasoning: string;
}

// Test data: Golden set with human-labeled relationships
const TEST_DATA: EvalCase<RelationshipTestInput, RelationshipTestExpected>[] = [
  // Zendesk → Code (True positive)
  {
    input: {
      sourceDocument: {
        id: "zendesk-123",
        type: "ticket",
        title: "Users getting logged out after 5 minutes",
        content: "Multiple customers reporting random logouts after ~5 minutes of activity. Started after v1.2.3 deployment."
      },
      candidateDocument: {
        id: "github-file-456",
        type: "file",
        title: "src/auth/session-manager.ts",
        content: `export class SessionManager {
  private static readonly REFRESH_WINDOW = 5 * 60 * 1000; // 5 minutes

  async refreshToken(userId: string) {
    // BUG: Race condition - multiple simultaneous refreshes cause token invalidation
    if (this.isExpiringSoon(currentToken)) {
      return await this.generateNewToken(userId);
    }
  }
}`
      },
      metadata: {
        sourceType: "zendesk",
        candidateType: "github_file",
        temporalGap: "same day"
      }
    },
    expected: {
      hasRelationship: true,
      relationshipType: "CAUSED_BY",
      confidence: 0.85,
      reasoning: "Ticket reports 5-minute logouts, code has 5-minute refresh window with race condition bug causing token invalidation. Strong temporal and semantic match."
    }
  },

  // PR → Linear Issue (True positive)
  {
    input: {
      sourceDocument: {
        id: "github-pr-789",
        type: "pull_request",
        title: "Fix session timeout race condition",
        content: "Fixed critical bug in session refresh logic causing premature logouts. Added mutex lock to prevent race condition."
      },
      candidateDocument: {
        id: "linear-123",
        type: "issue",
        title: "Auth timeout bug",
        content: "Users being logged out randomly. Need to investigate session management."
      },
      metadata: {
        sourceType: "github_pr",
        candidateType: "linear_issue",
        temporalGap: "1 day"
      }
    },
    expected: {
      hasRelationship: true,
      relationshipType: "FIXED_BY",
      confidence: 0.90,
      reasoning: "PR created 1 day after issue, explicitly mentions fixing 'timeout' and 'session' bugs which matches issue description."
    }
  },

  // Unrelated documents (True negative)
  {
    input: {
      sourceDocument: {
        id: "notion-marketing",
        type: "page",
        title: "Q4 Marketing Strategy",
        content: "Focus on enterprise customers, expand to Europe, increase ad spend by 30%."
      },
      candidateDocument: {
        id: "github-file-ui",
        type: "file",
        title: "src/components/button.tsx",
        content: "export function Button({ children, onClick }: ButtonProps) { return <button onClick={onClick}>{children}</button>; }"
      },
      metadata: {
        sourceType: "notion",
        candidateType: "github_file",
        temporalGap: "3 weeks"
      }
    },
    expected: {
      hasRelationship: false,
      confidence: 0.0,
      reasoning: "No semantic overlap between marketing strategy and UI component. Different domains entirely."
    }
  },

  // Weak relationship (Medium confidence)
  {
    input: {
      sourceDocument: {
        id: "notion-spec",
        type: "page",
        title: "Authentication Architecture v2",
        content: "We should improve token refresh logic to prevent timeouts. Current implementation has edge cases."
      },
      candidateDocument: {
        id: "github-pr-999",
        type: "pull_request",
        title: "Refactor auth middleware",
        content: "General cleanup and improvements to authentication middleware."
      },
      metadata: {
        sourceType: "notion",
        candidateType: "github_pr",
        temporalGap: "2 weeks"
      }
    },
    expected: {
      hasRelationship: true,
      relationshipType: "RELATES_TO",
      confidence: 0.65,
      reasoning: "Both about authentication, but PR doesn't specifically implement the spec's recommendations. General topical overlap only."
    }
  },

  // TODO: Add 50+ more test cases covering:
  // - Sentry error → Code
  // - Sentry error → PR
  // - Notion spec → Implementation
  // - Similar past issues
  // - Cross-source references
  // - Temporal correlations
  // - False positives (similar words, different meaning)
];

// LLM prompt for relationship evaluation
function buildRelationshipPrompt(input: RelationshipTestInput): string {
  return `You are an expert at identifying relationships between software development artifacts.

## SOURCE DOCUMENT
**Type:** ${input.sourceDocument.type}
**Title:** ${input.sourceDocument.title}
**Content:**
\`\`\`
${input.sourceDocument.content}
\`\`\`

## CANDIDATE DOCUMENT
**Type:** ${input.candidateDocument.type}
**Title:** ${input.candidateDocument.title}
**Content:**
\`\`\`
${input.candidateDocument.content}
\`\`\`

## CONTEXT
- Source type: ${input.metadata.sourceType}
- Candidate type: ${input.metadata.candidateType}
- Temporal gap: ${input.metadata.temporalGap}

## TASK
Determine if there is a meaningful relationship between these documents.

Consider:
1. **Semantic overlap** - Do they discuss the same concepts/problems?
2. **Causal connection** - Does one cause/fix/implement the other?
3. **Temporal correlation** - Timing suggests connection?
4. **Specificity** - Specific technical details match vs. generic terms?

## OUTPUT
Provide your analysis as JSON:
- hasRelationship: true/false
- relationshipType: "CAUSED_BY" | "FIXED_BY" | "IMPLEMENTS" | "RELATES_TO" | "REFERENCES" | null
- confidence: 0.0-1.0
- reasoning: Detailed explanation (2-3 sentences)
- sourceEvidence: Quote from source
- targetEvidence: Quote from target

Be conservative. Only propose relationships with clear evidence.`;
}

// LLM evaluation task
async function evaluateRelationship(input: RelationshipTestInput): Promise<{
  hasRelationship: boolean;
  relationshipType: string | null;
  confidence: number;
  reasoning: string;
  sourceEvidence: string;
  targetEvidence: string;
}> {
  const result = await generateObject({
    model: anthropic("claude-3-5-sonnet-20241022"),
    prompt: buildRelationshipPrompt(input),
    schema: z.object({
      hasRelationship: z.boolean(),
      relationshipType: z.enum(["CAUSED_BY", "FIXED_BY", "IMPLEMENTS", "RELATES_TO", "REFERENCES"]).nullable(),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
      sourceEvidence: z.string(),
      targetEvidence: z.string()
    })
  });

  return result.object;
}

// Scorers
const config = getBraintrustConfig();
initLogger({ apiKey: config.apiKey, projectName: config.projectName });

void Eval(config.projectName, {
  data: TEST_DATA,
  experimentName: "Semantic Relationship Extraction",

  task: async (input: RelationshipTestInput) => {
    return await evaluateRelationship(input);
  },

  scores: [
    // 1. Relationship Detection Accuracy (Binary: has relationship or not)
    (args: EvalScorerArgs) => {
      const predicted = args.output.hasRelationship;
      const expected = args.expected.hasRelationship;

      return predicted === expected ? 1 : 0;
    },

    // 2. Relationship Type Accuracy (If has relationship, is type correct?)
    (args: EvalScorerArgs) => {
      if (!args.expected.hasRelationship) return 1; // N/A

      const predicted = args.output.relationshipType;
      const expected = args.expected.relationshipType;

      return predicted === expected ? 1 : 0;
    },

    // 3. Confidence Calibration (Is confidence aligned with correctness?)
    (args: EvalScorerArgs) => {
      const isCorrect = args.output.hasRelationship === args.expected.hasRelationship;
      const confidence = args.output.confidence;

      if (isCorrect) {
        // High confidence on correct answers is good
        return confidence;
      } else {
        // Low confidence on incorrect answers is better than high confidence
        return 1 - confidence;
      }
    },

    // 4. Reasoning Quality (Does reasoning mention key evidence?)
    (args: EvalScorerArgs) => {
      const reasoning = args.output.reasoning.toLowerCase();
      const expectedReasoning = args.expected.reasoning.toLowerCase();

      // Check if reasoning mentions key concepts from expected
      const keyTerms = expectedReasoning.split(/\s+/).filter(w => w.length > 4);
      const mentionedTerms = keyTerms.filter(term => reasoning.includes(term));

      return mentionedTerms.length / Math.max(keyTerms.length, 1);
    },

    // 5. Precision (Of predicted positives, how many are correct?)
    (args: EvalScorerArgs) => {
      if (!args.output.hasRelationship) return 1; // True negative, perfect

      // Predicted positive
      return args.expected.hasRelationship ? 1 : 0;
    },

    // 6. Recall (Of actual positives, how many did we find?)
    (args: EvalScorerArgs) => {
      if (!args.expected.hasRelationship) return 1; // True negative, N/A

      // Actual positive
      return args.output.hasRelationship ? 1 : 0;
    }
  ]
});
```

---

### Suite 2: Confidence Threshold Optimization

**Goal:** Find optimal confidence thresholds for auto-accept vs review

**File:** `apps/console/src/eval/confidence-thresholds.eval.ts`

```typescript
import { Eval } from "braintrust";

// Test multiple threshold configurations
const THRESHOLD_CONFIGS = [
  { autoAccept: 0.75, review: 0.60 },
  { autoAccept: 0.80, review: 0.60 },
  { autoAccept: 0.85, review: 0.65 },
  { autoAccept: 0.90, review: 0.70 },
];

// For each config, evaluate:
// - Precision of auto-accepted relationships
// - Recall (how many true positives did we accept?)
// - Review queue size
// - False positive rate in auto-accepted

// Goal: Maximize precision (≥85%) while maximizing recall
```

---

### Suite 3: Prompt Optimization

**Goal:** A/B test different prompt variations to improve extraction

**File:** `apps/console/src/eval/prompt-variations.eval.ts`

```typescript
const PROMPT_VARIATIONS = [
  "baseline", // Current prompt
  "more_specific_instructions", // Add examples of good/bad relationships
  "emphasize_temporal", // Focus on temporal correlation
  "emphasize_causality", // Focus on causal language
  "with_few_shot_examples", // Include 2-3 examples in prompt
];

// Test each variation against golden set
// Measure: precision, recall, confidence calibration
```

---

### Suite 4: Cross-Source Accuracy

**Goal:** Validate extraction works across all source combinations

**File:** `apps/console/src/eval/cross-source.eval.ts`

```typescript
const SOURCE_PAIRS = [
  ["zendesk", "github_file"],
  ["zendesk", "github_pr"],
  ["sentry", "github_file"],
  ["sentry", "github_pr"],
  ["notion", "github_pr"],
  ["linear", "github_pr"],
  ["github_pr", "linear"],
  ["notion", "linear"],
];

// For each pair, test:
// - Precision/recall
// - Common failure modes
// - Confidence distribution
```

---

### Suite 5: Evidence Quality

**Goal:** Ensure extracted evidence actually supports the relationship

**File:** `apps/console/src/eval/evidence-quality.eval.ts`

```typescript
// Scorer: Does evidence quote actually appear in the document?
function scoreEvidencePresence(output, input): number {
  const sourceEvidence = output.sourceEvidence;
  const sourceContent = input.sourceDocument.content;

  return sourceContent.includes(sourceEvidence) ? 1 : 0;
}

// Scorer: Is evidence relevant to the relationship?
// (Use another LLM call to judge evidence quality)
async function scoreEvidenceRelevance(output): Promise<number> {
  const result = await generateObject({
    model: anthropic("claude-3-5-haiku-20241022"), // Cheaper model for scoring
    prompt: `Rate the relevance of this evidence quote to the relationship on 0-1 scale:

    Relationship: ${output.relationshipType}
    Evidence: "${output.sourceEvidence}"
    Reasoning: ${output.reasoning}`,
    schema: z.object({ relevance: z.number() })
  });

  return result.object.relevance;
}
```

---

### Suite 6: Regression Testing

**Goal:** Ensure changes don't break existing extraction quality

**File:** `apps/console/src/eval/regression.eval.ts`

```typescript
// Run all test suites on every:
// - Prompt change
// - Model update
// - Threshold adjustment

// Track metrics over time:
// - Precision/recall trends
// - Cost per relationship
// - Latency P95
```

---

## Evaluation Metrics Dashboard

### Primary Metrics

**Precision:** True Positives / (True Positives + False Positives)
- Target: ≥85% for auto-accepted (confidence ≥0.80)
- Target: ≥75% for reviewed (confidence 0.60-0.79)

**Recall:** True Positives / (True Positives + False Negatives)
- Target: ≥70% overall

**F1 Score:** 2 × (Precision × Recall) / (Precision + Recall)
- Target: ≥0.77

**Confidence Calibration:** Correlation between confidence and correctness
- Measure: Expected Calibration Error (ECE)
- Target: ECE <0.10

### Secondary Metrics

**Evidence Quality:**
- % with valid source evidence: Target 100%
- % with valid target evidence: Target 100%
- Avg evidence relevance score: Target ≥0.85

**Cost Efficiency:**
- Cost per relationship: Target <$0.05
- Cost per true positive: Target <$0.10

**Latency:**
- P50 latency: Target <30s
- P95 latency: Target <60s

---

## Test Data Strategy

### Golden Set Construction

**Size:** 500+ test cases

**Sources:**
1. **Manual labeling** (100 cases)
   - Experts label relationships in real documents
   - High confidence ground truth

2. **Synthetic generation** (200 cases)
   - Create documents with known relationships
   - Control temporal gaps, semantic overlap

3. **Production sampling** (200 cases)
   - Sample real production relationships
   - Human review and label

**Distribution:**
- 60% true positives (has relationship)
- 40% true negatives (no relationship)
- Balance across source types
- Balance across relationship types
- Include edge cases (weak relationships, ambiguous)

### Test Case Categories

**1. Strong True Positives (Confidence ≥0.85)**
- Explicit causal language ("This fixes...")
- Temporal correlation + semantic overlap
- Specific technical details match

**2. Weak True Positives (Confidence 0.60-0.80)**
- General topical overlap
- Temporal proximity without explicit causation
- Related but uncertain

**3. True Negatives**
- Different topics entirely
- Similar words, different meaning
- Coincidental temporal overlap

**4. Hard Negatives (Challenging false positives)**
- Same domain but unrelated (both about "auth" but different issues)
- Generic terminology overlap
- Temporal correlation by chance

---

## Continuous Evaluation in Production

### Online Metrics

Track in production:
```typescript
{
  relationshipId: "rel_xyz",
  timestamp: "2025-01-15T10:00:00Z",

  // Extraction metadata
  sourceType: "zendesk",
  targetType: "github_file",
  extractionMethod: "llm_semantic",
  confidence: 0.87,

  // Model metadata
  modelId: "claude-3-5-sonnet-20241022",
  promptVersion: "v2.1",
  latencyMs: 2400,
  costUsd: 0.043,

  // Quality signals
  userFeedback: null, // "helpful" | "not_helpful" | null
  manualReview: null, // "accepted" | "rejected" | null

  // Evaluation
  evaluationScore: 0.92, // From batch eval
  evaluatedAt: "2025-01-15T11:00:00Z"
}
```

### Feedback Loop

1. **User feedback:** Users can mark relationships as helpful/not helpful
2. **Manual review:** Medium confidence relationships go to review queue
3. **Batch evaluation:** Run eval suite on sampled production data weekly
4. **Continuous improvement:** Retrain/update prompts based on feedback

---

## Implementation Plan

### Week 1: Golden Set Creation
- [ ] Build 100 manually labeled test cases
- [ ] Generate 200 synthetic test cases
- [ ] Sample and label 200 production cases (once Phase 2 deployed)

### Week 2: Basic Evaluation Suite
- [ ] Implement Suite 1 (Semantic Relationship Extraction)
- [ ] Implement Suite 5 (Evidence Quality)
- [ ] Run baseline evaluation

### Week 3: Optimization Evals
- [ ] Implement Suite 2 (Confidence Thresholds)
- [ ] Implement Suite 3 (Prompt Variations)
- [ ] Find optimal configurations

### Week 4: Production Integration
- [ ] Implement Suite 4 (Cross-Source)
- [ ] Implement Suite 6 (Regression)
- [ ] Set up continuous evaluation pipeline

---

## Success Criteria

### Phase 2.5 Launch
- ✅ Precision ≥85% on auto-accepted
- ✅ Recall ≥70% overall
- ✅ F1 score ≥0.77
- ✅ Evidence quality 100%
- ✅ Confidence calibration ECE <0.10

### 30 Days Post-Launch
- ✅ User feedback ≥80% helpful
- ✅ Manual review acceptance rate ≥80%
- ✅ Production precision stable at ≥85%
- ✅ Cost per relationship <$0.05

---

## Example: Running Evaluations

```bash
# Run full evaluation suite
pnpm eval:relationships

# Run specific suite
pnpm eval:relationships:semantic
pnpm eval:relationships:confidence
pnpm eval:relationships:prompts

# Compare two prompt versions
pnpm eval:relationships:compare --baseline=v2.1 --candidate=v2.2

# Continuous evaluation (runs nightly)
pnpm eval:relationships:regression
```

---

## Integration with Braintrust Dashboard

**Experiments tracked:**
- Prompt variations (A/B test)
- Model selection (Claude vs GPT vs Gemini)
- Threshold optimization
- Production monitoring

**Dashboards:**
- Precision/recall over time
- Confidence distribution
- Cost per relationship
- Latency P50/P95
- User feedback trends

**Alerts:**
- Precision drops below 80%
- Confidence calibration drifts
- Cost spike
- Latency spike

---

## References

- Example citation eval: `apps/chat/src/eval/citation-format.eval.ts`
- Braintrust docs: https://www.braintrust.dev/docs
- Confidence calibration: https://arxiv.org/abs/1706.04599
