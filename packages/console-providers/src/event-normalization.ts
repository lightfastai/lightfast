/**
 * Event Type Normalization
 *
 * Centralized functions for mapping between internal event type formats
 * and config sync event key formats.
 *
 * Internal format (stored in workspace_events.sourceType):
 *   "pull-request.opened", "deployment.created", "issue.resolved"
 *
 * Config format (stored in sourceConfig.sync.events):
 *   "pull_request", "deployment.created", "Issue"
 */

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

  if (source === "github") {
    const dotIndex = cleanType.indexOf(".");
    if (dotIndex > 0) {
      const base = cleanType.substring(0, dotIndex);
      const configBase = base.replace(/-/g, "_");
      return configBase === "issue" ? "issues" : configBase;
    }
    return cleanType;
  }

  if (source === "vercel") {
    return cleanType;
  }

  if (source === "sentry") {
    if (cleanType.startsWith("issue.")) {
      return "issue";
    }
    return cleanType.replace(/-/g, "_");
  }

  if (source === "linear") {
    const dotIndex = cleanType.indexOf(".");
    if (dotIndex > 0) {
      const base = cleanType.substring(0, dotIndex);
      return base
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
    }
    return cleanType;
  }

  return cleanType;
}

/**
 * Map source event to observation type string.
 * Normalizes provider-specific formats to underscore-delimited types.
 *
 * @example
 * deriveObservationType("github", "push") // "push"
 * deriveObservationType("vercel", "deployment.succeeded") // "deployment_succeeded"
 * deriveObservationType("linear", "issue.created") // "issue.created"
 */
export function deriveObservationType(source: string, sourceType: string): string {
  if (source === "vercel") {
    return sourceType.replace(".", "_");
  }
  return sourceType;
}
