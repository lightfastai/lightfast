---
"lightfast": patch
"@lightfastai/mcp": patch
---

Fix MCP server API key validation (CRITICAL)

The MCP server was still validating API keys with the old `sk_` prefix instead of the correct `sk-lf-` format. This prevented the MCP server from accepting any valid Lightfast API keys, breaking all MCP integrations.

**This is a critical bug fix for alpha.3 users** - the SDK validation was fixed in alpha.3, but the MCP server validation was not updated.

Changes:
- Fix MCP server validation to accept `sk-lf-` prefix
- Update all MCP examples and documentation
- Update README and configuration examples
