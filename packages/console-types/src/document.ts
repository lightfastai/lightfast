/**
 * Document and chunk metadata types
 */

/**
 * Document metadata matching database schema
 */
export interface DocumentMetadata {
  /** Number of chunks */
  chunkCount: number;
  /** Git commit SHA */
  commitSha: string;
  /** When the commit occurred */
  committedAt: Date;
  /** Content hash (SHA-256) */
  contentHash: string;
  /** Document description */
  description?: string;
  /** Parsed frontmatter */
  frontmatter?: Record<string, unknown>;
  /** Repo-relative file path */
  path: string;
  /** URL-friendly slug */
  slug: string;
  /** Document title */
  title?: string;
  /** Workspace ID this document belongs to */
  workspaceId: string;
}

/**
 * Chunk metadata for vector entries
 */
export interface ChunkMetadata {
  /** 0-based chunk index */
  chunkIndex: number;
  /** Document ID this chunk belongs to */
  docId: string;
  /** Chunk text content */
  text: string;
  /** Vector ID in index */
  vectorId: string;
}
