/**
 * Event Type Normalization
 *
 * Thin dispatchers that delegate to per-provider methods on ProviderDefinition.
 * Each provider defines its own getBaseEventType and deriveObservationType.
 */

import { getProvider } from "./registry.js";

/**
 * Map detailed sourceType to base event type for config comparison.
 *
 * @example
 * getBaseEventType("github", "pull-request.opened") // "pull_request"
 * getBaseEventType("github", "issue.closed") // "issues"
 * getBaseEventType("github", "push") // "push"
 * getBaseEventType("vercel", "deployment.created") // "deployment.created"
 * getBaseEventType("sentry", "issue.created") // "issue"
 * getBaseEventType("linear", "issue.created") // "Issue"
 */
export function getBaseEventType(source: string, sourceType: string): string {
  // Defensive: Strip source prefix if present
  const prefix = `${source}:`;
  const cleanType = sourceType.startsWith(prefix)
    ? sourceType.slice(prefix.length)
    : sourceType;

  const provider = getProvider(source);
  if (!provider) return cleanType;
  return provider.getBaseEventType(cleanType);
}

/**
 * Map source event to observation type string.
 *
 * @example
 * deriveObservationType("github", "push") // "push"
 * deriveObservationType("vercel", "deployment.succeeded") // "deployment_succeeded"
 * deriveObservationType("linear", "issue.created") // "issue.created"
 */
export function deriveObservationType(source: string, sourceType: string): string {
  const provider = getProvider(source);
  if (!provider) return sourceType;
  return provider.deriveObservationType(sourceType);
}
