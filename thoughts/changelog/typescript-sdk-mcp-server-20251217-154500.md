---
title: 'TypeScript SDK, MCP Server'
slug: 0-5-lightfast-typescript-sdk-mcp-server
publishedAt: '2025-12-17'
excerpt: >-
  Integrate Lightfast neural memory into your applications with the official
  TypeScript SDK and MCP Server. Zero-dependency SDK with full TypeScript
  support. MCP integration brings semantic search to Claude, Cursor, and other
  AI assistants.
tldr: >-
  The Lightfast TypeScript SDK provides a type-safe client for neural memory
  search, contents retrieval, and similarity matching. Zero dependencies, works
  with Node.js 18+. The companion MCP Server exposes these capabilities to AI
  assistants like Claude Desktop, Claude Code, and Cursor through three tools:
  lightfast_search, lightfast_contents, and lightfast_find_similar. Both
  packages are in alpha (v0.1.0-alpha.1) and available on npm.
infrastructure:
  - Published `lightfast` SDK package to npm with ESM-only distribution
  - Published `@lightfastai/mcp` server package with stdio transport
  - Added comprehensive error handling with typed error classes
seo:
  metaDescription: >-
    Lightfast TypeScript SDK and MCP Server for neural memory integration.
    Type-safe API client and AI assistant tools for semantic code search. Alpha
    release.
  focusKeyword: typescript sdk neural memory
  secondaryKeyword: mcp server ai assistant
  faq:
    - question: How do I install the Lightfast TypeScript SDK?
      answer: >-
        Install with npm: `npm install lightfast`. Initialize with your API key:
        `const client = new Lightfast({ apiKey: 'sk_...' })`. The SDK requires
        Node.js 18+ and has zero runtime dependencies.
    - question: What is the Lightfast MCP Server?
      answer: >-
        The MCP Server exposes Lightfast neural memory to AI assistants via the
        Model Context Protocol. It provides three tools: lightfast_search for
        semantic queries, lightfast_contents for document retrieval, and
        lightfast_find_similar for similarity matching. Works with Claude
        Desktop, Claude Code, and Cursor.
    - question: What API methods does the TypeScript SDK support?
      answer: >-
        The SDK provides three methods: search() for natural language queries
        across your workspace, contents() to fetch full documents by ID, and
        findSimilar() to discover semantically related content by ID or URL.
_internal:
  status: published
  source_prs:
    - 'Manual input: TypeScript SDK, MCP Server'
  generated: '2025-12-17T15:45:00Z'
  fact_checked_files:
    - 'core/lightfast/src/client.ts:45-188'
    - 'core/lightfast/src/types.ts:1-89'
    - 'core/lightfast/src/errors.ts:1-100'
    - core/lightfast/package.json
    - 'core/mcp/src/server.ts:1-82'
    - 'core/mcp/src/index.ts:1-77'
    - core/mcp/package.json
  publishedAt: '2025-12-17T07:35:32.504Z'
---

**Official TypeScript client and MCP Server for Lightfast neural memory**

---

### TypeScript SDK

A type-safe client for the Lightfast Neural Memory API. Search your workspace, retrieve documents, and find similar content with full TypeScript support.

**What's included:**
- `search()` — Natural language queries with configurable rerank modes (fast/balanced/thorough)
- `contents()` — Fetch full document content by ID
- `findSimilar()` — Discover semantically related content by ID or URL
- Comprehensive error handling with typed error classes
- Zero runtime dependencies

**Status:** Alpha (v0.1.0-alpha.1). API may change before 1.0.

**Installation:**

```bash
npm install lightfast
```

**Example:**

```typescript
import { Lightfast } from 'lightfast';

const client = new Lightfast({
  apiKey: process.env.LIGHTFAST_API_KEY,
});

// Semantic search across your workspace
const results = await client.search({
  query: 'authentication flow implementation',
  limit: 10,
  mode: 'balanced',
});

// Fetch full content
const contents = await client.contents({
  ids: ['doc_abc123', 'obs_xyz789'],
});

// Find similar documents
const similar = await client.findSimilar({
  url: 'https://github.com/org/repo/blob/main/src/auth.ts',
  limit: 5,
});
```

**Error handling:**

```typescript
import {
  Lightfast,
  AuthenticationError,
  RateLimitError
} from 'lightfast';

try {
  await client.search({ query: 'test' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Invalid or expired API key
  } else if (error instanceof RateLimitError) {
    // Wait until error.retryAfter
  }
}
```

---

### MCP Server

Bring neural memory to your AI assistant. The MCP Server exposes Lightfast search capabilities to Claude Desktop, Claude Code, Cursor, and any MCP-compatible client.

**What's included:**
- `lightfast_search` — Semantic search across workspace memory
- `lightfast_contents` — Fetch documents by ID
- `lightfast_find_similar` — Find related content
- Stdio transport for MCP protocol communication
- Works with Claude Desktop, Claude Code, Cursor, OpenAI Codex

**Status:** Alpha (v0.1.0-alpha.1). Requires valid API key.

**Installation:**

```bash
npm install -g @lightfastai/mcp
```

**Claude Code configuration** (`.mcp.json`):

```json
{
  "mcpServers": {
    "lightfast": {
      "command": "npx",
      "args": ["@lightfastai/mcp"],
      "env": {
        "LIGHTFAST_API_KEY": "sk_live_..."
      }
    }
  }
}
```

**Claude Desktop configuration:**

```json
{
  "mcpServers": {
    "lightfast": {
      "command": "npx",
      "args": ["@lightfastai/mcp", "--api-key", "sk_live_..."]
    }
  }
}
```

Once configured, your AI assistant can search your codebase contextually:

> "Find the authentication implementation in our codebase"
>
> "What files are similar to this error handler?"

---

### Why We Built It This Way

The SDK is ESM-only with zero dependencies to minimize bundle size and ensure compatibility with modern Node.js environments. We chose native `fetch` over HTTP client libraries to reduce attack surface and simplify dependency management.

The MCP Server uses stdio transport to integrate seamlessly with existing AI assistant infrastructure. Each tool maps directly to the SDK methods, providing consistent behavior whether you're calling the API programmatically or through your AI assistant.

---

### Limitations

- **Alpha status**: Both packages are v0.1.0-alpha.1. APIs may change before stable release.
- **Node.js 18+ required**: Uses native `fetch` API
- **API key authentication only**: No OAuth or other auth methods currently supported
- **Online only**: Requires internet connection to Lightfast API

---

### Resources

- [SDK Documentation](/docs/integrate/sdk)
- [MCP Setup Guide](/docs/integrate/mcp)
- [API Reference](/docs/api)
- [Quick Start](/docs/quick-start)
