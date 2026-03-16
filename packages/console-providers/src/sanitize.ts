/**
 * Content Sanitization Utilities
 *
 * Provides functions for sanitizing webhook content before storage.
 * - Truncates content to prevent excessive storage/embedding costs
 * - Encodes HTML entities for non-React contexts
 */

/** Maximum body length for PostTransformEvent (10KB) */
const MAX_BODY_LENGTH = 10_000;

/** Maximum title length for PostTransformEvent */
const MAX_TITLE_LENGTH = 200;

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

/** Encode HTML entities in a string */
export function encodeHtmlEntities(str: string): string {
  return str.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

/** Truncate string to max length with ellipsis indicator */
export function truncateWithEllipsis(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.slice(0, maxLength - 3)}...`;
}

/** Sanitize content for storage — truncates and trims */
export function sanitizeContent(
  content: string,
  maxLength: number = MAX_BODY_LENGTH
): string {
  const trimmed = content.trim();
  return truncateWithEllipsis(trimmed, maxLength);
}

/** Sanitize title (max 200 chars) */
export function sanitizeTitle(title: string): string {
  return sanitizeContent(title, MAX_TITLE_LENGTH);
}

/** Sanitize body (max 10,000 chars) */
export function sanitizeBody(body: string): string {
  return sanitizeContent(body, MAX_BODY_LENGTH);
}
