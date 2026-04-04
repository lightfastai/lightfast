# @lightfastai/mcp

Model Context Protocol (MCP) server for Lightfast — Connect Claude and other AI assistants to decisions surfaced across your tools.

[![npm version](https://img.shields.io/npm/v/@lightfastai/mcp.svg)](https://www.npmjs.com/package/@lightfastai/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open protocol that enables AI assistants like Claude to securely access external tools and data sources. This server gives Claude access to your Lightfast workspace memory.

## Features

- **Semantic Search** — Search across connected tools for decisions and observations
- **Reranking** — Cohere rerank for high-quality result ordering
- **Zero Config** — Works with Claude Desktop, Code, Cursor, and more

## Installation

### Quick Start (npx)

No installation needed - run directly:

```bash
npx -y @lightfastai/mcp --api-key sk-lf-...
```

### Global Installation

```bash
npm install -g @lightfastai/mcp
# or
pnpm add -g @lightfastai/mcp
```

## Setup

### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lightfast": {
      "command": "npx",
      "args": ["-y", "@lightfastai/mcp", "--api-key", "sk-lf-YOUR_KEY_HERE"]
    }
  }
}
```

**Using environment variables:**

```json
{
  "mcpServers": {
    "lightfast": {
      "command": "npx",
      "args": ["-y", "@lightfastai/mcp"],
      "env": {
        "LIGHTFAST_API_KEY": "sk-lf-YOUR_KEY_HERE"
      }
    }
  }
}
```

### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "lightfast": {
      "command": "npx",
      "args": ["-y", "@lightfastai/mcp", "--api-key", "sk-lf-YOUR_KEY_HERE"]
    }
  }
}
```

### Cursor

Add to Cursor settings (`~/.cursor/config.json`):

```json
{
  "mcp": {
    "servers": {
      "lightfast": {
        "command": "npx",
        "args": ["-y", "@lightfastai/mcp", "--api-key", "sk-lf-YOUR_KEY_HERE"]
      }
    }
  }
}
```

### Cline (VS Code Extension)

Add to Cline MCP settings:

```json
{
  "mcpServers": {
    "lightfast": {
      "command": "npx",
      "args": ["-y", "@lightfastai/mcp"],
      "env": {
        "LIGHTFAST_API_KEY": "sk-lf-YOUR_KEY_HERE"
      }
    }
  }
}
```

## Authentication

Get your API key from [lightfast.ai](https://lightfast.ai):

1. Sign in to your workspace
2. Navigate to Settings → API Keys
3. Create a new API key

API keys start with `sk-lf-` prefix.

## Available Tools

The MCP server exposes the `lightfast_search` tool to Claude.

### `lightfast_search`

Search across connected tools for decisions and observations.

**Parameters:**
- `query` (required) — Natural language search query
- `limit` (optional) — Max results, 1–100 (default: 10)
- `offset` (optional) — Pagination offset (default: 0)
- `mode` (optional) — `"fast"` (vector scores only) or `"balanced"` (Cohere rerank, default)
- `sources` (optional) — Filter by provider, e.g. `["github", "linear"]`
- `types` (optional) — Filter by entity type, e.g. `["pull_request", "issue"]`
- `after` (optional) — ISO 8601 datetime lower bound
- `before` (optional) — ISO 8601 datetime upper bound

**Response:**
```json
{
  "results": [
    {
      "id": "obs_abc123",
      "title": "Fix authentication bug",
      "url": "https://github.com/...",
      "snippet": "Fixed the session timeout issue...",
      "score": 0.95,
      "source": "github",
      "type": "commit",
      "occurredAt": "2024-11-15T10:30:00Z"
    }
  ],
  "total": 42,
  "requestId": "req_xyz"
}
```

**Search Modes:**
- `fast` — Vector search only
- `balanced` — Cohere reranking (default)

## Usage Examples

### In Claude Desktop

Once configured, Claude can automatically use these tools:

**User:** "Search for information about authentication"

**Claude:** *Uses `lightfast_search` tool*
> I found 15 results about authentication. Here are the most relevant ones:
> 1. Fix authentication bug in login flow (score: 0.95)
> 2. Add OAuth2 configuration (score: 0.89)
> ...

### In Claude Code

Claude Code automatically uses Lightfast to:
- Find relevant code when you ask questions
- Discover related files and documentation
- Search through past discussions and decisions
- Build context for code generation
- Explore relationships between commits, PRs, and issues

### Programmatic Usage

You can also run the MCP server programmatically:

```typescript
import { createServer } from "@lightfastai/mcp";

const server = await createServer({
  apiKey: "sk-lf-...",
  baseUrl: "https://lightfast.ai", // Optional
});

// Server is now running and accepting MCP requests
```

## CLI Options

```bash
npx @lightfastai/mcp [options]

Options:
  --api-key <key>    Lightfast API key (or set LIGHTFAST_API_KEY env var)
  --base-url <url>   API base URL (default: https://lightfast.ai)
  --help, -h         Show this help message
  --version, -v      Show version
```

## Environment Variables

```bash
LIGHTFAST_API_KEY=sk-lf-...         # Your API key
LIGHTFAST_BASE_URL=https://lightfast.ai  # Optional, custom API endpoint
```

## Troubleshooting

### Server not connecting

1. Verify your API key is valid and starts with `sk-lf-`
2. Check that the MCP server is in your config file
3. Restart Claude Desktop after config changes
4. Check Claude Desktop logs for errors

**macOS logs**: `~/Library/Logs/Claude/mcp-server-lightfast.log`
**Windows logs**: `%APPDATA%\Claude\logs\mcp-server-lightfast.log`

### API key errors

**Error**: `Invalid API key format`

**Solution**: Ensure your API key starts with `sk-lf-` prefix. Get a new key from [lightfast.ai/settings/api-keys](https://lightfast.ai/settings/api-keys)

### Tool not found errors

**Solution**: The MCP server exposes one tool: `lightfast_search`. Make sure you're using the latest version: `npx @lightfastai/mcp@latest`

### Rate limiting

**Error**: `Rate limit exceeded`

**Solution**: You're making too many requests. Wait a moment and try again. Consider upgrading your plan for higher rate limits.

### Network errors

**Error**: `Network error` or timeout

**Solution**:
- Check your internet connection
- Verify `--base-url` is correct
- Check if you're behind a proxy/firewall
- Increase timeout in your config (if supported by your MCP client)

### MCP server not found

**Error**: `Cannot find module '@lightfastai/mcp'`

**Solution**:
- Use `npx -y @lightfastai/mcp` to auto-install
- Or install globally: `npm install -g @lightfastai/mcp`
- Restart your terminal/IDE after installation

## Requirements

- **Node.js** >= 18
- **Lightfast API key** from [lightfast.ai](https://lightfast.ai)
- **MCP-compatible client** (Claude Desktop, Claude Code, Cursor, etc.)

## Security

- API keys are never logged or stored by the MCP server
- All communication with Lightfast API uses HTTPS
- Configure API keys in environment variables for production use
- Never commit API keys to version control

## Development

### Building from source

```bash
git clone https://github.com/lightfastai/lightfast.git
cd lightfast/core/mcp
pnpm install
pnpm build
```

### Testing locally

```bash
pnpm dev  # Watch mode

# In another terminal
node dist/index.mjs --api-key sk-lf-...
```

### Local development with workspace protocol

The MCP package uses `workspace:*` protocol to depend on the local SDK during development:

```bash
# Build both packages
cd core/lightfast && pnpm build
cd ../mcp && pnpm build

# Use in Claude Desktop
{
  "mcpServers": {
    "lightfast": {
      "command": "node",
      "args": ["/path/to/lightfast/core/mcp/dist/index.mjs", "--api-key", "sk-lf-..."]
    }
  }
}
```

## MCP Protocol Version

This server implements MCP protocol version **2024-11-05** via `@modelcontextprotocol/sdk@^1.0.0`.

## Links

- **Website**: [lightfast.ai](https://lightfast.ai)
- **Documentation**: [lightfast.ai/docs/integrate/mcp](https://lightfast.ai/docs/integrate/mcp)
- **GitHub**: [github.com/lightfastai/lightfast](https://github.com/lightfastai/lightfast)
- **npm**: [npmjs.com/package/@lightfastai/mcp](https://www.npmjs.com/package/@lightfastai/mcp)
- **MCP Docs**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Issues**: [github.com/lightfastai/lightfast/issues](https://github.com/lightfastai/lightfast/issues)

## Related Packages

- **[lightfast](https://www.npmjs.com/package/lightfast)** - TypeScript SDK for the Lightfast API

## License

MIT © [Lightfast](https://lightfast.ai)
