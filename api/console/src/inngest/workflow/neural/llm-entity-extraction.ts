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

/**
 * Build the prompt for LLM entity extraction
 */
export function buildExtractionPrompt(title: string, content: string): string {
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

