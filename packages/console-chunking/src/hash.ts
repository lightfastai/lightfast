/**
 * Content hashing utilities (SHA-256)
 *
 * Computes content hashes for change detection.
 */

import { createHash } from "node:crypto";

/**
 * Compute SHA-256 hash of content
 *
 * Returns a 64-character hex digest that can be used for:
 * - Content change detection (idempotency)
 * - Determining if a document needs re-indexing
 * - Deduplication
 *
 * @param content - Text content to hash
 * @returns SHA-256 hash as hex string (64 characters)
 *
 * @example
 * ```typescript
 * const hash1 = hashContent("Hello, world!");
 * const hash2 = hashContent("Hello, world!");
 * console.log(hash1 === hash2); // true - same content produces same hash
 * ```
 */
export function hashContent(content: string): string {
  const hash = createHash("sha256");
  hash.update(content, "utf-8");
  return hash.digest("hex");
}
