/**
 * Document and chunk metadata types
 */

/**
 * Document metadata matching database schema
 */
export interface DocumentMetadata {
  /** Store ID this document belongs to */
  storeId: string;
  /** Repo-relative file path */
  path: string;
  /** URL-friendly slug */
  slug: string;
  /** Document title */
  title?: string;
  /** Document description */
  description?: string;
  /** Content hash (SHA-256) */
  contentHash: string;
  /** Git commit SHA */
  commitSha: string;
  /** When the commit occurred */
  committedAt: Date;
  /** Parsed frontmatter */
  frontmatter?: Record<string, unknown>;
  /** Number of chunks */
  chunkCount: number;
}

/**
 * Chunk metadata for vector entries
 */
export interface ChunkMetadata {
  /** Document ID this chunk belongs to */
  docId: string;
  /** 0-based chunk index */
  chunkIndex: number;
  /** Chunk text content */
  text: string;
  /** Vector ID in index */
  vectorId: string;
}
