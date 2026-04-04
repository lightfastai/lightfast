<p align="center">
  <img src="https://lightfast.ai/images/github-banner.png" alt="Lightfast" width="100%" />
</p>

# Lightfast

[![License: FSL-1.1-ALv2](https://img.shields.io/badge/License-FSL--1.1--ALv2-orange.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/lightfast.svg)](https://www.npmjs.com/package/lightfast)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![CI Status](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml/badge.svg)](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/stargazers)

**Superintelligence layer for founders.**

[Website](https://lightfast.ai) · [Documentation](https://lightfast.ai/docs/get-started/overview) · [Discord](https://discord.gg/YqPDfcar2C)

Lightfast is the operating system that runs your startup. Your tools, your agents, your entire operation — orchestrated in one place. Strategy, ops, execution. Lightfast runs all of it.

## Memory

Your tools don't share memory. Something breaks in production and you're switching between Sentry, GitHub, Vercel, and Linear — manually connecting dots that the system should already know. Lightfast builds the memory layer your stack never had.

Every event across every connected tool flows into a living graph that understands causality, ownership, and relationships — not just stores them. The PR that caused the incident. The engineer who owns the system. The Linear ticket tracking the fix. The deployment that shipped it. Ask one question, get the full picture with cited sources. The longer Lightfast runs, the more it understands about your team, your patterns, and your stage.

## Operating Layer

The operating layer is what acts on that memory. Agents don't call twelve different APIs — they express intent to Lightfast, and Lightfast resolves it: right tool, right context, every time. Define a rule — "every production release needs an approved review and a closed ticket" — and the OS enforces it continuously, not on a schedule.

As the number of agents in your company grows, you don't want twelve agents calling twelve tools independently. You want one system they all operate through — with shared memory, shared context, and your rules enforced at the kernel level. That's where Lightfast is going.

## Supported Sources

**Available now:**

| Source | Events |
|--------|--------|
| **GitHub** | Push, pull requests, issues, code reviews |
| **Vercel** | Deployments, project activity |
| **Sentry** | Errors, issues, alerts |
| **Linear** | Issues, comments, projects, cycles |

**Coming soon:**

- Dev & ops: Slack, Notion, Confluence, PagerDuty
- Business: Stripe, HubSpot, Apollo
- [Request an integration →](https://github.com/lightfastai/lightfast/issues)

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
- `lightfast_search` — Search across connected tools for decisions and observations

## Security

- **Your data stays yours** — We never train on your data. Complete tenant isolation.
- **Encrypted at rest and in transit** — Industry-standard security practices
- **Role-based access** — Workspace permissions mirror your source permissions
- **Self-hosted option** — Coming soon for enterprises with strict data residency requirements

## Requirements

- Node.js >= 18
- A Lightfast API key — [get started](https://lightfast.ai)

## Documentation

- [API Reference](https://lightfast.ai/docs/api-reference/getting-started/overview) — Full endpoint documentation
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
