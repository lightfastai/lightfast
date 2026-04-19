<p align="center">
  <img src="https://lightfast.ai/images/github-banner.png" alt="Lightfast" width="100%" />
</p>

# Lightfast

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/lightfast.svg)](https://www.npmjs.com/package/lightfast)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![CI Status](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml/badge.svg)](https://github.com/lightfastai/lightfast/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/stargazers)

**An operating system for product development.**
**For agents and teams.**

[Website](https://lightfast.ai) · [Documentation](https://lightfast.ai/docs/get-started/overview) · [Discord](https://discord.gg/YqPDfcar2C)

Lightfast ingests events from your stack — code, signals, feedback, decisions, deploys — and stores them as cited memory that agents and engineers query through the same primitives. The operating layer is a pipeline: **memory → intelligence → agents**. `v0.1.0` ships memory and a proxy for agent actions; intelligence, and the auto-drafted artifacts that close the loop, are in development.

## Memory

Memory is the substrate, and the layer Lightfast ships today.

Every event from every connected tool flows into a temporal graph with semantic embeddings, cited by source. Not a log — a graph that resolves commits, PRs, deployments, incidents, and the people behind them into entities and traces the relationships between them. `Explore` answers questions against that graph with streaming, cited responses grounded in the actual events.

The direction: causal reasoning across tools — not just storing that *a PR merged* and *an error spiked*, but understanding which commit caused which incident, which ticket tracks the fix, and which deployment shipped it. The longer Lightfast runs, the more it understands about your team, your patterns, and your stage.

## Intelligence

Intelligence will compose memory into action. Skills, workflows, rules, and permissions — defined once, enforced continuously.

The target: express an invariant — *"every production release needs an approved review and a closed ticket"* — and the layer enforces it at all times, not on a schedule.

This layer is in development. Today, Lightfast exposes memory through cited answers and a proxy primitive (below) that executes provider actions on behalf of agents.

## Agents

Agents operate on memory through the REST API, TypeScript SDK, and MCP server — the same primitives available to people.

The `proxy` primitive is the first step toward intent-based resolution: `proxy.search` discovers connected providers, resources, and available actions; `proxy.call` executes an action (`github.list-pull-requests`) through Lightfast with auth handled. Action-level today; higher-order intent resolution — *find the owner of this system, open a PR with full context* — is where this is headed.

The destination: as the number of agents in your company grows, one system they all operate through — with shared memory, shared context, and your rules enforced at the kernel level.

Surfaces today: REST API, TypeScript SDK, MCP (Claude, Cursor, Codex). IDE and CI surfaces are planned.

## The Loop

Where Lightfast is going — bug → fix → changelog, without anyone copy-pasting:

1. **Signal lands.** A Sentry error and a customer report resolve to the same symptom.
2. **Context stitches.** Lightfast correlates the symptom to a commit, PRs, owner, and prior discussion.
3. **Fix ships.** A PR opens with full context, merges, deploys.
4. **Loop closes.** A changelog entry, a customer reply, and a docs update auto-draft — each human-reviewable.

Today, steps 1 and 2 are addressable through memory + Explore. Steps 3 and 4 — the write-back and auto-drafting — are the roadmap. Every feature Lightfast ships is meant to make your team smarter, not just the product larger.

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
import { createLightfast } from "lightfast";

const lf = createLightfast(process.env.LIGHTFAST_API_KEY!);

// Semantic search across all connected sources
const { results } = await lf.search({
  query: "deployment errors last week",
  limit: 10,
});

// Discover connected providers, resources, and available actions
const { connections } = await lf.proxy.search();

// Execute a provider action through Lightfast (auth handled)
const { status, data } = await lf.proxy.call({
  action: "github.list-pull-requests",
  params: { owner: "acme", repo: "web" },
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
- `lightfast_search` — semantic search across connected sources, with cited results
- `lightfast_proxy_search` — discover connected providers, resources, and available provider actions
- `lightfast_proxy_call` — execute a provider action through Lightfast (auth handled)

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

Lightfast is open source:

- **Platform** (apps, API routers, database, internal packages): [Apache License 2.0](LICENSE).
- **SDKs and shared libraries** (`core/*`, `vendor/*`, UI kit, shared utilities): MIT License (see each package's `LICENSE` file or `package.json`).

Contributions are accepted under the [Developer Certificate of Origin](https://developercertificate.org/) via `Signed-off-by:` on commits. See [CONTRIBUTING.md](CONTRIBUTING.md).
