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

## Configuration

The stdio server requires an API key and the explicit base URL of a compatible
Lightfast API. It does not assume a hosted backend.

```bash
LIGHTFAST_API_KEY=lf_... \
LIGHTFAST_API_URL=https://api.example.test \
lightfast-mcp
```

Tools are derived from the MCP exposure policy in `@repo/api-contract` through
`@repo/mcp-tools`.

## Development

```bash
pnpm build   # Build
pnpm dev     # Watch mode
```

## Requirements

- **Node.js** >= 18
- **Lightfast API key** for the configured backend
- **Lightfast API URL** supplied through `LIGHTFAST_API_URL`
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
