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
   * 0-based chunk index
   */
  index: number;

  /**
   * Chunk text content
   */
  text: string;

  /**
   * Token count for this chunk
   */
  tokens: number;

  /**
   * Byte offset where this chunk starts in the original text
   */
  startOffset: number;

  /**
   * Byte offset where this chunk ends in the original text
   */
  endOffset: number;
}

/**
 * Metadata extracted from MDX files
 */
export interface MDXMetadata {
  /**
   * Frontmatter key-value pairs
   */
  frontmatter: Record<string, unknown>;

  /**
   * Document title (from frontmatter or first h1)
   */
  title?: string;

  /**
   * Document description (from frontmatter)
   */
  description?: string;

  /**
   * URL slug derived from file path
   */
  slug: string;

  /**
   * SHA-256 hash of the content (excluding frontmatter)
   * Used for idempotency and change detection
   */
  contentHash: string;
}
