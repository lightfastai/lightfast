# lightfast

TypeScript SDK for the Lightfast Neural Memory API - Build AI agents with persistent, contextual memory.

[![npm version](https://img.shields.io/npm/v/lightfast.svg)](https://www.npmjs.com/package/lightfast)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
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

Search through your workspace neural memory using natural language queries.

```typescript
const results = await lightfast.search({
  query: "user authentication flow",
  mode: "balanced", // "fast" | "balanced" | "thorough"
  limit: 10,
  offset: 0,
  includeContext: true,
  includeHighlights: true,
  filters: {
    sourceTypes: ["github"],
    observationTypes: ["commit", "pull_request"],
    actorNames: ["@sarah"],
    dateRange: {
      start: "2024-01-01T00:00:00Z",
      end: "2024-12-31T23:59:59Z",
    },
  },
});

// Response structure
interface V1SearchResponse {
  data: Array<{
    id: string;
    title: string;
    url: string;
    snippet: string;
    score: number;
    source: string; // e.g., "github", "linear"
    type: string; // e.g., "commit", "issue"
    occurredAt?: string;
    entities?: Array<{
      key: string;
      category: string;
    }>;
    references?: Array<{
      type: string;
      id: string;
      url?: string;
      label?: string;
    }>;
    highlights?: {
      title?: string;
      snippet?: string;
    };
  }>;
  context?: {
    clusters?: Array<{
      topic: string | null;
      summary: string | null;
      keywords: string[];
    }>;
    relevantActors?: Array<{
      displayName: string;
      expertiseDomains: string[];
    }>;
  };
  meta: {
    total: number;
    limit: number;
    offset: number;
    took: number;
    mode: "fast" | "balanced" | "thorough";
    paths: {
      vector: boolean;
      entity: boolean;
      cluster: boolean;
      actor: boolean;
    };
  };
  latency: {
    total: number;
    auth?: number;
    parse?: number;
    search?: number;
    embedding?: number;
    retrieval: number;
    entitySearch?: number;
    clusterSearch?: number;
    actorSearch?: number;
    rerank: number;
    enrich?: number;
    maxParallel?: number;
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
  if (item.highlights?.snippet) {
    console.log(`Highlights: ${item.highlights.snippet}`);
  }
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
interface V1ContentsResponse {
  items: Array<{
    id: string;
    title: string | null;
    url: string;
    snippet: string;
    content?: string; // Full content for observations
    source: string;
    type: string;
    occurredAt?: string;
    metadata?: Record<string, unknown>;
  }>;
  missing: string[]; // IDs that were not found
  requestId: string;
}
```

**Example:**
```typescript
const contents = await lightfast.contents({
  ids: ["obs_abc123", "obs_def456"],
});

contents.items.forEach((item) => {
  console.log(`${item.title} (${item.type})`);
  console.log(`Content: ${item.content || item.snippet}`);
  console.log(`URL: ${item.url}`);
});

if (contents.missing.length > 0) {
  console.log("Not found:", contents.missing);
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
interface V1FindSimilarResponse {
  source: {
    id: string;
    title: string;
    type: string;
    cluster?: {
      topic: string | null;
      memberCount: number;
    };
  };
  similar: Array<{
    id: string;
    title: string;
    url: string;
    snippet?: string;
    score: number;
    vectorSimilarity: number;
    entityOverlap?: number;
    sameCluster: boolean;
    source: string;
    type: string;
    occurredAt?: string;
  }>;
  meta: {
    total: number;
    took: number;
    inputEmbedding: {
      found: boolean;
      generated: boolean;
    };
  };
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

console.log(`Finding similar to: ${similar.source.title}`);
console.log(`Found ${similar.meta.total} similar items`);

similar.similar.forEach((item) => {
  console.log(`${item.title} (similarity: ${item.score.toFixed(2)})`);
  console.log(`Vector: ${item.vectorSimilarity.toFixed(2)}`);
  console.log(`Same cluster: ${item.sameCluster}`);
});
```

### `related(request)`

Get observations directly connected to a given observation via relationships.

```typescript
const related = await lightfast.related({
  id: "obs_abc123",
});

// Response structure
interface RelatedResponse {
  data: {
    source: {
      id: string;
      title: string;
      source: string;
    };
    related: Array<{
      id: string;
      title: string;
      source: string;
      type: string;
      occurredAt: string | null;
      url: string | null;
      relationshipType: string;
      direction: "outgoing" | "incoming";
    }>;
    bySource: Record<string, Array<RelatedEvent>>;
  };
  meta: {
    total: number;
    took: number;
  };
  requestId: string;
}
```

**Example:**
```typescript
const related = await lightfast.related({
  id: "obs_abc123",
});

console.log(`Related to: ${related.data.source.title}`);
console.log(`Found ${related.meta.total} related observations`);

// Access all related items
related.data.related.forEach((item) => {
  console.log(`${item.title} (${item.relationshipType}, ${item.direction})`);
  console.log(`Source: ${item.source} | Type: ${item.type}`);
});

// Access by source system
Object.entries(related.data.bySource).forEach(([source, items]) => {
  console.log(`\n${source}: ${items.length} items`);
  items.forEach((item) => console.log(`  - ${item.title}`));
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

// Response structure
interface GraphResponse {
  data: {
    root: {
      id: string;
      title: string;
      source: string;
      type: string;
    };
    nodes: Array<{
      id: string;
      title: string;
      source: string;
      type: string;
      occurredAt: string | null;
      url: string | null;
      isRoot?: boolean;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: string;
      linkingKey: string | null;
      confidence: number;
    }>;
  };
  meta: {
    depth: number;
    nodeCount: number;
    edgeCount: number;
    took: number;
  };
  requestId: string;
}
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
  V1SearchResponse,
  ContentsInput,
  V1ContentsResponse,
  FindSimilarInput,
  V1FindSimilarResponse,
  RelatedInput,
  RelatedResponse,
  GraphInput,
  GraphResponse,
} from "lightfast/types";
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
    discussions: related.data.related,
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

  return similar.similar.filter((item) => item.type === "issue");
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

Full API documentation: [lightfast.ai/docs/api](https://lightfast.ai/docs/api)

## Links

- **Website**: [lightfast.ai](https://lightfast.ai)
- **Documentation**: [lightfast.ai/docs](https://lightfast.ai/docs)
- **GitHub**: [github.com/lightfastai/lightfast](https://github.com/lightfastai/lightfast)
- **npm**: [npmjs.com/package/lightfast](https://www.npmjs.com/package/lightfast)
- **Issues**: [github.com/lightfastai/lightfast/issues](https://github.com/lightfastai/lightfast/issues)

## Related Packages

- **[@lightfastai/mcp](https://www.npmjs.com/package/@lightfastai/mcp)** - Model Context Protocol server for Claude and other AI assistants

## License

Apache-2.0 © [Lightfast](https://lightfast.ai)
