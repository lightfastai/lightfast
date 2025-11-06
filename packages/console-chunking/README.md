# @repo/console-chunking

Text chunking, MDX parsing, and content hashing utilities.

## Purpose

Provides utilities for:
- Token-based text chunking with configurable options
- MDX frontmatter extraction and metadata parsing
- Content hashing (SHA-256) for change detection
- Slug/URL derivation from file paths

## Installation

This is an internal workspace package. Install dependencies from the monorepo root:

```bash
pnpm install
```

## Usage

```typescript
import { chunkText, parseMDX, hashContent, deriveSlug } from "@repo/console-chunking";

// Chunk text
const chunks = chunkText(text, {
  maxTokens: 512,
  overlap: 50,
  preserveBoundaries: true
});

// Parse MDX file
const metadata = await parseMDX("/docs/intro.mdx", content);

// Hash content
const hash = hashContent(content);

// Derive slug
const slug = deriveSlug("docs/getting-started.md", "docs");
// => "/getting-started"
```

## Chunking Strategy

- Default: 512 tokens per chunk, 50 token overlap
- Preserves semantic boundaries (paragraphs, code blocks)
- Uses tiktoken for accurate token counting (GPT-4 encoding)

## Documentation

For implementation details, see the package structure documentation.
