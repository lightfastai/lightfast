# @lightfastai/core

## 0.2.1

### Patch Changes

- fd1e607: Fix Agent type system for proper tool context typing
  - Fixed type constraints to expect tools with `RuntimeContext<TRuntimeContext>` instead of just `TRuntimeContext`
  - This ensures tools receive the merged context (SystemContext & RequestContext & TRuntimeContext) as they actually do at runtime
  - Strongly typed onChunk, onFinish, and onStepFinish callbacks now properly know tool names
  - TypeScript will catch invalid tool name usage at compile time
  - Updated comprehensive production setup documentation in README

## 0.2.0

### Minor Changes

- 095278e: Initial release of @lightfastai/core package

  This is the first public release of the Lightfast Core SDK, providing AI agent infrastructure components including:

  **Core Features:**
  - Agent creation and configuration with multiple AI providers (OpenAI, Anthropic, etc.)
  - Tool system with stateful execution and context management
  - Memory adapters for session persistence (in-memory and Redis)
  - Streaming server adapters for real-time agent responses
  - Cache management for optimized performance
  - Comprehensive error handling and recovery

  **V2 Features:**
  - Enhanced agent runtime with improved streaming
  - React hooks for UI integration
  - Event-driven architecture
  - Environment configuration utilities
  - Braintrust integration for evaluation

  **Infrastructure:**
  - Full TypeScript support with strict typing
  - ESM-only module system
  - Comprehensive test coverage
  - Production-ready error handling
