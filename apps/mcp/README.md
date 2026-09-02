# Local MCP Shell

A repository-only Model Context Protocol server using stdio transport. It has
no tools, HTTP listener, authentication, secrets, hosted endpoint, deployment
configuration, or production wiring.

From the repository root:

```bash
pnpm --filter @lightfast/mcp-local dev
```

The process speaks MCP exclusively over stdin/stdout. It does not use a
Portless route because stdio is not a browser service.
