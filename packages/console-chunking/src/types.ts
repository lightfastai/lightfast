/**
 * Type definitions for chunking
 */

/**
 * Options for text chunking
 */
export interface ChunkOptions {
  /**
   * Maximum number of tokens per chunk (default: 512)
   */
  maxTokens: number;

  /**
   * Number of tokens to overlap between chunks (default: 50)
   */
  overlap: number;

  /**
   * Whether to preserve semantic boundaries (paragraphs, code blocks)
   * When true, avoids splitting in the middle of paragraphs or code blocks (default: true)
   */
  preserveBoundaries: boolean;
}

/**
 * A single chunk of text with metadata
 */
export interface Chunk {
  /**
   * Byte offset where this chunk ends in the original text
   */
  endOffset: number;
  /**
   * 0-based chunk index
   */
  index: number;

  /**
   * Byte offset where this chunk starts in the original text
   */
  startOffset: number;

  /**
   * Chunk text content
   */
  text: string;

  /**
   * Token count for this chunk
   */
  tokens: number;
}

/**
 * Metadata extracted from MDX files
 */
export interface MDXMetadata {
  /**
   * SHA-256 hash of the content (excluding frontmatter)
   * Used for idempotency and change detection
   */
  contentHash: string;

  /**
   * Document description (from frontmatter)
   */
  description?: string;
  /**
   * Frontmatter key-value pairs (null if no frontmatter exists)
   */
  frontmatter: Record<string, unknown> | null;

  /**
   * URL slug derived from file path
   */
  slug: string;

  /**
   * Document title (from frontmatter or first h1)
   */
  title?: string;
}
