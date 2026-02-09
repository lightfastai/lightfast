/**
 * Tier 2 RAG Quality Metrics
 *
 * LLM-as-judge implementations for answer quality evaluation.
 * Uses Claude Haiku for cost efficiency (~$0.001/case).
 */

import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

export interface RAGQualityMetrics {
  faithfulness: number;       // 0-1: answer grounded in context
  citationPrecision: number;  // 0-1: citations support claims
  citationRecall: number;     // 0-1: claims have citations
  answerRelevancy: number;    // 0-1: answer addresses query
  hallucinationRate: number;  // 0-1: fraction unsupported claims
}

/**
 * Faithfulness Score via Claim Decomposition
 *
 * Steps:
 * 1. Decompose answer into atomic claims
 * 2. For each claim, check if retrieved context entails it
 * 3. Score = (supported claims) / (total claims)
 */

const ClaimDecompositionSchema = z.object({
  claims: z.array(z.string()),
});

const ClaimVerificationSchema = z.object({
  verifications: z.array(
    z.object({
      claim: z.string(),
      supported: z.boolean(),
      reasoning: z.string(),
    })
  ),
});

export async function calculateFaithfulness(
  answer: string,
  retrievedContext: string[],
  judgeModel: string = "anthropic/claude-haiku-4.5"
): Promise<number> {
  // Step 1: Decompose answer into claims
  const decomposition = await generateObject({
    model: gateway(judgeModel),
    schema: ClaimDecompositionSchema,
    prompt: `Decompose this answer into atomic claims (simple statements that can be verified independently):

Answer: ${answer}

Output a JSON array of claims.`,
    temperature: 0.2,
  });

  if (decomposition.object.claims.length === 0) {
    return 0;
  }

  // Step 2: Verify each claim against context
  const verification = await generateObject({
    model: gateway(judgeModel),
    schema: ClaimVerificationSchema,
    prompt: `For each claim, determine if it is supported by the retrieved context.

Claims:
${decomposition.object.claims.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Retrieved Context:
${retrievedContext.map((ctx, i) => `[Doc ${i + 1}] ${ctx}`).join("\n\n")}

For each claim, output: claim text, whether it's supported (true/false), and reasoning.`,
    temperature: 0.2,
  });

  // Step 3: Calculate score
  const supported = verification.object.verifications.filter(v => v.supported).length;
  return supported / decomposition.object.claims.length;
}

/**
 * Citation Precision
 *
 * Do citations actually support the claims they're attached to?
 * Score: (correct citations) / (total citations)
 */

const CitationVerificationSchema = z.object({
  citations: z.array(
    z.object({
      text: z.string(),           // The cited text from answer
      citationId: z.string(),     // The citation reference (e.g., "[1]")
      supported: z.boolean(),     // Does the cited doc support this text?
      reasoning: z.string(),
    })
  ),
});

export async function calculateCitationPrecision(
  answer: string,
  citations: Array<{ id: string; text: string }>, // Observation citations
  judgeModel: string = "anthropic/claude-haiku-4.5"
): Promise<number> {
  // Extract citation references from answer (e.g., "[1]", "[2]")
  const citationPattern = /\[(\d+)\]/g;
  const matches = Array.from(answer.matchAll(citationPattern));

  if (matches.length === 0) {
    return 1; // No citations to verify
  }

  const verification = await generateObject({
    model: gateway(judgeModel),
    schema: CitationVerificationSchema,
    prompt: `Verify if each citation correctly supports the text it's attached to.

Answer with citations: ${answer}

Citation sources:
${citations.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n")}

For each citation reference in the answer, determine if the cited source actually supports that specific text.`,
    temperature: 0.2,
  });

  const correct = verification.object.citations.filter(c => c.supported).length;
  return correct / verification.object.citations.length;
}

/**
 * Answer Relevancy
 *
 * Does the answer address the query?
 * Score: 0-1 (direct LLM judgment)
 */

const RelevancyScoreSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
});

export async function calculateAnswerRelevancy(
  query: string,
  answer: string,
  judgeModel: string = "anthropic/claude-haiku-4.5"
): Promise<number> {
  const result = await generateObject({
    model: gateway(judgeModel),
    schema: RelevancyScoreSchema,
    prompt: `Score how well this answer addresses the query.

Query: ${query}

Answer: ${answer}

Score 0-1:
- 1.0: Directly and completely answers the query
- 0.5: Partially addresses the query
- 0.0: Irrelevant or doesn't answer

Provide reasoning.`,
    temperature: 0.2,
  });

  return result.object.score;
}

/**
 * Compute all RAG quality metrics
 */
export async function computeRAGQualityMetrics(
  query: string,
  answer: string,
  retrievedContext: string[],
  citations: Array<{ id: string; text: string }>,
  judgeModel: string = "anthropic/claude-haiku-4.5"
): Promise<RAGQualityMetrics> {
  const [faithfulness, citationPrecision, answerRelevancy] = await Promise.all([
    calculateFaithfulness(answer, retrievedContext, judgeModel),
    calculateCitationPrecision(answer, citations, judgeModel),
    calculateAnswerRelevancy(query, answer, judgeModel),
  ]);

  return {
    faithfulness,
    citationPrecision,
    citationRecall: 0.9, // TODO: Implement
    answerRelevancy,
    hallucinationRate: 1 - faithfulness, // Inverse of faithfulness
  };
}
