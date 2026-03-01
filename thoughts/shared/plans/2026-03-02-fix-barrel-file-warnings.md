# Fix All Barrel File `export *` Lint Warnings

## Overview

Convert all 34 `export *` statements across 15 files in 3 packages (`@lightfastai/ai-sdk`, `@repo/ai`, `@db/chat`) to explicit named exports. This eliminates the `no-restricted-syntax` lint warnings about barrel files and improves tree-shaking.

## Current State Analysis

`pnpm lint` returns **0 errors, 34 warnings**, all the same rule:

| Package | Warnings | Files |
|---|---|---|
| `@lightfastai/ai-sdk` | 14 | 7 files in `core/ai-sdk/` |
| `@repo/ai` | 8 | 6 files in `packages/ai/` |
| `@db/chat` | 12 | 2 files in `db/chat/` |

### Key Discoveries:
- `@vendor/db` (`vendor/db/src/index.ts`) already uses explicit named exports — no changes needed there
- `core/ai-sdk/src/core/v2/react/index.ts` already uses named exports — it's not flagged
- `core/ai-sdk/src/core/v2/server/handlers/runtime/index.ts` already uses named exports
- The `ai` package has ~242 exports (96 runtime + ~146 types) — the largest conversion
- Most `packages/ai` entry points have **0 consumers** in the monorepo (vendor wrappers for future use)

## Desired End State

All 15 files use explicit named exports instead of `export *`. Running `pnpm lint` returns **0 errors, 0 warnings**.

## What We're NOT Doing

- Removing any unused barrel files or packages
- Changing the public API surface of any package
- Modifying `@vendor/db` (already uses named exports)
- Adding or removing any exports — only converting syntax

## Implementation Approach

Three phases, one per package. Each phase is independent and can be verified separately.

---

## Phase 1: Fix `@lightfastai/ai-sdk` (14 warnings, 7 files)

### Overview
Convert internal `export *` statements in the core AI SDK to explicit named exports.

### Changes Required:

#### 1. `core/ai-sdk/src/core/v2/logger/index.ts`
**Changes**: Replace 3 `export *` with explicit named exports

```typescript
/**
 * Logger module for V2 Agent System
 */

// noop-logger
export { NoopLogger, noopLogger } from "./noop-logger";
// pino-logger
export { PinoLoggerAdapter, createPinoLoggerFactory } from "./pino-logger";
// types
export {
  LogLevel,
  LogEventName,
  type BaseLogContext,
  type AgentLoopStartContext,
  type AgentLoopCompleteContext,
  type AgentLoopErrorContext,
  type AgentStepStartContext,
  type AgentStepCompleteContext,
  type AgentToolCallContext,
  type AgentToolResultContext,
  type AgentErrorContext,
  type StreamStartContext,
  type StreamChunkContext,
  type StreamCompleteContext,
  type StreamErrorContext,
  type MessageCreatedContext,
  type MessageUpdatedContext,
  type MessageErrorContext,
  type SessionCreatedContext,
  type SessionResumedContext,
  type SessionErrorContext,
  type WorkerEnqueuedContext,
  type WorkerStartedContext,
  type WorkerCompletedContext,
  type WorkerErrorContext,
  type LogEventContextMap,
  type ILogger,
  type LoggerFactory,
} from "./types";
```

#### 2. `core/ai-sdk/src/core/v2/workers/index.ts`
**Changes**: Replace 1 `export *` with explicit named exports

```typescript
/**
 * V2 Workers exports
 */

export {
  AgentDecisionSchema,
  type AgentDecision,
  ToolDefinitionSchema,
  type ToolDefinition,
  WorkerConfigSchema,
  type WorkerConfig,
} from "./schemas";
// Tool result handler is deprecated - use Runtime instead
```

#### 3. `core/ai-sdk/src/core/v2/server/index.ts`
**Changes**: Replace 2 `export *` with explicit named exports

```typescript
/**
 * V2 Server exports for resumable LLM streams
 */

export {
  type FetchRequestHandlerOptions,
  fetchRequestHandler,
} from "./adapters/fetch";
export { EventConsumer } from "./events/consumer";
export { EventWriter } from "./events/event-writer";
// Event types
export {
  EventName,
  type AgentLoopStartEvent,
  type AgentLoopCompleteEvent,
  type AgentStepStartEvent,
  type AgentStepCompleteEvent,
  type AgentToolCallEvent,
  type AgentToolResultEvent,
  type AgentErrorEvent,
  type AgentEvent,
  type AgentLoopStartParams,
  type AgentLoopCompleteParams,
  type AgentToolCallParams,
  type AgentToolResultParams,
  type AgentStepStartParams,
  type AgentStepCompleteParams,
  type AgentErrorParams,
} from "./events/types";
// Runtime handlers
export {
  type StepHandlerDependencies,
  handleAgentStep,
  type ToolHandlerDependencies,
  handleToolCall,
} from "./handlers/runtime";
export { MessageReader } from "./readers/message-reader";
export { StreamConsumer } from "./stream/consumer";
export { generateSessionId } from "./utils";
export { MessageWriter } from "./writers/message-writer";
export { SessionWriter } from "./writers/session-writer";
```

#### 4. `core/ai-sdk/src/core/v2/core.ts`
**Changes**: Replace 3 `export *` with explicit named exports

```typescript
/**
 * V2 Core exports - Server-side components without React dependencies
 * IMPORTANT: This file must NEVER import React or client-side components
 */

// Export Agent class
export { Agent, type AgentOptions, type AgentToolDefinition } from "./agent";
// Export logger types and implementations
export {
  NoopLogger,
  noopLogger,
  PinoLoggerAdapter,
  createPinoLoggerFactory,
  LogLevel,
  LogEventName,
  type BaseLogContext,
  type AgentLoopStartContext,
  type AgentLoopCompleteContext,
  type AgentLoopErrorContext,
  type AgentStepStartContext,
  type AgentStepCompleteContext,
  type AgentToolCallContext,
  type AgentToolResultContext,
  type AgentErrorContext,
  type StreamStartContext,
  type StreamChunkContext,
  type StreamCompleteContext,
  type StreamErrorContext,
  type MessageCreatedContext,
  type MessageUpdatedContext,
  type MessageErrorContext,
  type SessionCreatedContext,
  type SessionResumedContext,
  type SessionErrorContext,
  type WorkerEnqueuedContext,
  type WorkerStartedContext,
  type WorkerCompletedContext,
  type WorkerErrorContext,
  type LogEventContextMap,
  type ILogger,
  type LoggerFactory,
} from "./logger";
// Export server components
export {
  EventConsumer,
  EventWriter,
  type FetchRequestHandlerOptions,
  fetchRequestHandler,
  generateSessionId,
  MessageReader,
  MessageWriter,
  SessionWriter,
  StreamConsumer,
} from "./server";
// Export event types from unified location
export {
  EventName,
  type AgentLoopStartEvent,
  type AgentLoopCompleteEvent,
  type AgentStepStartEvent,
  type AgentStepCompleteEvent,
  type AgentToolCallEvent,
  type AgentToolResultEvent,
  type AgentErrorEvent,
  type AgentEvent,
  type AgentLoopStartParams,
  type AgentLoopCompleteParams,
  type AgentToolCallParams,
  type AgentToolResultParams,
  type AgentStepStartParams,
  type AgentStepCompleteParams,
  type AgentErrorParams,
} from "./server/events/types";
// Export specific stream types
export {
  type DeltaStreamMessage,
  DeltaStreamType,
} from "./server/stream/types";
// Export workers
export {
  AgentDecisionSchema,
  type AgentDecision,
  ToolDefinitionSchema,
  type ToolDefinition,
  WorkerConfigSchema,
  type WorkerConfig,
} from "./workers";
```

#### 5. `core/ai-sdk/src/core/v2/index.ts`
**Changes**: Replace 2 `export *` with explicit named exports

```typescript
/**
 * V2 Event-Driven Architecture exports
 * Server-side only - NO React components
 * React components are available via @lightfast/ai/v2/react
 */

// Export environment configurations
export {
  braintrustEnv,
  getBraintrustConfig,
  getOtelConfig,
  isOtelEnabled,
} from "./braintrust-env";
// Re-export all core functionality (server-side only)
export {
  // Agent
  Agent,
  type AgentOptions,
  type AgentToolDefinition,
  // Logger
  NoopLogger,
  noopLogger,
  PinoLoggerAdapter,
  createPinoLoggerFactory,
  LogLevel,
  LogEventName,
  type BaseLogContext,
  type AgentLoopStartContext,
  type AgentLoopCompleteContext,
  type AgentLoopErrorContext,
  type AgentStepStartContext,
  type AgentStepCompleteContext,
  type AgentToolCallContext,
  type AgentToolResultContext,
  type AgentErrorContext,
  type StreamStartContext,
  type StreamChunkContext,
  type StreamCompleteContext,
  type StreamErrorContext,
  type MessageCreatedContext,
  type MessageUpdatedContext,
  type MessageErrorContext,
  type SessionCreatedContext,
  type SessionResumedContext,
  type SessionErrorContext,
  type WorkerEnqueuedContext,
  type WorkerStartedContext,
  type WorkerCompletedContext,
  type WorkerErrorContext,
  type LogEventContextMap,
  type ILogger,
  type LoggerFactory,
  // Server
  EventConsumer,
  EventWriter,
  type FetchRequestHandlerOptions,
  fetchRequestHandler,
  generateSessionId,
  MessageReader,
  MessageWriter,
  SessionWriter,
  StreamConsumer,
  // Event types
  EventName,
  type AgentLoopStartEvent,
  type AgentLoopCompleteEvent,
  type AgentStepStartEvent,
  type AgentStepCompleteEvent,
  type AgentToolCallEvent,
  type AgentToolResultEvent,
  type AgentErrorEvent,
  type AgentEvent,
  type AgentLoopStartParams,
  type AgentLoopCompleteParams,
  type AgentToolCallParams,
  type AgentToolResultParams,
  type AgentStepStartParams,
  type AgentStepCompleteParams,
  type AgentErrorParams,
  // Stream types
  type DeltaStreamMessage,
  DeltaStreamType,
  // Workers
  AgentDecisionSchema,
  type AgentDecision,
  ToolDefinitionSchema,
  type ToolDefinition,
  WorkerConfigSchema,
  type WorkerConfig,
  // Runtime handlers
  type StepHandlerDependencies,
  handleAgentStep,
  type ToolHandlerDependencies,
  handleToolCall,
} from "./core";
```

#### 6. `core/ai-sdk/src/v2/react.ts`
**Changes**: Replace 1 `export *` with explicit named exports

```typescript
/**
 * V2 React exports for easy imports
 * @module @lightfast/ai/v2/react
 */

export {
  type UseChatOptions,
  type UseChatReturn,
  type DeltaStreamMessage,
  DeltaStreamType,
  useChat,
  validateMessage,
  type UseDeltaStreamOptions,
  type UseDeltaStreamReturn,
  useDeltaStream,
  type UseEventStreamOptions,
  type UseEventStreamReturn,
  useAgentErrorEvents,
  useAgentLoopEvents,
  useAgentToolEvents,
  useEventStream,
} from "../core/v2/react";
```

#### 7. `core/ai-sdk/src/v2/server.ts`
**Changes**: Replace 2 `export *` with explicit named exports

```typescript
/**
 * V2 Server exports for easy imports
 * @module @lightfast/ai/v2/server
 */

export {
  type FetchRequestHandlerOptions,
  fetchRequestHandler,
} from "../core/v2/server/adapters/fetch";
export { EventConsumer } from "../core/v2/server/events/consumer";
export { EventWriter } from "../core/v2/server/events/event-writer";
// Event types
export {
  EventName,
  type AgentLoopStartEvent,
  type AgentLoopCompleteEvent,
  type AgentStepStartEvent,
  type AgentStepCompleteEvent,
  type AgentToolCallEvent,
  type AgentToolResultEvent,
  type AgentErrorEvent,
  type AgentEvent,
  type AgentLoopStartParams,
  type AgentLoopCompleteParams,
  type AgentToolCallParams,
  type AgentToolResultParams,
  type AgentStepStartParams,
  type AgentStepCompleteParams,
  type AgentErrorParams,
} from "../core/v2/server/events/types";
// Runtime handlers
export {
  type StepHandlerDependencies,
  handleAgentStep,
  type ToolHandlerDependencies,
  handleToolCall,
} from "../core/v2/server/handlers/runtime";
export { MessageReader } from "../core/v2/server/readers/message-reader";
export { StreamConsumer } from "../core/v2/server/stream/consumer";
export { generateSessionId } from "../core/v2/server/utils";
export { MessageWriter } from "../core/v2/server/writers/message-writer";
export { SessionWriter } from "../core/v2/server/writers/session-writer";
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @lightfastai/ai-sdk lint` returns 0 warnings
- [ ] `pnpm --filter @lightfastai/ai-sdk build` succeeds (tsc)
- [ ] `pnpm typecheck` passes

#### Manual Verification:
- [ ] None required — syntax-only changes with no logic impact

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Fix `@repo/ai` (8 warnings, 6 files)

### Overview
Convert external SDK re-exports in `packages/ai/` to explicit named exports. The `ai` package has ~242 exports, so this is the largest file.

### Changes Required:

#### 1. `packages/ai/src/ai/index.ts`
**Changes**: Replace 3 `export *` with explicit named exports. Note: This file has **0 active consumers** in the monorepo.

```typescript
// ai SDK - runtime exports
export {
  AISDKError,
  APICallError,
  AbstractChat,
  DefaultChatTransport,
  DownloadError,
  EmptyResponseBodyError,
  Experimental_Agent,
  HttpChatTransport,
  InvalidArgumentError,
  InvalidDataContentError,
  InvalidMessageRoleError,
  InvalidPromptError,
  InvalidResponseDataError,
  InvalidStreamPartError,
  InvalidToolInputError,
  JSONParseError,
  JsonToSseTransformStream,
  LoadAPIKeyError,
  MCPClientError,
  MessageConversionError,
  NoContentGeneratedError,
  NoImageGeneratedError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  NoOutputSpecifiedError,
  NoSuchModelError,
  NoSuchProviderError,
  NoSuchToolError,
  Output,
  RetryError,
  SerialJobExecutor,
  TextStreamChatTransport,
  ToolCallRepairError,
  TypeValidationError,
  UI_MESSAGE_STREAM_HEADERS,
  UnsupportedFunctionalityError,
  UnsupportedModelVersionError,
  asSchema,
  assistantModelMessageSchema,
  callCompletionApi,
  consumeStream,
  convertFileListToFileUIParts,
  convertToCoreMessages,
  convertToModelMessages,
  coreAssistantMessageSchema,
  coreMessageSchema,
  coreSystemMessageSchema,
  coreToolMessageSchema,
  coreUserMessageSchema,
  cosineSimilarity,
  createIdGenerator,
  createProviderRegistry,
  createTextStreamResponse,
  createUIMessageStream,
  createUIMessageStreamResponse,
  customProvider,
  defaultSettingsMiddleware,
  dynamicTool,
  embed,
  embedMany,
  experimental_createMCPClient,
  experimental_createProviderRegistry,
  experimental_customProvider,
  experimental_generateImage,
  experimental_generateSpeech,
  experimental_transcribe,
  extractReasoningMiddleware,
  generateId,
  generateObject,
  generateText,
  getTextFromDataUrl,
  getToolName,
  hasToolCall,
  isDeepEqualData,
  isToolUIPart,
  jsonSchema,
  lastAssistantMessageIsCompleteWithToolCalls,
  modelMessageSchema,
  parsePartialJson,
  pipeTextStreamToResponse,
  pipeUIMessageStreamToResponse,
  readUIMessageStream,
  simulateReadableStream,
  simulateStreamingMiddleware,
  smoothStream,
  stepCountIs,
  streamObject,
  streamText,
  systemModelMessageSchema,
  tool,
  toolModelMessageSchema,
  userModelMessageSchema,
  validateUIMessages,
  wrapLanguageModel,
  wrapProvider,
  zodSchema,
} from "ai";

// ai SDK - type-only exports
export type {
  AssistantContent,
  AssistantModelMessage,
  AsyncIterableStream,
  CallSettings,
  CallWarning,
  ChatInit,
  ChatOnDataCallback,
  ChatOnErrorCallback,
  ChatOnFinishCallback,
  ChatOnToolCallCallback,
  ChatRequestOptions,
  ChatState,
  ChatStatus,
  ChatTransport,
  ChunkDetector,
  CompletionRequestOptions,
  CoreAssistantMessage,
  CoreMessage,
  CoreSystemMessage,
  CoreToolMessage,
  CoreUserMessage,
  CreateUIMessage,
  DataContent,
  DataUIPart,
  DeepPartial,
  DynamicToolCall,
  DynamicToolError,
  DynamicToolResult,
  DynamicToolUIPart,
  EmbedManyResult,
  EmbedResult,
  Embedding,
  EmbeddingModel,
  EmbeddingModelUsage,
  ErrorHandler,
  Experimental_AgentSettings,
  Experimental_GenerateImageResult,
  Experimental_GeneratedImage,
  Experimental_SpeechResult,
  Experimental_TranscriptionResult,
  FilePart,
  FileUIPart,
  FinishReason,
  GenerateObjectResult,
  GenerateTextOnStepFinishCallback,
  GenerateTextResult,
  GeneratedAudioFile,
  GeneratedFile,
  HttpChatTransportInitOptions,
  IdGenerator,
  ImageModel,
  ImageModelCallWarning,
  ImageModelProviderMetadata,
  ImageModelResponseMetadata,
  ImagePart,
  InferToolInput,
  InferToolOutput,
  InferUIDataParts,
  InferUIMessageChunk,
  InferUITool,
  InferUITools,
  JSONRPCError,
  JSONRPCMessage,
  JSONRPCNotification,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONSchema7,
  JSONValue,
  LanguageModel,
  LanguageModelRequestMetadata,
  LanguageModelResponseMetadata,
  LanguageModelUsage,
  MCPTransport,
  ModelMessage,
  ObjectStreamPart,
  PrepareReconnectToStreamRequest,
  PrepareSendMessagesRequest,
  PrepareStepFunction,
  PrepareStepResult,
  Prompt,
  Provider,
  ProviderMetadata,
  ProviderRegistryProvider,
  ReasoningUIPart,
  RepairTextFunction,
  Schema,
  SourceDocumentUIPart,
  SourceUrlUIPart,
  SpeechModel,
  SpeechModelResponseMetadata,
  SpeechWarning,
  StaticToolCall,
  StaticToolError,
  StaticToolResult,
  StepResult,
  StepStartUIPart,
  StopCondition,
  StreamObjectOnFinishCallback,
  StreamObjectResult,
  StreamTextOnChunkCallback,
  StreamTextOnErrorCallback,
  StreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback,
  StreamTextResult,
  StreamTextTransform,
  SystemModelMessage,
  TelemetrySettings,
  TextPart,
  TextStreamPart,
  TextUIPart,
  Tool,
  ToolCallOptions,
  ToolCallPart,
  ToolCallRepairFunction,
  ToolChoice,
  ToolContent,
  ToolExecuteFunction,
  ToolModelMessage,
  ToolResultPart,
  ToolSet,
  ToolUIPart,
  TranscriptionModel,
  TranscriptionModelResponseMetadata,
  TranscriptionWarning,
  TypedToolCall,
  TypedToolError,
  TypedToolResult,
  UIDataPartSchemas,
  UIDataTypes,
  UIMessage,
  UIMessageChunk,
  UIMessagePart,
  UIMessageStreamOnFinishCallback,
  UIMessageStreamOptions,
  UIMessageStreamWriter,
  UITool,
  UITools,
  UseCompletionOptions,
  UserContent,
  UserModelMessage,
  experimental_MCPClient,
  experimental_MCPClientConfig,
} from "ai";

// @ai-sdk/openai
export { OpenAI, createOpenAI, openai } from "@ai-sdk/openai";
export type { OpenAIProvider, OpenAIProviderSettings } from "@ai-sdk/openai";

// @ai-sdk/anthropic
export { anthropic, createAnthropic } from "@ai-sdk/anthropic";
export type {
  AnthropicProvider,
  AnthropicProviderOptions,
  AnthropicProviderSettings,
} from "@ai-sdk/anthropic";
```

#### 2. `packages/ai/src/fal/client.ts`
**Changes**: Replace 1 `export *` with explicit named exports

```typescript
export {
  ApiError,
  ValidationError,
  createFalClient,
  fal,
  isCompletedQueueStatus,
  isQueueStatus,
  isRetryableError,
  parseEndpointId,
  withMiddleware,
  withProxy,
} from "@fal-ai/client";
export type {
  CompletedQueueStatus,
  FalClient,
  InProgressQueueStatus,
  InQueueQueueStatus,
  Metrics,
  QueueStatus,
  RequestLog,
  Result,
  RunOptions,
  UrlOptions,
  ValidationErrorInfo,
  WebHookResponse,
} from "@fal-ai/client";
```

#### 3. `packages/ai/src/fal/hono-server-proxy.ts`
**Changes**: Replace 1 `export *` with explicit named exports

```typescript
export { createRouteHandler } from "@fal-ai/server-proxy/hono";
export type { FalHonoProxyOptions } from "@fal-ai/server-proxy/hono";
```

#### 4. `packages/ai/src/fal/index.ts`
**Changes**: Replace 1 `export *` with explicit named re-exports

```typescript
// Re-export fal client
export {
  ApiError,
  ValidationError,
  createFalClient,
  fal,
  isCompletedQueueStatus,
  isQueueStatus,
  isRetryableError,
  parseEndpointId,
  withMiddleware,
  withProxy,
  type CompletedQueueStatus,
  type FalClient,
  type InProgressQueueStatus,
  type InQueueQueueStatus,
  type Metrics,
  type QueueStatus,
  type RequestLog,
  type Result,
  type RunOptions,
  type UrlOptions,
  type ValidationErrorInfo,
  type WebHookResponse,
} from "./client";
```

#### 5. `packages/ai/src/fal/nextjs-server-proxy.ts`
**Changes**: Replace 1 `export *` with explicit named exports

```typescript
export { PROXY_ROUTE, handler, route } from "@fal-ai/server-proxy/nextjs";
```

#### 6. `packages/ai/src/schema/index.ts`
**Changes**: Replace 1 `export *` with explicit named exports

```typescript
export {
  $Txt2ImgModel,
  type Txt2ImgModel,
  $FluxDevInput,
  type FluxDevInput,
  $FluxDevOutput,
  type FluxDevOutput,
} from "./txt2img";
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @repo/ai lint` returns 0 warnings
- [ ] `pnpm --filter @repo/ai build` succeeds (tsc)
- [ ] `pnpm typecheck` passes

#### Manual Verification:
- [ ] None required — syntax-only changes with no logic impact

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: Fix `@db/chat` (12 warnings, 2 files)

### Overview
Convert barrel `export *` in the chat database package to explicit named exports.

### Changes Required:

#### 1. `db/chat/src/schema/index.ts`
**Changes**: Replace 10 `export *` with explicit named exports

```typescript
// session
export {
  LightfastChatSession,
  type InsertLightfastChatSession,
  insertLightfastChatSessionSchema,
  selectLightfastChatSessionSchema,
} from "./tables/session";

// message
export {
  LightfastChatMessage,
  type InsertLightfastChatMessage,
  insertLightfastChatMessageSchema,
  selectLightfastChatMessageSchema,
} from "./tables/message";

// message-feedback
export {
  LightfastChatMessageFeedback,
  type InsertLightfastChatMessageFeedback,
  insertLightfastChatMessageFeedbackSchema,
  selectLightfastChatMessageFeedbackSchema,
} from "./tables/message-feedback";

// stream
export {
  LightfastChatStream,
  lightfastChatStreamRelations,
  type InsertLightfastChatStream,
  insertLightfastChatStreamSchema,
  selectLightfastChatStreamSchema,
} from "./tables/stream";

// artifact
export {
  LightfastChatArtifact,
  type InsertLightfastChatArtifact,
  ARTIFACT_KINDS,
  type ArtifactKind,
  insertLightfastChatArtifactSchema,
  selectLightfastChatArtifactSchema,
} from "./tables/artifact";

// usage
export {
  LightfastChatUsage,
  type InsertLightfastChatUsage,
  insertLightfastChatUsageSchema,
  selectLightfastChatUsageSchema,
} from "./tables/usage";

// quota-reservations
export {
  LightfastChatQuotaReservation,
  type InsertLightfastChatQuotaReservation,
  RESERVATION_STATUS,
  type ReservationStatus,
  insertLightfastChatQuotaReservationSchema,
  selectLightfastChatQuotaReservationSchema,
} from "./tables/quota-reservations";

// session-share
export {
  LightfastChatSessionShare,
  type InsertLightfastChatSessionShare,
  insertLightfastChatSessionShareSchema,
  selectLightfastChatSessionShareSchema,
} from "./tables/session-share";

// relations
export {
  lightfastChatSessionRelations,
  lightfastChatMessageRelations,
  lightfastChatArtifactRelations,
  lightfastChatMessageFeedbackRelations,
  lightfastChatSessionShareRelations,
} from "./tables/relations";

// attachment
export {
  LightfastChatAttachment,
  type InsertLightfastChatAttachment,
  insertLightfastChatAttachmentSchema,
  selectLightfastChatAttachmentSchema,
} from "./tables/attachment";
```

#### 2. `db/chat/src/index.ts`
**Changes**: Replace 2 `export *` with explicit named exports

```typescript
// Re-export common utilities from vendor/db
export {
  createPlanetScaleClient,
  createDatabase,
  drizzle,
  Client,
  FakePrimitiveParam,
  isSQLWrapper,
  StringChunk,
  SQL,
  Name,
  name,
  isDriverValueEncoder,
  noopDecoder,
  noopEncoder,
  noopMapper,
  Param,
  param,
  sql,
  Placeholder,
  placeholder,
  fillPlaceholders,
  View,
  isView,
  getViewName,
  bindIfParam,
  eq,
  ne,
  and,
  or,
  not,
  gt,
  gte,
  lt,
  lte,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  exists,
  notExists,
  between,
  notBetween,
  like,
  notLike,
  ilike,
  notIlike,
  arrayContains,
  arrayContained,
  arrayOverlaps,
  asc,
  desc,
  count,
  countDistinct,
  avg,
  avgDistinct,
  sum,
  sumDistinct,
  max,
  min,
  l2Distance,
  l1Distance,
  innerProduct,
  cosineDistance,
  hammingDistance,
  jaccardDistance,
  alias,
  createSelectSchema,
  createInsertSchema,
  createUpdateSchema,
  createSchemaFactory,
  isColumnType,
  isWithEnum,
  isPgEnum,
  bufferSchema,
  jsonSchema,
  literalSchema,
  createDrizzleConfig,
} from "@vendor/db";
export type {
  DatabaseConfig,
  PlanetScaleDatabase,
  PlanetScaleConfig,
  Chunk,
  BuildQueryConfig,
  QueryTypingsValue,
  Query,
  QueryWithTypings,
  SQLWrapper,
  GetDecoderResult,
  DriverValueDecoder,
  DriverValueEncoder,
  DriverValueMapper,
  SQLChunk,
  ColumnsSelection,
  InferSelectViewModel,
  BinaryOperator,
  GetEnumValuesFromColumn,
  GetBaseColumn,
  GetZodType,
  HandleColumn,
  CreateSelectSchema,
  CreateInsertSchema,
  CreateUpdateSchema,
  CreateSchemaFactoryOptions,
  Conditions,
  BuildRefineColumns,
  BuildRefine,
  BuildSchema,
  NoUnknownKeys,
  Json,
  IsNever,
  ArrayHasAtLeastOneValue,
  ColumnIsGeneratedAlwaysAs,
  RemoveNever,
  GetSelection,
} from "@vendor/db";

// Export chat-specific schema (no client to prevent env var exposure)
export {
  // session
  LightfastChatSession,
  type InsertLightfastChatSession,
  insertLightfastChatSessionSchema,
  selectLightfastChatSessionSchema,
  // message
  LightfastChatMessage,
  type InsertLightfastChatMessage,
  insertLightfastChatMessageSchema,
  selectLightfastChatMessageSchema,
  // message-feedback
  LightfastChatMessageFeedback,
  type InsertLightfastChatMessageFeedback,
  insertLightfastChatMessageFeedbackSchema,
  selectLightfastChatMessageFeedbackSchema,
  // stream
  LightfastChatStream,
  lightfastChatStreamRelations,
  type InsertLightfastChatStream,
  insertLightfastChatStreamSchema,
  selectLightfastChatStreamSchema,
  // artifact
  LightfastChatArtifact,
  type InsertLightfastChatArtifact,
  ARTIFACT_KINDS,
  type ArtifactKind,
  insertLightfastChatArtifactSchema,
  selectLightfastChatArtifactSchema,
  // usage
  LightfastChatUsage,
  type InsertLightfastChatUsage,
  insertLightfastChatUsageSchema,
  selectLightfastChatUsageSchema,
  // quota-reservations
  LightfastChatQuotaReservation,
  type InsertLightfastChatQuotaReservation,
  RESERVATION_STATUS,
  type ReservationStatus,
  insertLightfastChatQuotaReservationSchema,
  selectLightfastChatQuotaReservationSchema,
  // session-share
  LightfastChatSessionShare,
  type InsertLightfastChatSessionShare,
  insertLightfastChatSessionShareSchema,
  selectLightfastChatSessionShareSchema,
  // relations
  lightfastChatSessionRelations,
  lightfastChatMessageRelations,
  lightfastChatArtifactRelations,
  lightfastChatMessageFeedbackRelations,
  lightfastChatSessionShareRelations,
  // attachment
  LightfastChatAttachment,
  type InsertLightfastChatAttachment,
  insertLightfastChatAttachmentSchema,
  selectLightfastChatAttachmentSchema,
} from "./schema";
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @db/chat lint` returns 0 warnings
- [ ] `pnpm --filter @db/chat build` succeeds (tsc)
- [ ] `pnpm typecheck` passes

#### Manual Verification:
- [ ] None required — syntax-only changes with no logic impact

---

## Final Verification

After all 3 phases are complete:

### Automated Verification:
- [ ] `pnpm lint` returns 0 errors, 0 warnings
- [ ] `pnpm typecheck` passes across entire monorepo
- [ ] `pnpm build:console` succeeds

### Manual Verification:
- [ ] None required — all changes are mechanical export syntax conversions

## Performance Considerations

- Explicit named exports enable better tree-shaking by bundlers
- No runtime behavior changes — this is purely a build/bundler optimization
- The `ai` SDK re-export file (`packages/ai/src/ai/index.ts`) becomes ~250 lines but will need maintenance when `ai` SDK version is bumped

## Migration Notes

- If new exports are added to source modules (e.g., new schema tables in `db/chat`), they must be explicitly added to barrel files
- When bumping `ai` SDK version, check for new/removed exports in `packages/ai/src/ai/index.ts`
- Consider adding a CI check or eslint rule to catch missing re-exports

## References

- Previous lint fix plan: `thoughts/shared/plans/2026-03-02-fix-lint-errors.md`
- Vendor abstraction pattern: `vendor/db/src/index.ts` (already uses named exports)
- ESLint rule: `no-restricted-syntax` configured for `export *` pattern
