---
"lightfast": patch
"@lightfastai/mcp": patch
---

Fix MCP external installation by exporting Zod schemas from SDK

The MCP package previously depended on the unpublished `@repo/console-types` workspace package, causing npm installation failures. This release moves Zod schema exports to the published SDK, eliminating all unpublished dependencies and making the MCP package fully installable from npm.

Changes:
- Export Zod validation schemas from lightfast SDK
- Add zod as SDK runtime dependency
- Update MCP server to import schemas from published SDK
- Fix MCP package dependencies to use published versions only
