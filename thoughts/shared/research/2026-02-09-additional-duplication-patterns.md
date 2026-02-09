---
date: 2026-02-09T06:25:16+0000
researcher: Claude Sonnet 4.5
git_commit: b0156ee4d1f4fc61cafbb8e7060327b44e042220
branch: main
repository: lightfast
topic: "Additional Duplication Patterns - Utilities, Constants, and Error Handling Beyond Type System"
tags: [research, codebase, duplication, utilities, constants, error-handling, validation, date-time, url-utils]
status: complete
last_updated: 2026-02-09
last_updated_by: Claude Sonnet 4.5
related_research: ["2026-02-09-type-system-standardization.md"]
---

# Research: Additional Duplication Patterns Beyond Type System

**Date**: 2026-02-09T06:25:16+0000
**Researcher**: Claude Sonnet 4.5
**Git Commit**: b0156ee4d1f4fc61cafbb8e7060327b44e042220
**Branch**: main
**Repository**: lightfast

## Research Question

Find additional type and utility duplication patterns across the monorepo beyond the API key issues documented in the initial research. This includes:

1. Duplicated utility functions (formatters, parsers, converters)
2. Duplicated type definitions (especially between @packages and apps/api)
3. Duplicated validation logic (beyond API keys)
4. Duplicated constants and configuration values
5. Similar patterns in error handling, logging, or tracing
6. Duplicated date/time utilities
7. Duplicated URL/path utilities

## Summary

This research uncovered **significant additional duplication patterns** beyond the type system issues documented previously. The findings reveal:

### Critical Duplications (High Priority)

1. **Clerk Error Handling** - 3 identical files (100+ lines each) across `apps/chat`, `apps/console`, `apps/auth`
2. **Tool Error Formatting** - 2 identical files across `apps/chat` and `apps/console`
3. **API Service Base Classes** - 2 nearly identical implementations (`DeusApiService` vs `ChatApiService`)
4. **Relative Time Formatting** - 2 inline implementations with different thresholds
5. **Date Grouping Logic** - Reusable utility in chat app, not shared with console

### Medium Priority Duplications

1. **Timeout Constants** - 30000ms (30 seconds) duplicated in 3+ locations
2. **Cache TTL Constants** - 300s and 3600s repeated in 10+ locations
3. **Pagination Limits** - Values 10, 20, 50, 100 hardcoded in 20+ locations
4. **TRPC Error Utilities** - Simple version in console, comprehensive version in chat (could consolidate)
5. **Date Math Patterns** - Mixed native methods and `date-fns` usage (6+ locations)

### Well-Organized (No Action Needed)

1. **Cryptographic Utilities** - Well-organized in dedicated packages
2. **ID Generation** - Centralized in `@repo/lib`
3. **Array Utilities** - Centralized in `@repo/ui/lib/array`
4. **Pretty Name Generation** - Single implementation

## Detailed Findings

### 1. Duplicated Utility Functions

#### 1.1 Clerk Error Handling (CRITICAL - Exact Duplication)

**Locations**:
- `apps/chat/src/app/lib/clerk/error-handling.ts` (184 lines)
- `apps/console/src/app/lib/clerk/error-handling.ts` (185 lines)
- `apps/auth/src/app/lib/clerk/error-handling.ts` (197 lines)

**Functions duplicated**:
- `getErrorMessage(err: unknown): string`
- `getAllErrors(err: unknown): AuthError[]`
- `isAccountLockedError(err: unknown): { locked: boolean; expiresInSeconds?: number }`
- `isRateLimitError(err: unknown): { rateLimited: boolean; retryAfterSeconds?: number }`
- `formatLockoutTime(seconds: number): string`
- `formatErrorForLogging(context: string, err: unknown): Record<string, unknown>`

**Key aspects**:
- All 3 files have 99% identical code
- `apps/auth` has one additional function: `isSignUpRestricted()` (lines 87-95)
- Minor whitespace differences only
- Used for sign-in/sign-up flows, organization authentication

**Impact**: ~550 lines of duplicated code that needs to be maintained in 3 places.

---

#### 1.2 Tool Error Formatting (CRITICAL - Exact Duplication)

**Locations**:
- `apps/chat/src/app/(chat)/_components/tool-error-utils.ts` (44 lines)
- `apps/console/src/components/answer-tool-error-utils.ts` (44 lines)

**Function duplicated**:
```typescript
interface FormattedToolError {
  formattedError: string;
  isStructured: boolean;
}

export function formatToolErrorPayload(
  errorText: unknown,
  fallback: string,
): FormattedToolError
```

**Key aspects**:
- 100% identical implementation (byte-for-byte)
- Handles JSON parsing/formatting for tool error display
- Used in AI tool call error rendering

**Impact**: 88 total lines of exact duplication.

---

#### 1.3 Relative Time Formatting (Inline Implementations)

**Location 1**: `apps/console/src/components/workspaces-list.tsx:117-135`
```typescript
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 30) return `${diffInDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
```

**Location 2**: `apps/console/src/components/system-health-overview.tsx:206-218`
```typescript
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
```

**Differences**:
- Input type: `string` vs `Date`
- Constants: verbose (`1000 * 60`) vs direct (`60000`)
- Threshold: 30 days vs 7 days
- Fallback: locale with year logic vs simple locale

**Alternative (Library-based)**: 6+ locations use `date-fns` `formatDistanceToNow()`:
- `apps/console/src/components/activity-timeline.tsx:39`
- `apps/console/src/components/jobs-table.tsx:17`
- `apps/console/src/app/(app)/(user)/account/settings/api-key/_components/api-key-list.tsx:25`
- `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/org-api-key-list.tsx:25`
- `apps/console/src/app/(app)/(user)/account/(manage)/settings/sources/_components/sources-list.tsx:16`
- `apps/chat/src/components/sidebar/session-search-dialog.tsx:15`

**Impact**: Inconsistent time formatting across the app, with some using inline functions and others using `date-fns`.

---

#### 1.4 Date Grouping by Recency

**Location**: `apps/chat/src/lib/date.ts:1-49` (Reusable utility)
```typescript
export const DATE_GROUP_ORDER = ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Older"] as const;
export type DateGroup = typeof DATE_GROUP_ORDER[number];

export function groupByDate<T extends { createdAt: Date }>(items: T[]): Record<DateGroup, T[]>
```

**Key aspects**:
- Generic function with type constraint
- Mutates date objects with `setDate()`
- Uses `toDateString()` for day comparison
- Exported constant for consistent ordering

**Usage**: `apps/chat/src/components/sidebar/sessions/grouped-sessions.tsx:3,18`

**Note**: This pattern exists in chat app but not shared with console app, which could benefit from similar grouping.

---

#### 1.5 Duration Formatting

**Location**: `apps/console/src/lib/performance-utils.ts:112-118`
```typescript
export function formatDuration(ms: number): string {
  if (ms === 0) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
```

**Also found** (similar pattern in Clerk error handlers):
```typescript
export function formatLockoutTime(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 1) {
    return remainingSeconds > 0
      ? `1 minute and ${remainingSeconds} seconds`
      : '1 minute';
  }

  return remainingSeconds > 0
    ? `${minutes} minutes and ${remainingSeconds} seconds`
    : `${minutes} minutes`;
}
```

**Key aspects**:
- Multiple time formatting utilities for different contexts
- Console: milliseconds to human units
- Clerk handlers: seconds to minutes/seconds
- No shared time formatting package

---

### 2. Duplicated Type Definitions

#### 2.1 Result/Response Types (8+ Variations)

**Pattern 1**: `Result<T, E>` - Rust-style (AI SDK)
```typescript
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```
**Location**: `core/ai-sdk/src/core/server/result.ts:5-7`

**Pattern 2**: `AuthResult` - API Key Auth
```typescript
export interface AuthSuccess {
  success: true;
  auth: ApiKeyAuthContext;
}

export interface AuthError {
  success: false;
  error: { code: string; message: string };
  status: number;
}

export type AuthResult = AuthSuccess | AuthError;
```
**Location**: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:22-36`

**Pattern 3**: Workspace Access Results (4 similar types)
```typescript
export type WorkspaceAccessResult =
  | { success: true; data: WorkspaceAccessData }
  | { success: false; error: string; errorCode: AuthErrorCode };
```
**Location**: `packages/console-auth-middleware/src/types.ts:90-99` (and 3 more similar)

**Pattern 4**: Webhook Validation Result
```typescript
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}
```
**Location**: `packages/console-webhooks/src/validation.ts:10-14`

**Pattern 5**: OAuth State Validation Result
```typescript
export interface OAuthStateValidationResult {
  valid: boolean;
  error?: OAuthStateValidationError;
  state?: OAuthState;
}
```
**Location**: `packages/console-oauth/src/types.ts:60-69`

**Key aspects**:
- At least 8 different discriminated union patterns for success/error
- Different discriminator keys: `ok`, `success`, `valid`, `verified`
- Different error structures: string vs object vs enum
- No shared base type or factory function

---

#### 2.2 API Error Response Types (Duplicated)

**Pattern 1**: Console API Error
```typescript
export interface APIError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}
```
**Location**: `packages/console-types/src/error.ts:20-29`

**Pattern 2**: Chat API Error Response (Rich version)
```typescript
export interface ApiErrorResponse {
  type: ChatErrorType;
  error: string;         // Technical
  message: string;       // User-facing
  statusCode: number;
  errorCode?: string;
  source?: string;
  category?: string;
  severity?: string;
  metadata?: {
    requestId?: string;
    timestamp?: number;
    modelId?: string;
    isAnonymous?: boolean;
    [key: string]: unknown;
  };
}
```
**Location**: `packages/chat-ai-types/src/errors.ts:48-64`

**Pattern 3**: DUPLICATE in Chat App
**Location**: `apps/chat/src/lib/errors/types.ts:37-53` (EXACT DUPLICATE of Pattern 2)

**Key aspects**:
- Pattern 2 and 3 are exact duplicates (should import from package)
- Different fields: Console uses `code` enum, Chat uses `type` enum
- Chat has richer metadata structure

---

#### 2.3 Config Types (Naming Conflict)

**Three different `LightfastConfig` types**:

1. **SDK Client Config**: `core/lightfast/src/types.ts:91-107`
```typescript
export interface LightfastConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}
```

2. **AI SDK Agent Config**: `core/ai-sdk/src/core/client/index.ts:51-67`
```typescript
export interface LightfastConfig {
  agents: LightfastAgentSet;
  dev?: LightfastDevConfig;
  metadata?: LightfastMetadata;
}
```

3. **Workspace Config (Cached)**: `packages/console-workspace-cache/src/types.ts:5`
```typescript
export interface CachedWorkspaceConfig {
  // ...
}
```

**Key aspects**:
- Same name `LightfastConfig` used in 3 different contexts
- Completely different shapes despite same name
- Potential for import confusion

---

#### 2.4 Embedding Provider Types (DUPLICATE)

**Location 1**: `packages/console-types/src/vector.ts:8-13`
```typescript
export interface EmbeddingProvider {
  readonly dimension: number;
  embed(texts: string[]): Promise<EmbedResponse>;
}

export interface EmbedResponse {
  embeddings: number[][];
  model: string;
  usage?: { totalTokens: number };
}
```

**Location 2**: `vendor/embed/src/types.ts:54-67` (EXACT DUPLICATE)

**Key aspects**:
- 100% identical interfaces
- Should be consolidated to single source

---

### 3. Duplicated Constants

#### 3.1 Timeout Constants

**30000ms (30 seconds) - API Timeout**

**Location 1**: SDK Client - `core/lightfast/src/client.ts:25`
```typescript
const DEFAULT_TIMEOUT = 30000;
```

**Location 2**: AI SDK Tool Timeout - `core/ai-sdk/src/core/v2/env.ts:45`
```typescript
.default(30000)
.describe("Maximum time (ms) for a single tool execution (default: 30000 = 30s)")
```

**Location 3**: SDK Documentation - `apps/docs/src/content/docs/integrate/sdk.mdx:45`
```typescript
timeout: 30000,
```

---

**300 seconds (5 minutes) - Cache TTL / Webhook Max Age**

**Location 1**: Clerk Membership Cache - `packages/console-clerk-cache/src/membership.ts:8`
```typescript
const CACHE_TTL_SECONDS = 300;
```

**Location 2**: Webhook Validation - `packages/console-webhooks/src/common.ts:16`
```typescript
export const DEFAULT_MAX_TIMESTAMP_AGE_SECONDS = 300;
```

**Location 3**: GitHub Webhooks - `packages/console-webhooks/src/github.ts:281`
```typescript
export const GITHUB_MAX_WEBHOOK_AGE_SECONDS = 300;
```

**Location 4-9**: Next.js ISR Revalidation - 6 files in `apps/www/src/app/` and `apps/www/src/components/`
```typescript
export const revalidate = 300;
```

**Impact**: 9 locations define the same 300-second interval.

---

**3600 seconds (1 hour) - Long Cache TTL**

**Location 1**: Workspace Config Cache - `packages/console-workspace-cache/src/config.ts:10`
```typescript
const CACHE_TTL_SECONDS = 3600;
```

**Location 2**: Stream TTL - `core/ai-sdk/src/core/v2/env.ts:51`
```typescript
.default(3600)
```

**Location 3-8**: RSS Feed Revalidation - 6 RSS/feed routes in `apps/www`
```typescript
export const revalidate = 3600;
```

**Impact**: 8 locations define the same 3600-second interval.

---

#### 3.2 Pagination Constants

**limit = 10 (Default Result Limit)**

**Locations**:
- SDK Search Default: `core/lightfast/src/client.ts:85`
- SDK FindSimilar Default: `core/lightfast/src/client.ts:136`
- Entity Search Default: `apps/console/src/lib/neural/entity-search.ts:74`
- Validation Schema: `packages/console-types/src/api/common.ts:28`
- AI SDK Environment: `core/ai-sdk/src/core/v2/env.ts:39`
- Chat Anonymous Limit: `apps/chat/src/hooks/use-anonymous-message-limit.ts:6`

**Impact**: 6+ locations use 10 as default limit.

---

**limit = 20 (Medium Page Size)**

**Locations**:
- Database Connection Pool: `db/console/src/client.ts:14` (max: 20 connections)
- tRPC Jobs List: `api/console/src/router/org/jobs.ts:32`
- Activities List: `api/console/src/router/org/activities.ts:25`
- Chat Session List: `api/chat/src/router/chat/session.ts:21`
- Sidebar Pagination: `apps/chat/src/components/sidebar/types.ts:23`
- Notification Dispatch: `api/console/src/inngest/workflow/notifications/dispatch.ts:30`

**Impact**: 6+ locations use 20 as default limit.

---

**limit = 50, 100 (Large Page Sizes)**

**50**: Temporal state, GitHub PRs, Artifacts query, Jobs table
**100**: Embed batching, Pinecone upsert, Event consumer limit

**Impact**: 10+ locations use 50 or 100 as batch/page size.

---

#### 3.3 Threshold Constants

**0.5 - Similarity Threshold**
- SDK FindSimilar: `core/lightfast/src/client.ts:137`
- Tool Guidance: `apps/console/src/ai/prompts/sections/tool-guidance.ts:39`

**40 - Neural Significance Threshold**
- Observation Scoring: `api/console/src/inngest/workflow/neural/scoring.ts:16`

**60 - Cluster Affinity Threshold**
- Cluster Assignment: `api/console/src/inngest/workflow/neural/cluster-assignment.ts:22`

**70 - Notification Threshold**
- Notification Dispatch: `api/console/src/inngest/workflow/notifications/dispatch.ts:18`

---

### 4. Error Handling Patterns

#### 4.1 API Service Base Classes (Near-Duplicate)

**Implementation 1**: `DeusApiService`
**Location**: `packages/console-api-services/src/base-service.ts:46-193`

**Implementation 2**: `ChatApiService`
**Location**: `packages/chat-api-services/src/base-service.ts:46-188`

**Key aspects**:
- 95% identical implementation
- Only class/constant names differ (`DeusApiError` vs `ChatApiError`)
- Same error normalization cascade
- Same recovery mechanism
- Same structured logging
- Both ~150 lines of nearly identical code

**Impact**: ~300 lines of duplicated base class logic.

---

#### 4.2 TRPC Error Utilities

**Simple version**: `apps/console/src/lib/trpc-errors.ts` (101 lines)
- 3 helper functions
- Basic error extraction

**Comprehensive version**: `apps/chat/src/lib/trpc-errors.ts` (447 lines)
- Error code constants
- 10+ helper functions
- Validation error extraction
- Multiple type checkers
- Context-aware toast messages
- HOF wrapper `withTRPCErrorHandling`
- React hook `useTRPCErrorHandler`

**Key aspects**:
- Significant overlap in core functionality
- Chat version extends console version
- Could consolidate into shared package with optional features

---

#### 4.3 Error Boundary Components

**Similar implementations**:
- `apps/console/src/components/errors/org-page-error-boundary.tsx`
- `apps/console/src/components/errors/page-error-boundary.tsx`
- `apps/console/src/components/errors/settings-page-error-boundary.tsx`
- `apps/chat/src/components/sidebar/threads-error-boundary.tsx`

**Pattern**:
```typescript
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State
  componentDidCatch(error: Error, errorInfo: ErrorInfo)
  reset = () => { /* ... */ }
  render() { /* context-specific error UI */ }
}
```

**Key aspects**:
- All follow same structure
- Error type classification from message
- Context-specific error messages
- Recovery actions differ per context
- Could extract base class with overrideable render

---

### 5. Date/Time Utilities

**Summary of duplication**:

1. **Relative Time Formatting**:
   - 2 inline implementations with different thresholds
   - 6+ locations using `date-fns` library

2. **Date Grouping**:
   - Reusable utility in chat app only
   - Inline time series grouping in performance utils

3. **Date Formatting**:
   - ISO strings: 30+ locations (for database/API)
   - Localized: 10+ locations with various options
   - MySQL format: 1 shared utility in `packages/lib/src/datetime/`
   - Custom formats: `date-fns` `format()` in billing

4. **Date Math**:
   - Native methods: `setDate()`, `setMonth()` (mutation-based)
   - `date-fns`: `subDays()`, `differenceInHours()` (immutable)
   - Mixed usage across codebase

5. **Millisecond Constants**:
   - Verbose: `(1000 * 60 * 60)` in some files
   - Direct: `3600000` in other files
   - Same values, different representations

---

### 6. URL/Path Utilities

**Summary of patterns**:

1. **Base URL Generation**:
   - `apps/console/src/lib/base-url.ts` (environment-aware)
   - `apps/www/src/lib/base-url.ts` (similar with client/server detection)
   - Both handle production/preview/development differently

2. **Cross-App URLs**:
   - `withRelatedProject()` pattern in 4 apps
   - All similar implementations for microfrontend coordination

3. **OAuth URL Building**:
   - Similar patterns in GitHub and Vercel OAuth routes
   - Query parameter extraction and validation
   - State management with cookies

4. **URL Encoding**:
   - `encodeURIComponent()` for single values
   - `new URLSearchParams()` for multiple params
   - Base64URL encoding for OAuth state/PKCE

5. **Slug Generation**:
   - Custom `slugify()` in CMS workflows
   - Pattern: lowercase + special char removal + hyphen replacement

**Impact**: URL utilities are relatively well-organized with `@repo/url-utils` and `@repo/app-urls`, but some duplication exists in OAuth flows.

---

## Code References

### Exact Duplications (High Priority)

**Clerk Error Handling**:
- `apps/chat/src/app/lib/clerk/error-handling.ts:1-184`
- `apps/console/src/app/lib/clerk/error-handling.ts:1-185`
- `apps/auth/src/app/lib/clerk/error-handling.ts:1-197`

**Tool Error Formatting**:
- `apps/chat/src/app/(chat)/_components/tool-error-utils.ts:7-43`
- `apps/console/src/components/answer-tool-error-utils.ts:7-43`

**API Service Base Classes**:
- `packages/console-api-services/src/base-service.ts:46-193`
- `packages/chat-api-services/src/base-service.ts:46-188`

**Embedding Provider Types**:
- `packages/console-types/src/vector.ts:8-13`
- `vendor/embed/src/types.ts:54-67`

**Chat API Error Response**:
- `packages/chat-ai-types/src/errors.ts:48-64` (canonical)
- `apps/chat/src/lib/errors/types.ts:37-53` (duplicate)

### Inline Implementations (Should Extract)

**Relative Time Formatting**:
- `apps/console/src/components/workspaces-list.tsx:117-135`
- `apps/console/src/components/system-health-overview.tsx:206-218`

**Date Grouping**:
- `apps/chat/src/lib/date.ts:1-49` (reusable but chat-only)

**Duration Formatting**:
- `apps/console/src/lib/performance-utils.ts:112-118`
- Clerk handlers: `formatLockoutTime()` in 3 files

### Constants (Should Centralize)

**Timeouts**:
- 30000ms: `core/lightfast/src/client.ts:25`, `core/ai-sdk/src/core/v2/env.ts:45`
- 300s: 9 locations across packages and apps
- 3600s: 8 locations across packages and apps

**Pagination Limits**:
- 10: 6+ locations
- 20: 6+ locations
- 50: 4+ locations
- 100: 4+ locations

**Thresholds**:
- 0.5: 2 locations
- 40, 60, 70: Neural scoring thresholds in single file each

### Error Handling (Should Consolidate)

**TRPC Error Utilities**:
- `apps/console/src/lib/trpc-errors.ts:1-101` (simple)
- `apps/chat/src/lib/trpc-errors.ts:1-447` (comprehensive)

**Error Boundaries**:
- 4 similar implementations across `apps/console` and `apps/chat`

**Clerk Error Handlers**:
- 3 files with Sentry integration across apps

---

## Architecture Documentation

### Duplication Categories by Severity

#### Critical (Exact Duplicates - Consolidate Immediately)
1. Clerk error handling (3 files × ~180 lines = ~540 lines)
2. Tool error formatting (2 files × 44 lines = 88 lines)
3. API service base classes (2 files × ~150 lines = ~300 lines)
4. Embedding provider types (2 files × ~20 lines = 40 lines)
5. Chat API error response type (2 files × ~20 lines = 40 lines)

**Total**: ~1,000 lines of exact duplication

#### High Priority (Similar Patterns - Extract to Shared Package)
1. Relative time formatting (2 inline + 6 library-based)
2. Date grouping utilities (chat-specific, not shared)
3. Duration formatting (2 implementations)
4. TRPC error utilities (simple + comprehensive versions)
5. Error boundary base pattern (4 similar implementations)

**Total**: ~500 lines of similar patterns

#### Medium Priority (Constants - Centralize in Config)
1. Timeout constants (30000ms, 300s, 3600s) - 17+ locations
2. Pagination limits (10, 20, 50, 100) - 20+ locations
3. Threshold values (0.5, 40, 60, 70) - 5+ locations

**Total**: 40+ hardcoded values that should be constants

#### Low Priority (Well-Organized)
1. Cryptographic utilities - Already well-organized
2. ID generation - Centralized in `@repo/lib`
3. Array utilities - Centralized in `@repo/ui`
4. URL utilities - Mostly centralized with some OAuth duplication

---

### Recommended Consolidation Strategy

#### Phase 1: Exact Duplicates (Critical)
1. Create `@repo/clerk-error-handling` package
   - Move Clerk error handlers from 3 apps
   - Export shared utilities
   - Each app imports and uses

2. Create `@repo/tool-error-formatting` or add to existing UI package
   - Move tool error formatter to shared location
   - Apps import from shared package

3. Consolidate API service base classes
   - Extract common base to `@repo/api-service-base`
   - Console and Chat services extend base

4. Remove embedding provider duplicate
   - Keep in `packages/console-types`
   - Remove from `vendor/embed`

5. Remove chat API error duplicate
   - Keep in `packages/chat-ai-types`
   - Remove from `apps/chat/src/lib/errors/types.ts`

#### Phase 2: Utility Functions (High Priority)
1. Create `@repo/date-time-utils` package
   - `formatRelativeTime()` with options
   - `groupByDate()` generic function
   - `formatDuration()` for ms/seconds
   - Consistent date math wrappers

2. Enhance `@repo/ui` or create `@repo/error-utils`
   - Error boundary base class
   - TRPC error utilities (merged version)
   - Standard error formatting

#### Phase 3: Constants (Medium Priority)
1. Create `@repo/constants` package
   - `TIMEOUT_MS` constants
   - `CACHE_TTL_SECONDS` constants
   - `PAGINATION_DEFAULTS` constants
   - `SIMILARITY_THRESHOLDS` constants

2. Update all files to import from constants package

#### Phase 4: Type Consolidation (Medium Priority)
1. Create `@repo/result-types` or add to existing types package
   - Generic `Result<T, E>` type
   - Factory functions for common patterns
   - Consistent discriminator keys

2. Resolve `LightfastConfig` naming conflicts
   - Rename to be more specific:
     - `LightfastSdkConfig`
     - `LightfastAgentConfig`
     - `WorkspaceSearchConfig`

---

## Related Research

- [2026-02-09-type-system-standardization.md](./2026-02-09-type-system-standardization.md) - Initial research on type system duplication, particularly API key validation

---

## Open Questions

1. **Should we create a monorepo-wide utilities package?**
   - Current: Utilities scattered across `@repo/lib`, `@repo/ui`, and inline
   - Proposed: Consolidate common utilities into `@repo/utils` or similar
   - Trade-off: Better organization vs more packages

2. **Should constants be in a single package or distributed?**
   - Current: Hardcoded across 40+ locations
   - Option A: Single `@repo/constants` package
   - Option B: Domain-specific constant packages (`@repo/api-constants`, `@repo/cache-constants`)
   - Trade-off: Central source of truth vs domain cohesion

3. **How should we handle app-specific variations?**
   - Example: Chat TRPC error utils have features console doesn't need
   - Option A: Single package with optional features
   - Option B: Separate packages with shared base
   - Trade-off: DRY vs YAGNI principles

4. **Should error boundaries use composition or inheritance?**
   - Current: Each app has similar error boundary implementations
   - Option A: Base class with overrideable methods
   - Option B: Composable error boundary with render props
   - Trade-off: Familiarity vs flexibility
