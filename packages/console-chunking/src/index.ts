/**
 * @repo/console-chunking
 *
 * Text chunking, MDX parsing, and content hashing utilities
 *
 * @packageDocumentation
 */

// Export types
export type { Chunk, ChunkOptions, MDXMetadata } from "./types";

// Export chunking functions
export { chunkText, countTokens } from "./chunk";

// Export MDX parsing
export { parseMDX } from "./mdx";

// Export slug utilities
export { deriveSlug } from "./slug";

// Export hashing utilities
export { hashContent } from "./hash";
