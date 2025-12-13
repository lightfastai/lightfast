/**
 * LLM Entity Extraction Module
 *
 * Extracts contextual entities from observation content using LLM.
 * Complements rule-based (regex) extraction by identifying semantic entities.
 *
 * Examples of entities LLM can catch that regex cannot:
 * - "Deployed the auth service to production" → service: auth-service
 * - "Sarah and John reviewed the PR" → engineer: sarah, engineer: john
 * - "Using the new caching layer" → definition: caching-layer
 */

import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { log } from "@vendor/observability/log";
import { llmEntityExtractionResponseSchema } from "@repo/console-validation";
import { LLM_ENTITY_EXTRACTION_CONFIG } from "@repo/console-config";
import type { ExtractedEntity } from "@repo/console-types";

/**
 * Build the prompt for LLM entity extraction
 */
function buildExtractionPrompt(title: string, content: string): string {
  return `Extract structured entities from this engineering observation.

OBSERVATION TITLE:
${title}

OBSERVATION CONTENT:
${content}

ENTITY CATEGORIES:
- engineer: Team members, contributors (look for names, usernames, or implied people like "Sarah fixed...")
- project: Features, initiatives, repos, tickets (look for project names, feature references)
- endpoint: API routes mentioned in prose (e.g., "the users endpoint")
- config: Configuration values, settings (e.g., "increased the timeout to 30s")
- definition: Technical terms, code concepts (e.g., "the useAuth hook")
- service: External services, dependencies (e.g., "deployed to Vercel", "using Stripe")
- reference: Generic references like deployments, releases

GUIDELINES:
- Only extract entities that are CLEARLY mentioned or strongly implied
- Use canonical forms for keys (lowercase, hyphenated for multi-word)
- Be conservative - prefer fewer high-confidence entities over many uncertain ones
- Skip entities that would be caught by standard patterns (#123, @mentions, file paths)
- Focus on contextual/semantic entities that require understanding

Return entities with confidence scores reflecting how certain you are about the extraction.`;
}

/**
 * Extract entities from observation content using LLM
 *
 * This complements rule-based extraction by identifying contextual entities
 * that regex patterns cannot catch. Examples:
 * - "Deployed the auth service to production" → service: auth-service
 * - "Sarah and John reviewed the PR" → engineer: sarah, engineer: john
 * - "Using the new caching layer" → definition: caching-layer
 *
 * Future enhancements could include:
 * - Entity relationship extraction ("X depends on Y")
 * - Sentiment analysis ("auth is broken" → status inference)
 * - Temporal context extraction ("last week's deployment")
 */
export async function extractEntitiesWithLLM(
  title: string,
  content: string,
  options?: {
    observationId?: string;
    requestId?: string;
  }
): Promise<ExtractedEntity[]> {
  const { observationId, requestId } = options ?? {};
  const config = LLM_ENTITY_EXTRACTION_CONFIG;

  // Check content length threshold
  if (content.length < config.minContentLength) {
    log.debug("LLM entity extraction skipped - content too short", {
      requestId,
      observationId,
      contentLength: content.length,
      threshold: config.minContentLength,
    });
    return [];
  }

  const startTime = Date.now();

  try {
    const { object } = await generateObject({
      model: gateway("openai/gpt-5.1-instant"),
      schema: llmEntityExtractionResponseSchema,
      prompt: buildExtractionPrompt(title, content),
      temperature: config.temperature,
    });

    const latency = Date.now() - startTime;

    // Filter by confidence threshold and convert to ExtractedEntity format
    const entities: ExtractedEntity[] = object.entities
      .filter((e) => e.confidence >= config.minConfidence)
      .map((e) => ({
        category: e.category,
        key: e.key,
        value: e.value,
        confidence: e.confidence,
        evidence: e.reasoning ?? `LLM extracted: ${e.category}`,
      }));

    log.info("LLM entity extraction completed", {
      requestId,
      observationId,
      rawCount: object.entities.length,
      filteredCount: entities.length,
      latency,
    });

    return entities;
  } catch (error) {
    const latency = Date.now() - startTime;

    log.error("LLM entity extraction failed", {
      requestId,
      observationId,
      error,
      latency,
    });

    // Graceful degradation - return empty array on failure
    return [];
  }
}
