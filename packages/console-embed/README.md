# @repo/console-embed

Embedding computation with swappable providers.

## Purpose

Provides utilities for:
- Generating embeddings from text
- Swappable embedding providers (char-hash, OpenAI, etc.)
- Batch processing to avoid rate limits
- Consistent embedding interface across providers

## Installation

This is an internal workspace package. Install dependencies from the monorepo root:

```bash
pnpm install
```

## Usage

**Phase 1: Character Hash (1536-dimensional)**

```typescript
import { CharHashEmbedding } from "@repo/console-embed/char-hash";

const provider = new CharHashEmbedding();

// Generate embeddings
const result = await provider.embed(["Hello world", "Another document"]);
// result.embeddings: number[][] (1536-dim each)
```

**Phase 2: Model-based (Future)**

```typescript
import { OpenAIEmbedding } from "@repo/console-embed/model";

const provider = new OpenAIEmbedding();
const result = await provider.embed(texts);
```

**Batch Processing:**

```typescript
import { embedBatch } from "@repo/console-embed/batch";

// Process large text arrays in batches
const embeddings = await embedBatch(texts, provider, 100);
```

## Providers

### Phase 1: char-hash-1536
- Deterministic, fast, no API calls
- 1536-dimensional vectors
- Based on character frequencies and n-grams

### Phase 2: Model-based (Future)
- OpenAI text-embedding-3-small
- Anthropic embeddings
- Configurable via environment

## Documentation

For embedding details, see [docs/architecture/phase1/mastra-integration.md](../../docs/architecture/phase1/mastra-integration.md).
