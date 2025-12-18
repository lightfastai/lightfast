/**
 * Content Sanitization Utilities
 *
 * Provides functions for sanitizing webhook content before storage.
 * - Truncates content to prevent excessive storage/embedding costs
 * - Encodes HTML entities for non-React contexts
 */

/**
 * Maximum body length for SourceEvent (10KB)
 * Balances between useful content and storage/embedding costs
 */
export const MAX_BODY_LENGTH = 10000;

/**
 * Maximum title length for SourceEvent
 */
export const MAX_TITLE_LENGTH = 200;

/**
 * HTML entities that should be encoded
 */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

/**
 * Encode HTML entities in a string
 * Prevents XSS in contexts where React auto-escaping doesn't apply
 *
 * @param str - String to encode
 * @returns String with HTML entities encoded
 */
export function encodeHtmlEntities(str: string): string {
  return str.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Truncate string to max length with ellipsis indicator
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated string
 */
export function truncateWithEllipsis(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Sanitize content for storage in SourceEvent
 * - Truncates to max length
 * - Trims whitespace
 *
 * Note: HTML encoding is NOT applied by default as React handles XSS at render.
 * Use encodeHtmlEntities() explicitly if content is used in non-React contexts.
 *
 * @param content - Content to sanitize
 * @param maxLength - Maximum length (default: MAX_BODY_LENGTH)
 * @returns Sanitized content
 */
export function sanitizeContent(
  content: string,
  maxLength: number = MAX_BODY_LENGTH
): string {
  const trimmed = content.trim();
  return truncateWithEllipsis(trimmed, maxLength);
}

/**
 * Sanitize title for SourceEvent
 *
 * @param title - Title to sanitize
 * @returns Sanitized title (max 200 chars)
 */
export function sanitizeTitle(title: string): string {
  return sanitizeContent(title, MAX_TITLE_LENGTH);
}

/**
 * Sanitize body for SourceEvent
 *
 * @param body - Body to sanitize
 * @returns Sanitized body (max 10,000 chars)
 */
export function sanitizeBody(body: string): string {
  return sanitizeContent(body, MAX_BODY_LENGTH);
}
