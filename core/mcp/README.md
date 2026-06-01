# @lightfastai/mcp

Model Context Protocol (MCP) stdio server for Lightfast.

[![npm version](https://img.shields.io/npm/v/@lightfastai/mcp.svg)](https://www.npmjs.com/package/@lightfastai/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

## Installation

```bash
npm install -g @lightfastai/mcp
# or
pnpm add -g @lightfastai/mcp
```

## Hosted OAuth MCP

For interactive user connections, prefer the hosted Lightfast MCP resource. It uses the MCP OAuth flow, dynamic client registration, and user/org-scoped grants instead of copying API keys into a local process.

Local development URL:

```text
https://[<wt>.]mcp.lightfast.localhost/mcp
```

The hosted server lives in `apps/mcp`. This package remains the API-key stdio server for local, CI, and clients that do not support remote OAuth MCP yet.

Both hosted and stdio tools are derived from the same MCP exposure policy in `@repo/api-contract` through `@repo/mcp-tools`; keep tool names, schemas, and behavior in parity.

## Development

```bash
pnpm build   # Build
pnpm dev     # Watch mode
```

## Requirements

- **Node.js** >= 18
- **Lightfast API key** from [lightfast.ai](https://lightfast.ai)
- **MCP-compatible client** (Claude Desktop, Claude Code, Cursor, etc.)

## Links

- **Website**: [lightfast.ai](https://lightfast.ai)
- **Documentation**: [lightfast.ai/docs](https://lightfast.ai/docs)
- **GitHub**: [github.com/lightfastai/lightfast](https://github.com/lightfastai/lightfast)
- **npm**: [npmjs.com/package/@lightfastai/mcp](https://www.npmjs.com/package/@lightfastai/mcp)
- **MCP Docs**: [modelcontextprotocol.io](https://modelcontextprotocol.io)

## Related Packages

- **[lightfast](https://www.npmjs.com/package/lightfast)** - TypeScript SDK for the Lightfast API

## License

MIT © [Lightfast](https://lightfast.ai)
