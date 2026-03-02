# Lightfast

[![License: FSL-1.1-ALv2](https://img.shields.io/badge/License-FSL--1.1--ALv2-orange.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/lightfast.svg)](https://www.npmjs.com/package/lightfast)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![CI Status](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml/badge.svg)](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/stargazers)

**An operating infrastructure between your agents and apps.**

[Website](https://lightfast.ai) · [Documentation](https://lightfast.ai/docs/get-started/overview) · [Discord](https://discord.gg/YqPDfcar2C)

## Why Lightfast?

Your team's work happens across dozens of tools. Your agents need to understand and act across all of them. Lightfast is the layer in between — it observes what's happening, remembers what happened, and gives agents and people a single system to operate through.

- **Observe** — Ingest every event across your tools, automatically and continuously
- **Remember** — Search by meaning across everything that happened, always citing sources
- **Act** — Agents express intent, the system resolves what to do and where

## Rollout

Lightfast ships in three phases. Each builds on the last.

### Events — Available now

A unified event system across your tools. Connect your sources, receive structured events in real time. No waitlist.

**Supported sources:**
- **GitHub** — Push, pull requests, issues, code reviews
- **Vercel** — Deployments, project activity
- **Sentry** — Errors, issues, alerts
- **Linear** — Issues, comments, projects, cycles

**Coming soon:**
- Slack, Notion, Confluence, PagerDuty
- [Request an integration →](https://github.com/lightfastai/lightfast/issues)

### Memory — Coming soon

Semantic search and cited answers across your entire tool stack. Everything from the event system gets indexed, connected, and made searchable by meaning. Powered by the same event pipeline — no additional setup.

```typescript
// "What broke in last week's deployment?"
await lightfast.search({ query: "production incident deployment", filters: { dateRange: "7d" } });

// "Who has context on the auth system?"
await lightfast.search({ query: "authentication ownership context" });

// "Find things related to this PR"
await lightfast.findSimilar({ url: "https://github.com/org/repo/pull/123" });
```

### Operating Layer — [Join the waitlist →](https://lightfast.ai/early-access)

The full operating infrastructure. Agents express what they want in natural language — Lightfast resolves it to the right tool, enforces your team's rules, and tracks everything that happens. Processes that run for seconds or months. Invariants that span tools. Intent resolution that learns from your team.

## Integrate in 2 Ways

### 1. TypeScript SDK

```bash
npm install lightfast
```

```typescript
import { Lightfast } from "lightfast";

const lightfast = new Lightfast({ apiKey: process.env.LIGHTFAST_API_KEY });

// Search your workspace
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

Connect AI assistants directly to your workspace via [Model Context Protocol](https://modelcontextprotocol.io/).

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
- `lightfast_search` — Search your workspace
- `lightfast_contents` — Fetch full document content
- `lightfast_find_similar` — Find semantically similar documents

## Security

- **Your data stays yours** — We never train on your data. Complete tenant isolation.
- **Encrypted at rest and in transit** — Industry-standard security practices
- **Role-based access** — Workspace permissions mirror your source permissions
- **Self-hosted option** — Coming soon for enterprises with strict data residency requirements

## Requirements

- Node.js >= 18
- A Lightfast API key — [get started](https://lightfast.ai)

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

Lightfast is licensed under the [Functional Source License, Version 1.1 (FSL-1.1-ALv2)](LICENSE) — a source-available license that automatically converts to Apache 2.0 after 2 years.

**For Users**: You can use Lightfast freely for internal business purposes, education, and research. Each version becomes fully open source (Apache 2.0) two years after release.

See [LICENSING.md](LICENSING.md) for complete details.
