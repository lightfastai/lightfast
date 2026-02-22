# Lightfast

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![License: FSL-1.1](https://img.shields.io/badge/License-FSL--1.1-orange.svg)](LICENSE-FSL.md)
[![npm version](https://img.shields.io/npm/v/lightfast.svg)](https://www.npmjs.com/package/lightfast)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![CI Status](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml/badge.svg)](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/stargazers)

**Lightfast is the memory layer for teams. Every decision across your tools — surfaced, cited, and ready for people and agents.**

> **Early Access** — Lightfast is currently in early access. [Request access →](https://lightfast.ai/early-access)

[Website](https://lightfast.ai) · [Documentation](https://lightfast.ai/docs/get-started/overview) · [Chat Demo](https://chat.lightfast.ai) · [Discord](https://discord.gg/YqPDfcar2C)

## Why Lightfast?

Every team generates decisions across PRs, docs, incidents, and conversations — but that knowledge gets buried. Lightfast surfaces it all so engineers and AI agents can:

- **Search by meaning** — not just keywords
- **Get cited answers** — trace every decision back to its source
- **Power agents** — production-ready retrieval for people and AI alike

## Supported Sources

**Available now:**
- **GitHub** — Pull requests, issues, code, discussions
- **Vercel** — Deployments, logs, project activity

**Coming soon:**
- Linear, Sentry, Slack, Notion, Confluence
- PlanetScale, Pulumi, Terraform, Zendesk
- [Request an integration →](https://github.com/lightfastai/lightfast/issues)

## Use Cases

```typescript
// "Why did we choose Postgres over MongoDB?"
await lightfast.search({ query: "database selection decision postgres mongodb" });

// "How does our payment integration work?"
await lightfast.search({ query: "stripe payment flow implementation" });

// "What broke in last week's deployment?"
await lightfast.search({ query: "production incident postmortem", filters: { dateRange: "7d" } });

// "Find PRs similar to this refactor"
await lightfast.findSimilar({ url: "https://github.com/org/repo/pull/123" });

// "What do we know about rate limiting?"
await lightfast.search({ query: "rate limiting implementation patterns" });
```

**Example response:**

```json
{
  "results": [
    {
      "id": "doc_abc123",
      "type": "pull_request",
      "title": "Add rate limiting to API endpoints",
      "snippet": "Implemented token bucket algorithm with Redis...",
      "score": 0.92,
      "source": "github",
      "url": "https://github.com/org/repo/pull/456",
      "metadata": { "author": "jane", "mergedAt": "2024-12-01" }
    }
  ],
  "meta": { "total": 24, "latency": { "total": 145 } }
}
```

## Security

- **Your code stays yours** — We index metadata and content for search, never train on your data
- **Encrypted at rest and in transit** — Industry-standard security practices
- **Role-based access** — Workspace permissions mirror your source permissions
- **Self-hosted option** — Coming soon for enterprises with strict data residency requirements

## Requirements

- Node.js >= 18
- A Lightfast API key ([request access](https://lightfast.ai/early-access))

## Integrate in 2 Ways

### 1. TypeScript SDK

Install the `lightfast` package to add semantic search to any application:

```bash
npm install lightfast
```

```typescript
import { Lightfast } from "lightfast";

// Pass API key directly or use LIGHTFAST_API_KEY environment variable
const lightfast = new Lightfast({ apiKey: process.env.LIGHTFAST_API_KEY });

// Search your workspace memory
const results = await lightfast.search({
  query: "how does authentication work",
  limit: 10,
});

// Get full document content
const content = await lightfast.contents({
  ids: ["doc_abc123"],
});

// Find similar documents
const similar = await lightfast.findSimilar({
  id: "doc_abc123",
  threshold: 0.7,
});
```

### 2. MCP Server (Claude, Cursor, Codex)

Connect AI assistants directly to your workspace memory via [Model Context Protocol](https://modelcontextprotocol.io/).

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lightfast": {
      "command": "npx",
      "args": ["-y", "@lightfastai/mcp"],
      "env": {
        "LIGHTFAST_API_KEY": "sk-lf-..."
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Code (CLI)</strong></summary>

Add to `.mcp.json` in your project root (or `~/.claude.json` for global):

```json
{
  "mcpServers": {
    "lightfast": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@lightfastai/mcp"],
      "env": {
        "LIGHTFAST_API_KEY": "sk-lf-..."
      }
    }
  }
}
```

Or use the CLI: `claude mcp add lightfast --scope project -- npx -y @lightfastai/mcp`

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "lightfast": {
      "command": "npx",
      "args": ["-y", "@lightfastai/mcp"],
      "env": {
        "LIGHTFAST_API_KEY": "sk-lf-..."
      }
    }
  }
}
```

</details>

<details>
<summary><strong>OpenAI Codex</strong></summary>

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.lightfast]
command = "npx"
args = ["-y", "@lightfastai/mcp"]

[mcp_servers.lightfast.env]
LIGHTFAST_API_KEY = "sk-lf-..."
```

</details>

**Available tools:**
- `lightfast_search` — Search workspace memory
- `lightfast_contents` — Fetch full document content
- `lightfast_find_similar` — Find semantically similar documents

## Get an API Key

1. [Request early access](https://lightfast.ai/early-access) to join the waitlist
2. Create a workspace and connect your sources (GitHub, docs, etc.)
3. Generate an API key from your workspace settings

## Documentation

- [API Reference](https://lightfast.ai/docs/api) — Full endpoint documentation
- [SDK Guide](https://lightfast.ai/docs/integrate/sdk) — TypeScript SDK usage
- [MCP Setup](https://lightfast.ai/docs/integrate/mcp) — Configure AI assistants
- [Changelog](https://lightfast.ai/changelog) — Latest updates and releases
- [Blog](https://lightfast.ai/blog) — Tutorials, announcements, and deep dives

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/lightfastai/lightfast.git
cd lightfast
pnpm install
pnpm dev
```

## Community

- [Discord](https://discord.gg/YqPDfcar2C) — Chat with the team and community
- [GitHub Issues](https://github.com/lightfastai/lightfast/issues) — Report bugs and request features
- [Twitter](https://x.com/lightfastai) — Follow for updates

## License

Lightfast uses a dual licensing approach:

All components are licensed under [Apache License 2.0](LICENSE) — a permissive open source license.

**For Users**: You're covered by Apache-2.0 for all Lightfast components — use freely in commercial and non-commercial projects.

See [LICENSING.md](LICENSING.md) for complete details.
