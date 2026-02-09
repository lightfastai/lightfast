---
"lightfast": patch
"@lightfastai/mcp": patch
---

Add comprehensive package READMEs with accurate API documentation

This release adds complete, production-ready README files for both published packages with 100% accurate API documentation:

**SDK (`lightfast`):**
- Complete API reference for all 5 methods (search, contents, findSimilar, related, graph)
- Accurate response structures validated against actual type definitions
- Real-world usage examples (RAG systems, code assistants, similarity search)
- Full error handling documentation with typed error classes
- TypeScript support with type imports
- Environment variable configuration

**MCP Server (`@lightfastai/mcp`):**
- Setup guides for Claude Desktop, Code, Cursor, and Cline
- All 5 MCP tools documented with correct names and parameters
- Complete response schemas for each tool
- Comprehensive troubleshooting guide
- CLI options and environment variables
- Security best practices

**Additional improvements:**
- Fixed search mode values: "fast" | "balanced" | "thorough"
- Corrected all parameter names to match actual implementation
- Updated all code examples to use correct field access patterns
- Added complete metadata and latency information

These READMEs will display on npm and provide developers with accurate, copy-paste ready code examples.
