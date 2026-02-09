---
date: 2026-02-09T06:14:59+0000
researcher: Claude Sonnet 4.5
git_commit: 9be56b5f5b82fe2728545e5d2e81031ea7f79899
branch: main
repository: lightfast
topic: "Type System Standardization - Duplicated Types and Validation Logic in Core Packages"
tags: [research, codebase, types, validation, api-keys, core-packages, duplication]
status: complete
last_updated: 2026-02-09
last_updated_by: Claude Sonnet 4.5
---

# Research: Type System Standardization - Duplicated Types and Validation Logic in Core Packages

**Date**: 2026-02-09T06:14:59+0000
**Researcher**: Claude Sonnet 4.5
**Git Commit**: 9be56b5f5b82fe2728545e5d2e81031ea7f79899
**Branch**: main
**Repository**: lightfast

## Research Question

Document where type definitions currently exist across `@core/lightfast/`, `@core/mcp/`, and `@packages/`, with a focus on identifying duplicated type definitions (particularly the sk key format) and mapping the current state of the type system.

The user identified critical re-instantiation of types like the sk key format in core packages instead of depending on where they are actually defined in the packages layer.

## Summary

The research reveals significant duplication of API key validation logic and constants across `core/lightfast`, `core/mcp`, and `apps/console`, despite the existence of a canonical implementation in `@repo/console-api-key`. The key findings are:

1. **API Key Validation Duplication**: The `sk-lf-` prefix validation is implemented in 5+ locations with different error handling approaches
2. **Hardcoded Constants**: The `"sk-lf-"` prefix string is hardcoded in core packages instead of importing `LIGHTFAST_API_KEY_PREFIX` constant
3. **Mixed Type Sources**: Core packages mix type definitions from `@repo/console-types` (devDependency) with inline validation logic
4. **Centralized Type System**: `@repo/console-types` provides comprehensive API contracts, while `@repo/console-validation` provides runtime Zod schemas
5. **Well-Centralized Utilities**: API key hashing, generation, and ID generation are properly centralized (no duplication)

The core issue is that `core/lightfast` and `core/mcp` re-implement validation logic that should be imported from the centralized packages, leading to maintenance burden and potential inconsistencies.

## Detailed Findings

### 1. API Key Validation Duplication (Critical)

The validation logic for `sk-lf-` prefix is duplicated across multiple locations:

#### Location 1: SDK Client Constructor
**File**: `core/lightfast/src/client.ts:58-60`

```typescript
if (!config.apiKey.startsWith("sk-lf-")) {
  throw new Error("Invalid API key format. Keys should start with 'sk-lf-'");
}
```

- **Context**: Constructor validation in `Lightfast` class
- **Error Handling**: Throws generic `Error`
- **Usage**: Client initialization guard

#### Location 2: MCP Server Entry Point
**File**: `core/mcp/src/index.ts:63-65`

```typescript
if (!apiKey.startsWith("sk-lf-")) {
  console.error("Error: Invalid API key format. Keys should start with 'sk-lf-'");
  process.exit(1);
}
```

- **Context**: CLI argument validation
- **Error Handling**: Logs to stderr and exits with code 1
- **Usage**: MCP server startup guard

#### Location 3: API Route Authentication
**File**: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:70-80`

```typescript
if (!apiKey.startsWith("sk-lf-")) {
  log.warn("Invalid API key format", { requestId });
  return {
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Invalid API key format. Keys must start with 'sk-lf-'.",
    },
    status: 401,
  };
}
```

- **Context**: API route middleware
- **Error Handling**: Returns structured error response
- **Usage**: Request authentication middleware

#### Location 4: Dual Auth Detection
**File**: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:61`

```typescript
if (token.startsWith("sk-lf-")) {
  // API key path
}
```

- **Context**: Detecting API key vs session authentication
- **Error Handling**: Branch logic only
- **Usage**: Auth type detection

#### Location 5: Canonical Implementation (Unused)
**File**: `packages/console-api-key/src/crypto.ts:133-142`

```typescript
export function isValidApiKeyFormat(key: string): boolean {
  // Must start with sk-lf-
  if (!key.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
    return false;
  }

  // Must have correct length: prefix (6) + secret (43) = 49
  const expectedLength =
    LIGHTFAST_API_KEY_PREFIX.length + API_KEY_SECRET_LENGTH;
  return key.length === expectedLength;
}
```

- **Context**: Centralized validation utility
- **Error Handling**: Returns boolean
- **Usage**: Exported but NOT used by core packages

**Issue**: The canonical `isValidApiKeyFormat()` function exists but is not imported by the packages that need it.

---

### 2. API Key Constants Duplication

#### Canonical Definition
**File**: `packages/console-api-key/src/crypto.ts:16-32`

```typescript
/**
 * Unified API key prefix for all Lightfast keys
 * Format follows industry conventions: sk-{vendor}-{secret}
 */
export const LIGHTFAST_API_KEY_PREFIX = "sk-lf-";

/**
 * Length of the random portion of the API key
 * 43 chars × 62-char alphabet = ~256 bits entropy
 */
export const API_KEY_SECRET_LENGTH = 43;

/**
 * Number of characters to show in the key preview
 */
export const API_KEY_PREVIEW_LENGTH = 4;

/**
 * @deprecated Legacy prefix - do not use for new keys
 */
export const API_KEY_PREFIX = "console_sk_";
```

#### Hardcoded Usage in Core Packages

**SDK Client** (`core/lightfast/src/client.ts:58`):
```typescript
if (!config.apiKey.startsWith("sk-lf-")) {  // Hardcoded
```

**MCP Server** (`core/mcp/src/index.ts:63`):
```typescript
if (!apiKey.startsWith("sk-lf-")) {  // Hardcoded
```

**API Route** (`apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:70`):
```typescript
if (!apiKey.startsWith("sk-lf-")) {  // Hardcoded
```

**Issue**: The prefix `"sk-lf-"` is hardcoded in 5+ locations instead of importing `LIGHTFAST_API_KEY_PREFIX`. If the prefix changes, it requires updates in multiple files.

---

### 3. Type System Architecture

#### 3.1 Package Dependency Structure

```
┌─────────────────────────────────────────────────────────┐
│  @repo/console-types                                    │
│  - Type definitions (interfaces, type aliases)          │
│  - Zod schemas for runtime validation                   │
│  - Re-exports from @repo/console-validation             │
└─────────────────────────────────────────────────────────┘
                           ↑
                           │ imports
                           │
┌─────────────────────────────────────────────────────────┐
│  @repo/console-validation                               │
│  - Primitive schemas (IDs, names, slugs)                │
│  - Domain schemas (API keys, workspaces, sources)       │
│  - Form schemas (client-side validation)                │
│  - Constants (naming rules, validation helpers)         │
└─────────────────────────────────────────────────────────┘
                           ↑
                           │ imports enums only
                           │
┌─────────────────────────────────────────────────────────┐
│  @repo/console-api-key                                  │
│  - API key generation (generateApiKey)                  │
│  - API key hashing (hashApiKey - SHA-256)               │
│  - API key validation (isValidApiKeyFormat)             │
│  - Constants (LIGHTFAST_API_KEY_PREFIX)                 │
└─────────────────────────────────────────────────────────┘
```

#### 3.2 Core Package Dependencies

**core/lightfast/package.json:59**:
```json
{
  "devDependencies": {
    "@repo/console-types": "workspace:*"
  }
}
```

- **Import Pattern**: Type-only imports for compile-time safety
- **Runtime**: No runtime dependency on console-types (devDependency only)
- **Validation**: Inline validation logic instead of importing utilities

**core/mcp/package.json:52**:
```json
{
  "dependencies": {
    "lightfast": "^0.1.0-alpha.3"
  }
}
```

- **Import Pattern**: Depends on `lightfast` SDK package
- **Type Access**: Types inherited from SDK via re-exports
- **Validation**: Duplicates SDK validation logic at entry point

---

### 4. Type Definitions in Core Packages

#### 4.1 core/lightfast Type System

**File**: `core/lightfast/src/types.ts`

The SDK re-exports all API types from `@repo/console-types` as compile-time type-only imports:

```typescript
export type {
  // Search types (lines 3-10)
  V1SearchRequest,
  V1SearchResponse,
  V1SearchResult,
  V1SearchFilters,
  V1SearchContext,
  V1SearchLatency,
  V1SearchMeta,
  RerankMode,

  // Contents types (lines 12-14)
  V1ContentsRequest,
  V1ContentsResponse,
  V1ContentItem,

  // FindSimilar types (lines 16-19)
  V1FindSimilarRequest,
  V1FindSimilarResponse,
  V1FindSimilarResult,
  V1FindSimilarSource,

  // Graph types (lines 21-24)
  V1GraphRequest,
  GraphResponse,
  GraphNode,
  GraphEdge,

  // Related types (lines 26-28)
  V1RelatedRequest,
  RelatedResponse,
  RelatedEvent,
} from "@repo/console-types/api";
```

**SDK Input Types** (lines 46-86):

The SDK wraps V1 types to make fields with server-side defaults optional:

```typescript
// SearchInput - makes pagination and mode optional
export type SearchInput = Omit<
  V1SearchRequest,
  "limit" | "offset" | "mode" | "includeContext" | "includeHighlights"
> &
  Partial<Pick<V1SearchRequest, "limit" | "offset" | "mode" | "includeContext" | "includeHighlights">>;

// FindSimilarInput - makes similarity params optional
export type FindSimilarInput = Omit<
  V1FindSimilarRequest,
  "limit" | "threshold" | "sameSourceOnly"
> &
  Partial<Pick<V1FindSimilarRequest, "limit" | "threshold" | "sameSourceOnly">>;

// GraphInput - makes depth optional
export type GraphInput = Omit<V1GraphRequest, "depth"> &
  Partial<Pick<V1GraphRequest, "depth">>;
```

**Configuration Types** (lines 91-113):

```typescript
export interface LightfastConfig {
  /**
   * Your Lightfast API key (starts with sk-lf-)
   */
  apiKey: string;

  /**
   * Base URL for the Lightfast API
   * @default "https://lightfast.ai"
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
}
```

**Pattern**: SDK types are thin wrappers around console-types, adding only developer convenience (optional fields for defaults).

---

#### 4.2 core/mcp Type System

**File**: `core/mcp/src/server.ts:14-17`

```typescript
export interface ServerConfig {
  apiKey: string;
  baseUrl?: string;
}
```

The MCP server defines a minimal config interface and delegates to the SDK client:

```typescript
import {
  Lightfast,
  V1SearchRequestSchema,
  V1ContentsRequestSchema,
  V1FindSimilarRequestSchema,
  V1GraphRequestSchema,
  V1RelatedRequestSchema,
} from "lightfast";
```

**Pattern**: MCP imports both types AND Zod schemas from the SDK package, then uses schema `.shape` property for MCP tool parameter definitions.

---

### 5. Centralized Type System (@repo/console-types)

**File**: `packages/console-types/src/index.ts`

The package exports 27+ specific subpaths for tree-shaking:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./api": "./src/api/index.ts",
    "./api/search": "./src/api/search.ts",
    "./api/common": "./src/api/common.ts",
    "./api/contents": "./src/api/contents.ts",
    "./api/v1/search": "./src/api/v1/search.ts",
    "./api/v1/contents": "./src/api/v1/contents.ts",
    "./api/v1/findsimilar": "./src/api/v1/findsimilar.ts",
    "./api/v1/graph": "./src/api/v1/graph.ts",
    "./document": "./src/document.ts",
    "./vector": "./src/vector.ts",
    "./error": "./src/error.ts",
    "./repository": "./src/repository.ts",
    "./workspace": "./src/workspace.ts",
    "./neural/source-event": "./src/neural/source-event.ts",
    "./neural/entity": "./src/neural/entity.ts",
    "./integrations/events": "./src/integrations/event-types.ts"
  }
}
```

**Key Type Definitions**:

1. **API Types** (`src/api/v1/*.ts`):
   - V1SearchRequest/Response with filters, pagination, rerank mode
   - V1ContentsRequest/Response for document retrieval
   - V1FindSimilarRequest/Response for similarity search
   - V1GraphRequest/Response for graph traversal
   - V1RelatedRequest/Response for related observations

2. **Domain Types** (`src/document.ts`, `src/vector.ts`, etc.):
   - DocumentMetadata, ChunkMetadata
   - EmbeddingProvider interface
   - ErrorCode enum, APIError interface

3. **Neural Types** (`src/neural/*.ts`):
   - SourceEvent - webhook event structure
   - SourceActor, SourceReference - actor and reference metadata
   - ExtractedEntity, EntitySearchResult - entity extraction results

4. **Integration Events** (`src/integrations/event-types.ts`):
   - EVENT_REGISTRY - single source of truth for all webhook events
   - Mapping functions: toInternalGitHubEvent, toInternalVercelEvent, etc.
   - Event categories for UI subscription

**Pattern**: Zod-first API contracts using `.infer<>` to derive TypeScript types, enabling both runtime validation and compile-time type safety.

---

### 6. Validation Schemas (@repo/console-validation)

**File**: `packages/console-validation/src/index.ts`

The package uses a layered architecture:

```
Primitives Layer (ids.ts, names.ts, slugs.ts)
    ↓
Constants Layer (naming.ts - rules and constraints)
    ↓
Schemas Layer (domain entities - workspaces, api-keys, sources)
    ↓
Forms Layer (client-side React Hook Form integration)
```

**Key Findings**:

1. **No API Key Format Validation**: The validation schemas do NOT validate the `sk-lf-` or `sk_` format for API keys. They only validate inputs for API key operations (create, revoke, delete, rotate).

2. **API Key Preview Format**: The only reference to key format is in activities schema (line 271 of `activities.ts`):
   ```typescript
   keyPreview: z.string(), // e.g., "sk_live_...abc1"
   ```

3. **Organization Slug Validation** (`src/primitives/slugs.ts:39-53`):
   ```typescript
   export const clerkOrgSlugSchema = z
     .string()
     .min(CLERK_ORG_SLUG.MIN_LENGTH)
     .max(CLERK_ORG_SLUG.MAX_LENGTH)
     .regex(CLERK_ORG_SLUG.PATTERN)
     .refine((s) => CLERK_ORG_SLUG.START_PATTERN.test(s))
     .refine((s) => CLERK_ORG_SLUG.END_PATTERN.test(s))
     .refine((s) => !CLERK_ORG_SLUG.NO_CONSECUTIVE_HYPHENS.test(s))
     .refine(
       (s) => !RESERVED_ORGANIZATION_SLUGS.includes(s),
       { message: "This name is reserved" }
     );
   ```

4. **Workspace Name Validation** (`src/primitives/slugs.ts:77-85`):
   ```typescript
   export const workspaceNameSchema = z
     .string()
     .min(WORKSPACE_NAME.MIN_LENGTH)
     .max(WORKSPACE_NAME.MAX_LENGTH)
     .regex(WORKSPACE_NAME.PATTERN)
     .refine(
       (s) => !RESERVED_WORKSPACE_NAMES.includes(s),
       { message: "This workspace name is reserved" }
     );
   ```

**Pattern**: Validation schemas provide runtime Zod validation for TypeScript interfaces defined in console-types. The packages work together where console-types defines interfaces and console-validation provides runtime validation.

---

### 7. API Key Generation and Hashing (@repo/console-api-key)

**File**: `packages/console-api-key/src/crypto.ts`

This is the **canonical implementation** for API key operations:

#### Key Generation (lines 45-50)
```typescript
export function generateApiKey(
  prefix: string = LIGHTFAST_API_KEY_PREFIX
): string {
  const keySecret = nanoid(API_KEY_SECRET_LENGTH);
  return `${prefix}${keySecret}`;
}
```

#### Key Hashing (lines 108-114)
```typescript
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

#### Key Validation (lines 133-142)
```typescript
export function isValidApiKeyFormat(key: string): boolean {
  // Must start with sk-lf-
  if (!key.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
    return false;
  }

  // Must have correct length: prefix (6) + secret (43) = 49
  const expectedLength =
    LIGHTFAST_API_KEY_PREFIX.length + API_KEY_SECRET_LENGTH;
  return key.length === expectedLength;
}
```

#### Key Preview (lines 122-125)
```typescript
export function extractKeyPreview(key: string): string {
  const suffix = key.slice(-API_KEY_PREVIEW_LENGTH);
  return `sk-lf-...${suffix}`;
}
```

**Usage Analysis**:

✅ **Well-Centralized** (Used correctly):
- `hashApiKey()` - Imported by auth middleware (`apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:12`)
- `generateApiKey()` - Imported by tRPC router (`api/console/src/router/user/user-api-keys.ts:6`)
- `extractKeyPreview()` - Imported by tRPC router (same file)

❌ **Not Used** (Should be imported):
- `isValidApiKeyFormat()` - **NOT** imported by core packages that need it
- `LIGHTFAST_API_KEY_PREFIX` - Hardcoded as `"sk-lf-"` instead of importing

---

### 8. Cross-Package Import Patterns

#### Pattern 1: API Key Management in tRPC
**File**: `api/console/src/router/user/user-api-keys.ts:6-10`

```typescript
import {
  generateApiKey,
  hashApiKey,
  extractKeyPreview,
  LIGHTFAST_API_KEY_PREFIX,
} from "@repo/console-api-key";
```

✅ Correct usage - imports all utilities and constants from canonical source.

#### Pattern 2: Type-Only Imports for API Contracts
**File**: `apps/console/src/lib/v1/search.ts:6`

```typescript
import type { V1SearchResponse, V1SearchResult } from "@repo/console-types";
```

✅ Correct usage - type-only imports for compile-time safety.

#### Pattern 3: Schema Validation in Webhooks
**File**: `packages/console-webhooks/src/validation.ts:7-8`

```typescript
import { sourceEventSchema } from "@repo/console-validation";
import type { SourceEvent } from "@repo/console-types";
```

✅ Correct usage - combines type from console-types and schema from console-validation.

#### Pattern 4: Database Schema Type Casting
**File**: `db/console/src/schema/tables/workspace-workflow-runs.ts:4`

```typescript
import type { JobStatus, JobTrigger, WorkflowInput, WorkflowOutput } from "@repo/console-validation";

export const workspaceWorkflowRuns = pgTable(
  "lightfast_workspace_workflow_runs",
  {
    status: varchar("status", { length: 50 })
      .notNull()
      .default("queued")
      .$type<JobStatus>(),

    trigger: varchar("trigger", { length: 50 }).notNull().$type<JobTrigger>(),

    input: jsonb("input").$type<WorkflowInput>(),

    output: jsonb("output").$type<WorkflowOutput>(),
  },
);
```

✅ Correct usage - uses validation types for database column type casting.

---

### 9. Other Duplication Patterns

#### 9.1 Error Class Hierarchies

Multiple packages define similar error hierarchies:

1. **Lightfast SDK** (`core/lightfast/src/errors.ts:4-100`):
   - LightfastError (base)
   - AuthenticationError, ValidationError, NotFoundError, RateLimitError, ServerError, NetworkError

2. **Pinecone Vendor** (`vendor/pinecone/src/errors.ts:10-64`):
   - PineconeError (base)
   - PineconeConnectionError, PineconeRateLimitError, PineconeNotFoundError, PineconeInvalidRequestError

3. **Email/Resend** (`packages/email/src/functions/all.ts:44-97`):
   - ResendError (base)
   - ResendRateLimitError, ResendDailyQuotaError, ResendValidationError, ResendAuthenticationError

**Common Pattern**:
- Base error with `code`, `message`, optional metadata
- Subclasses for specific error types
- Prototype chain fixing with `Object.setPrototypeOf()`

**Issue**: Similar patterns but inconsistent field names (`code` vs `statusCode`), could use shared base error factory.

#### 9.2 Environment Variable Validation

The `.startsWith()` pattern for vendor API keys is repeated 20+ times:

```typescript
// Clerk
CLERK_SECRET_KEY: z.string().min(1).startsWith("sk_"),

// Anthropic
ANTHROPIC_API_KEY: z.string().min(1).startsWith("sk-ant-"),

// OpenAI
OPENAI_API_KEY: z.string().min(1).startsWith("sk-proj-"),

// Resend
RESEND_API_KEY: z.string().min(1).startsWith("re_"),

// And 15+ more...
```

**Locations**:
- `vendor/clerk/env.ts`
- `packages/ai/src/env/anthropic-env.ts`
- `packages/ai/src/env/openai-env.ts`
- `vendor/email/src/env.ts`
- `vendor/db/env.ts`
- And 10+ more files

**Issue**: Could extract to reusable Zod helper function like `vendorApiKey(prefix)`.

---

## Code References

### API Key Validation Duplication
- `core/lightfast/src/client.ts:58-60` - SDK constructor validation
- `core/mcp/src/index.ts:63-65` - MCP CLI validation
- `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:70-80` - API auth middleware
- `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:61` - Dual auth detection
- `packages/console-api-key/src/crypto.ts:133-142` - Canonical validation (unused)

### Canonical API Key Implementation
- `packages/console-api-key/src/crypto.ts:16-32` - Constants
- `packages/console-api-key/src/crypto.ts:45-50` - generateApiKey()
- `packages/console-api-key/src/crypto.ts:108-114` - hashApiKey()
- `packages/console-api-key/src/crypto.ts:122-125` - extractKeyPreview()
- `packages/console-api-key/src/crypto.ts:133-142` - isValidApiKeyFormat()

### Type System Architecture
- `packages/console-types/package.json:7-28` - Granular exports
- `packages/console-types/src/api/v1/search.ts:42-244` - V1 Search API types
- `packages/console-types/src/api/v1/findsimilar.ts:13-139` - FindSimilar API types
- `packages/console-types/src/neural/source-event.ts:7-68` - Source event types
- `packages/console-types/src/integrations/event-types.ts:177-611` - Event registry

### Validation Schemas
- `packages/console-validation/src/primitives/slugs.ts:39-53` - Org slug validation
- `packages/console-validation/src/primitives/slugs.ts:77-85` - Workspace name validation
- `packages/console-validation/src/schemas/org-api-key.ts:13-76` - API key operation schemas
- `packages/console-validation/src/schemas/activities.ts:267-309` - API key activity metadata

### Core Package Types
- `core/lightfast/src/types.ts:3-113` - SDK type definitions
- `core/lightfast/src/client.ts:54-65` - Constructor validation
- `core/mcp/src/server.ts:14-17` - MCP server config
- `core/mcp/src/index.ts:31-66` - CLI argument parsing and validation

### Cross-Package Usage
- `api/console/src/router/user/user-api-keys.ts:6-10` - Correct import pattern
- `apps/console/src/lib/v1/search.ts:6` - Type-only import pattern
- `packages/console-webhooks/src/validation.ts:7-8` - Combined type + schema pattern
- `db/console/src/schema/tables/workspace-workflow-runs.ts:4` - Database type casting

---

## Architecture Documentation

### Type System Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Source Layer: External Integrations                          │
│ (GitHub, Vercel, Linear, Sentry webhooks)                    │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Transformation Layer: @repo/console-webhooks                 │
│ - Transforms external events to SourceEvent                  │
│ - Uses sourceEventSchema for validation                      │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Domain Layer: @repo/console-types                            │
│ - SourceEvent interface                                      │
│ - V1 API request/response types                              │
│ - Zod schemas for runtime validation                         │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Validation Layer: @repo/console-validation                   │
│ - Primitive schemas (IDs, names, slugs)                      │
│ - Domain schemas (workspaces, sources, api-keys)             │
│ - Form schemas (client-side validation)                      │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Security Layer: @repo/console-api-key                        │
│ - API key generation (generateApiKey)                        │
│ - API key hashing (hashApiKey - SHA-256)                     │
│ - API key validation (isValidApiKeyFormat)                   │
│ - Constants (LIGHTFAST_API_KEY_PREFIX)                       │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ API Layer: api/console (tRPC), apps/console (Next.js routes) │
│ - Uses types from console-types                              │
│ - Uses schemas from console-validation                       │
│ - Uses utilities from console-api-key                        │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ Client Layer: core/lightfast (SDK), core/mcp (MCP Server)   │
│ - Re-exports types from console-types (devDependency)        │
│ - DUPLICATES validation logic (should import)                │
└──────────────────────────────────────────────────────────────┘
```

### Current Import Patterns

#### ✅ Well-Structured (No Duplication)

1. **API Key Hashing**: Single implementation in `@repo/console-api-key`, imported by all consumers
2. **ID Generation**: Single `nanoid` utility in `@repo/lib`, imported by crypto package
3. **Type Definitions**: Centralized in `@repo/console-types`, imported as type-only by consumers
4. **Runtime Validation**: Centralized in `@repo/console-validation`, imported by API routes and forms

#### ❌ Duplication Issues

1. **API Key Format Validation**: Implemented in 5+ locations instead of importing `isValidApiKeyFormat()`
2. **API Key Prefix Constant**: Hardcoded `"sk-lf-"` in 5+ locations instead of importing `LIGHTFAST_API_KEY_PREFIX`
3. **Error Hierarchies**: Similar patterns across 3+ packages with inconsistent field names
4. **Env Key Validation**: `.startsWith()` pattern repeated 20+ times

### Dependency Graph

```
core/lightfast
  └── devDependencies
      └── @repo/console-types (type-only imports)
  └── NO DEPENDENCY on @repo/console-api-key (should add)

core/mcp
  └── dependencies
      └── lightfast (SDK package, includes types)
  └── NO DEPENDENCY on @repo/console-api-key (should add)

api/console
  └── dependencies
      ├── @repo/console-types
      ├── @repo/console-validation
      └── @repo/console-api-key ✅

apps/console
  └── dependencies
      ├── @repo/console-types
      ├── @repo/console-validation
      └── @repo/console-api-key ✅
```

---

## Related Research

- Integration Event Types: `packages/console-types/src/integrations/event-types.ts` - Single source of truth for webhook mappings
- Workspace Settings Schema: `packages/console-types/src/workspace.ts` - Versioned schema with migrations
- Neural Memory Types: `packages/console-types/src/neural/` - Entity extraction and source events

---

## Open Questions

1. **Should core packages depend on @repo/console-api-key?**
   - Current: Core packages are devDependency-only on console-types
   - Proposed: Add runtime dependency on console-api-key for validation utilities
   - Trade-off: Increases package size vs reduces duplication

2. **Should validation logic move to a shared utility package?**
   - Current: Each package implements its own validation
   - Proposed: Create `@repo/console-validation-utils` with helpers like `validateApiKeyFormat()`
   - Trade-off: Adds another package vs cleaner separation of concerns

3. **Should error classes use a shared factory?**
   - Current: Each package defines its own error hierarchy
   - Proposed: Create `@repo/error-factory` with base error class and factory function
   - Trade-off: Reduces flexibility vs reduces duplication

4. **Should environment variable validation use a shared Zod helper?**
   - Current: `.startsWith()` pattern repeated 20+ times
   - Proposed: Create `vendorApiKey(prefix)` Zod helper in console-validation
   - Trade-off: Minimal - clear win for DRY principle
