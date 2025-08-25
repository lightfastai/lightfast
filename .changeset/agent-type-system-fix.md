---
"lightfast": patch
---

Fix Agent type system for proper tool context typing

- Fixed type constraints to expect tools with `RuntimeContext<TRuntimeContext>` instead of just `TRuntimeContext`
- This ensures tools receive the merged context (SystemContext & RequestContext & TRuntimeContext) as they actually do at runtime
- Strongly typed onChunk, onFinish, and onStepFinish callbacks now properly know tool names
- TypeScript will catch invalid tool name usage at compile time
- Updated comprehensive production setup documentation in README