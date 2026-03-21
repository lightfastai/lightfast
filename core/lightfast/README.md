# lightfast

TypeScript SDK for the Lightfast API — surface every decision your team makes across your tools, searchable, cited, and ready for people and agents.

[![npm version](https://img.shields.io/npm/v/lightfast.svg)](https://www.npmjs.com/package/lightfast)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

## Features

- **Semantic Search** - Find relevant memories using natural language queries
- **Context Retrieval** - Fetch full document content and observations
- **Smart Ranking** - Built-in relevance scoring with multiple search modes
- **Related Memories** - Discover connected observations and documents
- **Graph Traversal** - Explore memory relationships and connections
- **TypeScript First** - Full type safety with Zod schema validation
- **Zero Dependencies** - Minimal footprint with only Zod runtime dependency

## Installation

```bash
npm install lightfast
# or
pnpm add lightfast
# or
yarn add lightfast
```

## Quick Start

```typescript
import { Lightfast } from "lightfast";

const lightfast = new Lightfast({
  apiKey: "sk-lf-...", // Get your API key from lightfast.ai
});

// Search your workspace memory
const results = await lightfast.search({
  query: "authentication implementation",
  limit: 10,
});

console.log(results.data); // Array of search results
console.log(results.meta.total); // Total matching results
```

## Authentication

Get your API key from [lightfast.ai](https://lightfast.ai):

1. Sign in to your workspace
2. Navigate to Settings → API Keys
3. Create a new API key

API keys start with `sk-lf-` prefix.

## Core Methods

### `search(request)`

Search through your workspace using natural language queries.

```typescript
const results = await lightfast.search({
  query: "user authentication flow",
  mode: "balanced", // "fast" | "balanced" | "thorough"
  limit: 10,
  offset: 0,
  filters: {
    sourceTypes: ["github"],
    observationTypes: ["commit", "pull_request"],
    dateRange: {
      start: "2024-01-01T00:00:00Z",
      end: "2024-12-31T23:59:59Z",
    },
  },
});

// Response structure
interface SearchResponse {
  data: Array<{
    id: string;
    title: string;
    url: string | null;
    snippet: string;
    score: number;
    source: string; // e.g., "github", "linear"
    type: string; // e.g., "commit", "issue"
    occurredAt: string | null;
    entities?: Array<{ key: string; category: string }>;
    references?: Array<{ type: string; id: string; url?: string; label?: string }>;
    latestAction?: string;
    totalEvents?: number;
  }>;
  context?: {
    clusters?: Array<{
      topic: string | null;
      summary: string | null;
      keywords: string[];
    }>;
  };
  meta: {
    total: number;
    limit: number;
    offset: number;
    took: number;
    mode: "fast" | "balanced" | "thorough";
    paths: { vector: boolean; entity: boolean; cluster: boolean };
  };
  latency?: {
    total: number;
    retrieval: number;
    rerank: number;
    embedding?: number;
    enrich?: number;
  };
  requestId: string;
}
```

**Search Modes:**
- `fast` - No reranking, vector scores only (~50ms)
- `balanced` (default) - Cohere reranking (~130ms)
- `thorough` - LLM-based scoring (~600ms)

**Example:**
```typescript
// Search with filters and context
const results = await lightfast.search({
  query: "bug fixes in authentication",
  mode: "thorough",
  limit: 5,
  filters: {
    observationTypes: ["commit"],
    dateRange: {
      start: "2024-11-01T00:00:00Z",
    },
  },
});

// Access results
results.data.forEach((item) => {
  console.log(`${item.title} (score: ${item.score})`);
  console.log(`Source: ${item.source} | Type: ${item.type}`);
  console.log(`Snippet: ${item.snippet}`);
});

// Check context
if (results.context?.clusters) {
  console.log("Related topics:", results.context.clusters);
}

console.log(`Found ${results.meta.total} total results`);
console.log(`Request took ${results.meta.took}ms`);
```

### `contents(request)`

Fetch full content for documents and observations by ID.

```typescript
const contents = await lightfast.contents({
  ids: ["obs_abc123", "doc_xyz789"],
});

// Response structure
interface ContentsResponse {
  data: {
    items: Array<{
      id: string;
      title: string;
      url: string | null;
      snippet: string;
      content?: string;
      source: string;
      type: string;
      occurredAt: string | null;
      metadata?: Record<string, unknown>;
    }>;
    missing: string[]; // IDs that were not found
  };
  meta: { total: number };
  requestId: string;
}
```

**Example:**
```typescript
const contents = await lightfast.contents({
  ids: ["obs_abc123", "obs_def456"],
});

contents.data.items.forEach((item) => {
  console.log(`${item.title} (${item.type})`);
  console.log(`Content: ${item.content || item.snippet}`);
  if (item.url) console.log(`URL: ${item.url}`);
});

if (contents.data.missing.length > 0) {
  console.log("Not found:", contents.data.missing);
}
```

### `findSimilar(request)`

Find documents and observations similar to a given item.

```typescript
const similar = await lightfast.findSimilar({
  id: "obs_abc123",
  limit: 5,
  threshold: 0.7,
  sameSourceOnly: false,
  excludeIds: ["obs_abc123"],
});

// Response structure
interface FindSimilarResponse {
  data: {
    source: { id: string; title: string; type: string };
    similar: Array<{
      id: string;
      title: string;
      url: string | null;
      snippet?: string;
      score: number;
      similarity: number;
      entityOverlap?: number;
      source: string;
      type: string;
      occurredAt: string | null;
    }>;
  };
  meta: { total: number; took: number };
  requestId: string;
}
```

**Example:**
```typescript
const similar = await lightfast.findSimilar({
  id: "obs_abc123",
  limit: 10,
  threshold: 0.75,
  sameSourceOnly: true,
});

console.log(`Finding similar to: ${similar.data.source.title}`);
console.log(`Found ${similar.meta.total} similar items`);

similar.data.similar.forEach((item) => {
  console.log(`${item.title} (similarity: ${item.similarity.toFixed(2)})`);
});
```

### `related(request)`

Get observations directly connected to a given observation via relationships.

```typescript
const related = await lightfast.related({
  id: "obs_abc123",
});

// Response structure (same shape as graph())
interface RelatedResponse {
  data: {
    root: { id: string; title: string; source: string; type: string; url: string | null; occurredAt: string | null };
    nodes: Array<{ id: string; title: string; source: string; type: string; url: string | null; occurredAt: string | null; isRoot?: boolean }>;
    edges: Array<{ source: string; target: string; type: string; linkingKey: string | null; confidence: number }>;
  };
  meta: { depth: number; nodeCount: number; edgeCount: number; took: number };
  requestId: string;
}
```

**Example:**
```typescript
const related = await lightfast.related({
  id: "obs_abc123",
});

console.log(`Root: ${related.data.root.title}`);
console.log(`Nodes: ${related.meta.nodeCount}, Edges: ${related.meta.edgeCount}`);

related.data.nodes.forEach((node) => {
  console.log(`${node.title} (${node.type})`);
  console.log(`Source: ${node.source}`);
});
```

### `graph(request)`

Traverse the relationship graph to explore connections.

```typescript
const graph = await lightfast.graph({
  id: "obs_abc123",
  depth: 2,
  types: ["references", "mentioned_in"],
});

// Response structure — same RelatedResponse shape as related()
```

**Example:**
```typescript
const graph = await lightfast.graph({
  id: "obs_abc123",
  depth: 2,
  types: ["references"], // Optional: filter relationship types
});

console.log(`Graph from: ${graph.data.root.title}`);
console.log(`Nodes: ${graph.meta.nodeCount}, Edges: ${graph.meta.edgeCount}`);

// Build adjacency map
const adjacency = new Map<string, string[]>();
graph.data.edges.forEach((edge) => {
  if (!adjacency.has(edge.source)) {
    adjacency.set(edge.source, []);
  }
  adjacency.get(edge.source)!.push(edge.target);
});

// Find all nodes connected to root
const connectedIds = adjacency.get(graph.data.root.id) || [];
const connectedNodes = graph.data.nodes.filter((n) =>
  connectedIds.includes(n.id)
);

console.log(`Direct connections: ${connectedNodes.length}`);
connectedNodes.forEach((node) => {
  console.log(`  - ${node.title} (${node.type})`);
});
```

## Configuration

```typescript
const lightfast = new Lightfast({
  apiKey: "sk-lf-...", // Required
  baseUrl: "https://lightfast.ai", // Optional, default: https://lightfast.ai
  timeout: 30000, // Optional, default: 30000ms (30s)
});
```

## Error Handling

The SDK provides typed error classes for different failure scenarios:

```typescript
import {
  AuthenticationError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
  ValidationError,
  LightfastError,
} from "lightfast/errors";

try {
  const results = await lightfast.search({ query: "test" });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error("Invalid API key:", error.message);
  } else if (error instanceof RateLimitError) {
    console.error("Rate limit exceeded:", error.message);
  } else if (error instanceof ValidationError) {
    console.error("Invalid request:", error.details);
  } else if (error instanceof NetworkError) {
    console.error("Network error:", error.message);
  } else if (error instanceof LightfastError) {
    console.error("API error:", error.message, error.requestId);
  }
}
```

**Error Types:**

| Error Class | Status Code | Description |
|------------|-------------|-------------|
| `AuthenticationError` | 401 | Invalid or missing API key |
| `NotFoundError` | 404 | Resource not found |
| `ValidationError` | 400/422 | Invalid request parameters |
| `RateLimitError` | 429 | Too many requests |
| `ServerError` | 500+ | Server-side error |
| `NetworkError` | - | Network/timeout error |

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import type {
  LightfastConfig,
  SearchInput,
  SearchResponse,
  ContentsInput,
  ContentsResponse,
  FindSimilarInput,
  FindSimilarResponse,
  RelatedInput,
  RelatedResponse,
  GraphInput,
} from "lightfast";
```

## Environment Variables

For serverless and edge environments:

```bash
LIGHTFAST_API_KEY=sk-lf-...
LIGHTFAST_BASE_URL=https://lightfast.ai  # Optional
```

```typescript
const lightfast = new Lightfast({
  apiKey: process.env.LIGHTFAST_API_KEY!,
});
```

## Examples

### Building a RAG System

```typescript
import { Lightfast } from "lightfast";

const lightfast = new Lightfast({ apiKey: process.env.LIGHTFAST_API_KEY! });

async function answerQuestion(question: string) {
  // 1. Search for relevant context
  const results = await lightfast.search({
    query: question,
    mode: "thorough",
    limit: 5,
  });

  // 2. Extract content
  const context = results.data.map((item) => item.snippet).join("\n\n");

  // 3. Generate answer with LLM (using your preferred LLM SDK)
  // const answer = await llm.complete({
  //   prompt: `Context: ${context}\n\nQuestion: ${question}`,
  // });

  return { context: results.data, answer };
}
```

### Smart Code Assistant

```typescript
async function getRelatedCode(filePath: string) {
  // Search for the file
  const searchResults = await lightfast.search({
    query: filePath,
    filters: { observationTypes: ["file"] },
    limit: 1,
  });

  if (searchResults.data.length === 0) {
    return null;
  }

  const observationId = searchResults.data[0].id;

  // Get related observations (commits, PRs, discussions)
  const related = await lightfast.related({
    id: observationId,
  });

  return {
    file: searchResults.data[0],
    relatedNodes: related.data.nodes,
  };
}
```

### Finding Similar Issues

```typescript
async function findSimilarIssues(issueId: string) {
  const similar = await lightfast.findSimilar({
    id: issueId,
    limit: 10,
    threshold: 0.75,
    filters: {
      observationTypes: ["issue"],
    },
  });

  return similar.data.similar.filter((item) => item.type === "issue");
}
```

### Exploring Memory Graph

```typescript
async function exploreConnections(observationId: string) {
  const graph = await lightfast.graph({
    id: observationId,
    depth: 2,
  });

  // Build visualization data
  return {
    root: graph.data.root,
    nodes: graph.data.nodes,
    edges: graph.data.edges,
    stats: graph.meta,
  };
}
```

## Advanced Usage

### Factory Function

Use the factory function for dependency injection:

```typescript
import { createLightfast } from "lightfast";

const lightfast = createLightfast({
  apiKey: process.env.LIGHTFAST_API_KEY!,
});
```

### Custom Base URL

For self-hosted or enterprise deployments:

```typescript
const lightfast = new Lightfast({
  apiKey: "sk-lf-...",
  baseUrl: "https://api.your-domain.com",
});
```

### Request Timeouts

Configure timeout for long-running queries:

```typescript
const lightfast = new Lightfast({
  apiKey: "sk-lf-...",
  timeout: 60000, // 60 seconds
});
```

## Requirements

- **Node.js** >= 18
- **TypeScript** >= 5.0 (optional, for type definitions)

## API Reference

Full API documentation: [lightfast.ai/docs/api-reference/getting-started/overview](https://lightfast.ai/docs/api-reference/getting-started/overview)

## Links

- **Website**: [lightfast.ai](https://lightfast.ai)
- **Documentation**: [lightfast.ai/docs/get-started/overview](https://lightfast.ai/docs/get-started/overview)
- **GitHub**: [github.com/lightfastai/lightfast](https://github.com/lightfastai/lightfast)
- **npm**: [npmjs.com/package/lightfast](https://www.npmjs.com/package/lightfast)
- **Issues**: [github.com/lightfastai/lightfast/issues](https://github.com/lightfastai/lightfast/issues)

## Related Packages

- **[@lightfastai/mcp](https://www.npmjs.com/package/@lightfastai/mcp)** - Model Context Protocol server for Claude and other AI assistants

## License

MIT © [Lightfast](https://lightfast.ai)
