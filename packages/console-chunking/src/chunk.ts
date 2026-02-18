/**
 * Token-based text chunking algorithm
 *
 * Chunks text into smaller pieces while respecting semantic boundaries
 * and maintaining token count limits.
 */

import type { Tiktoken } from "js-tiktoken";
import { encodingForModel } from "js-tiktoken";
import type { Chunk, ChunkOptions } from "./types";

// Cache the encoder to avoid recreating it for every chunk operation
let encoder: Tiktoken | undefined = undefined;

/**
 * Get or create the tiktoken encoder for GPT-4 (cl100k_base)
 */
function getEncoder(): Tiktoken {
  encoder ??= encodingForModel("gpt-4");
  return encoder;
}

/**
 * Count tokens in a text string using GPT-4 tokenizer
 *
 * @param text - Text to count tokens for
 * @returns Number of tokens
 */
export function countTokens(text: string): number {
  const enc = getEncoder();
  return enc.encode(text).length;
}

/**
 * Chunk text into smaller pieces with token limits
 *
 * Features:
 * - Token-based chunking using GPT-4 tokenizer (cl100k_base)
 * - Configurable overlap between chunks
 * - Optional semantic boundary preservation (paragraphs, code blocks)
 * - Tracks byte offsets for each chunk
 *
 * @param text - Text to chunk
 * @param options - Chunking options (optional)
 * @returns Array of chunks with metadata
 *
 * @example
 * ```typescript
 * const chunks = chunkText("Long document text...", {
 *   maxTokens: 512,
 *   overlap: 50,
 *   preserveBoundaries: true
 * });
 * // Returns: [
 * //   { index: 0, text: "...", tokens: 512, startOffset: 0, endOffset: 2048 },
 * //   { index: 1, text: "...", tokens: 512, startOffset: 1900, endOffset: 3948 },
 * //   ...
 * // ]
 * ```
 */
export function chunkText(
  text: string,
  options?: Partial<ChunkOptions>,
): Chunk[] {
  // Default options
  const opts: ChunkOptions = {
    maxTokens: options?.maxTokens ?? 512,
    overlap: options?.overlap ?? 50,
    preserveBoundaries: options?.preserveBoundaries ?? true,
  };

  // Handle empty text
  if (text.length === 0) {
    return [];
  }

  const chunks: Chunk[] = [];

  // If text is small enough to fit in one chunk, return it as is
  const totalTokens = countTokens(text);
  if (totalTokens <= opts.maxTokens) {
    return [
      {
        index: 0,
        text,
        tokens: totalTokens,
        startOffset: 0,
        endOffset: Buffer.byteLength(text, "utf-8"),
      },
    ];
  }

  // Split text into segments if preserveBoundaries is enabled
  const segments = opts.preserveBoundaries
    ? splitIntoSegments(text)
    : [text];

  let currentChunk = "";
  let currentTokens = 0;
  let currentStartOffset = 0;
  let chunkIndex = 0;
  let segmentOffset = 0;

  for (const segment of segments) {
    const segmentTokens = countTokens(segment);

    // If segment alone exceeds max tokens, split it further
    if (segmentTokens > opts.maxTokens) {
      // Save current chunk if it has content
      if (currentChunk.length > 0) {
        chunks.push({
          index: chunkIndex++,
          text: currentChunk.trim(),
          tokens: currentTokens,
          startOffset: currentStartOffset,
          endOffset: segmentOffset,
        });
        currentChunk = "";
        currentTokens = 0;
      }

      // Split large segment by characters
      const largeChunks = splitLargeSegment(segment, opts.maxTokens);
      for (const chunk of largeChunks) {
        const chunkTokens = countTokens(chunk);
        chunks.push({
          index: chunkIndex++,
          text: chunk.trim(),
          tokens: chunkTokens,
          startOffset: segmentOffset,
          endOffset: segmentOffset + Buffer.byteLength(chunk, "utf-8"),
        });
        segmentOffset += Buffer.byteLength(chunk, "utf-8");
      }

      currentStartOffset = segmentOffset;
      continue;
    }

    // Check if adding this segment would exceed max tokens
    const potentialTokens = currentTokens + segmentTokens;
    if (potentialTokens > opts.maxTokens && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.trim(),
        tokens: currentTokens,
        startOffset: currentStartOffset,
        endOffset: segmentOffset,
      });

      // Start new chunk with overlap
      if (opts.overlap > 0) {
        // Find overlap text from previous chunk
        const overlapText = findOverlapText(currentChunk, opts.overlap);
        currentChunk = overlapText + segment;
        currentTokens = countTokens(currentChunk);
        currentStartOffset =
          segmentOffset - Buffer.byteLength(overlapText, "utf-8");
      } else {
        currentChunk = segment;
        currentTokens = segmentTokens;
        currentStartOffset = segmentOffset;
      }
    } else {
      // Add segment to current chunk
      currentChunk += segment;
      currentTokens = potentialTokens;
    }

    segmentOffset += Buffer.byteLength(segment, "utf-8");
  }

  // Add final chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push({
      index: chunkIndex,
      text: currentChunk.trim(),
      tokens: currentTokens,
      startOffset: currentStartOffset,
      endOffset: segmentOffset,
    });
  }

  return chunks;
}

/**
 * Split text into semantic segments (paragraphs and code blocks)
 *
 * Preserves:
 * - Double newline (paragraph breaks)
 * - Triple backtick code blocks
 */
function splitIntoSegments(text: string): string[] {
  const segments: string[] = [];
  let currentSegment = "";
  let inCodeBlock = false;

  const lines = text.split("\n");

  for (const line of lines) {

    // Check for code block markers
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      currentSegment += line + "\n";
      continue;
    }

    // Inside code block, keep adding lines
    if (inCodeBlock) {
      currentSegment += line + "\n";
      continue;
    }

    // Empty line indicates paragraph break
    if (line.trim().length === 0 && currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = "\n";
      continue;
    }

    // Add line to current segment
    currentSegment += line + "\n";
  }

  // Add final segment
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments.filter((s) => s.trim().length > 0);
}

/**
 * Split a large segment that exceeds maxTokens into smaller chunks
 */
function splitLargeSegment(segment: string, maxTokens: number): string[] {
  const chunks: string[] = [];
  const enc = getEncoder();

  // Encode the entire segment
  const tokens = enc.encode(segment);

  // Split tokens into chunks
  for (let i = 0; i < tokens.length; i += maxTokens) {
    const chunkTokens = tokens.slice(i, i + maxTokens);
    const chunkText = enc.decode(chunkTokens);
    chunks.push(chunkText);
  }

  return chunks;
}

/**
 * Find overlap text from the end of a chunk (approximately N tokens)
 */
function findOverlapText(chunk: string, overlapTokens: number): string {
  if (overlapTokens === 0) return "";

  const enc = getEncoder();
  const tokens = enc.encode(chunk);

  // Take last N tokens
  const overlapTokenSlice = tokens.slice(-overlapTokens);
  return enc.decode(overlapTokenSlice);
}
