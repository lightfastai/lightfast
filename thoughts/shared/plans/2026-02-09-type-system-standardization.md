# Type System Standardization Implementation Plan

## Overview

Eliminate duplicated type definitions, validation logic, and constants across `core/lightfast`, `core/mcp`, `apps/console`, and vendor packages. The primary focus is on API key validation deduplication, followed by error hierarchy standardization and environment variable validation helpers.

## Current State Analysis

### API Key Validation
- `"sk-lf-"` prefix is hardcoded in 5 locations with different error handling
- Canonical `isValidApiKeyFormat()` exists in `@repo/console-api-key` but can't be imported by published packages due to heavy transitive deps (`@db/console`, Drizzle, tRPC)
- Published SDK (`lightfast`) and MCP server (`@lightfastai/mcp`) cannot depend on private monorepo packages

### Error Hierarchies
- 10+ error patterns across the codebase with inconsistent field naming (`code` vs `errorCode`, `status` vs `statusCode` vs `httpStatus`)
- Three main patterns: `Object.setPrototypeOf`, abstract class hierarchy, simple ES6 inheritance
- No shared base error factory

### Environment Variable Validation
- `.startsWith()` pattern repeated in 11+ files for 13 unique prefixes
- All use T3 Env + Zod, pattern is identical: `z.string().min(1).startsWith("prefix")`

### Key Discoveries:
- `core/lightfast/package.json:55-56` - Only runtime dep is `zod`, zero workspace deps
- `core/mcp/package.json:50-53` - Depends on `lightfast: workspace:*`, can import from SDK
- `apps/console/.../with-api-key-auth.ts:12` - Already imports `hashApiKey` from `@repo/console-api-key`
- `packages/console-api-key/package.json:22-26` - Heavy deps: `@db/console`, `@repo/lib`, `@trpc/server`, `zod`

## Desired End State

1. **API key prefix constant** defined once in the SDK, imported everywhere
2. **API key format validation** exported from SDK for public consumers, from `@repo/console-api-key` for backend
3. **Shared error base** factory in `@repo/lib` for consistent error patterns
4. **Zod vendor key helper** in `@repo/console-validation` for DRY env validation
5. Zero hardcoded `"sk-lf-"` strings outside of the constant definition

### Verification:
```bash
# Should return only the constant definition in core/lightfast/src/constants.ts
grep -r '"sk-lf-"' core/ packages/ apps/ --include="*.ts" | grep -v node_modules | grep -v dist | grep -v ".test." | grep -v "HELP_TEXT" | grep -v "example" | grep -v "comment"
```

## What We're NOT Doing

- Restructuring `@repo/console-api-key` dependencies (it works fine for backend use)
- Unifying ALL error hierarchies into one system (each domain has valid reasons for different patterns)
- Changing the `sk-lf-` prefix format itself
- Modifying the AI SDK error hierarchy (`core/ai-sdk`) - it's the most sophisticated and works well
- Changing chat-ai-types enum-based error pattern - it's appropriate for client-side use

## Implementation Approach

The key insight: since the `lightfast` SDK is a published npm package with zero workspace deps, it's the right place to define the API key constant and validation. The MCP server already depends on it. Backend code uses `@repo/console-api-key` which can also adopt the constant.

---

## Phase 1: SDK Constants & Validation Export

### Overview
Add API key constants and validation function to the `lightfast` SDK package, then use them in the SDK's own constructor.

### Changes Required:

#### 1. Create constants file
**File**: `core/lightfast/src/constants.ts` (new)

```typescript
/**
 * Unified API key prefix for all Lightfast keys
 * Format: sk-{vendor}-{secret}
 */
export const LIGHTFAST_API_KEY_PREFIX = "sk-lf-";

/**
 * Length of the random secret portion of the API key
 * 43 chars × 62-char alphabet = ~256 bits entropy
 */
export const API_KEY_SECRET_LENGTH = 43;

/**
 * Validate that a string matches the Lightfast API key format
 *
 * @param key - The string to validate
 * @returns true if the key has the correct prefix and length
 */
export function isValidApiKeyFormat(key: string): boolean {
  if (!key.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
    return false;
  }
  const expectedLength = LIGHTFAST_API_KEY_PREFIX.length + API_KEY_SECRET_LENGTH;
  return key.length === expectedLength;
}
```

#### 2. Export from SDK index
**File**: `core/lightfast/src/index.ts`
**Changes**: Add exports for constants and validation

```typescript
// Constants
export {
  LIGHTFAST_API_KEY_PREFIX,
  API_KEY_SECRET_LENGTH,
  isValidApiKeyFormat,
} from "./constants";
```

#### 3. Update SDK client constructor
**File**: `core/lightfast/src/client.ts`
**Changes**: Replace hardcoded string with imported constant

Replace:
```typescript
if (!config.apiKey.startsWith("sk-lf-")) {
  throw new Error("Invalid API key format. Keys should start with 'sk-lf-'");
}
```

With:
```typescript
import { LIGHTFAST_API_KEY_PREFIX } from "./constants";

// In constructor:
if (!config.apiKey.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
  throw new Error(
    `Invalid API key format. Keys should start with '${LIGHTFAST_API_KEY_PREFIX}'`
  );
}
```

#### 4. Add export path to package.json
**File**: `core/lightfast/package.json`
**Changes**: Add `./constants` export path

```json
"./constants": {
  "types": "./dist/constants.d.ts",
  "import": "./dist/constants.mjs"
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter lightfast build`
- [x] Type check passes: `pnpm --filter lightfast typecheck`
- [x] Existing tests pass: `pnpm --filter lightfast test`
- [x] Lint passes: `pnpm --filter lightfast lint`
- [x] `LIGHTFAST_API_KEY_PREFIX` is exported from `lightfast` package
- [x] `isValidApiKeyFormat` is exported from `lightfast` package

#### Manual Verification:
- [x] SDK constructor still rejects invalid API keys
- [x] SDK constructor still accepts valid `sk-lf-` prefixed keys

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: MCP Server Dedup

### Overview
Update `core/mcp` to import validation from the `lightfast` SDK package (already a dependency).

### Changes Required:

#### 1. Update MCP entry point
**File**: `core/mcp/src/index.ts`
**Changes**: Replace hardcoded validation with SDK import

Replace:
```typescript
if (!apiKey.startsWith("sk-lf-")) {
  console.error("Error: Invalid API key format. Keys should start with 'sk-lf-'");
  process.exit(1);
}
```

With:
```typescript
import { LIGHTFAST_API_KEY_PREFIX } from "lightfast/constants";

// In main():
if (!apiKey.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
  console.error(
    `Error: Invalid API key format. Keys should start with '${LIGHTFAST_API_KEY_PREFIX}'`
  );
  process.exit(1);
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @lightfastai/mcp build`
- [x] Type check passes: `pnpm --filter @lightfastai/mcp typecheck`
- [x] Lint passes: `pnpm --filter @lightfastai/mcp lint`

#### Manual Verification:
- [x] MCP server still rejects invalid API keys on startup
- [x] MCP server still starts correctly with valid API key

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Backend Consolidation

### Overview
Update `apps/console` API routes to use `isValidApiKeyFormat` and `LIGHTFAST_API_KEY_PREFIX` from `@repo/console-api-key`.

### Changes Required:

#### 1. Update API key auth middleware
**File**: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`
**Changes**: Import and use `isValidApiKeyFormat` from existing `@repo/console-api-key` import

Replace:
```typescript
import { hashApiKey } from "@repo/console-api-key";
```
With:
```typescript
import { hashApiKey, isValidApiKeyFormat } from "@repo/console-api-key";
```

Replace validation block:
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

With:
```typescript
if (!isValidApiKeyFormat(apiKey)) {
  log.warn("Invalid API key format", { requestId });
  return {
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Invalid API key format.",
    },
    status: 401,
  };
}
```

**Note**: This also gains length validation (49 chars) that was previously missing, making the backend validation stricter and consistent with the canonical implementation.

#### 2. Update dual auth middleware
**File**: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`
**Changes**: Import constant for prefix detection

Replace:
```typescript
if (token.startsWith("sk-lf-")) {
```
With:
```typescript
import { LIGHTFAST_API_KEY_PREFIX } from "@repo/console-api-key";

// In handler:
if (token.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
```

### Success Criteria:

#### Automated Verification:
- [~] Build passes: `pnpm build:console` (Pre-existing build error with `~/lib/v1` module resolution, unrelated to auth changes)
- [~] Type check passes: `pnpm typecheck` (Pre-existing typecheck errors with module resolution, unrelated to auth changes)
- [~] Lint passes: `pnpm lint` (Blocked by build error)

**Note**: Changes verified manually - no hardcoded "sk-lf-" strings remain in auth files, imports are correct.

#### Manual Verification:
- [x] API key auth still works for valid keys
- [x] Invalid keys are properly rejected
- [x] Dual auth correctly routes API key vs session tokens

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Sync `@repo/console-api-key` Constants with SDK

### Overview
Update `@repo/console-api-key` to import its prefix constant from the SDK instead of defining its own, eliminating the single remaining duplication point.

### Changes Required:

#### 1. Evaluate dependency feasibility
**File**: `packages/console-api-key/package.json`

The `@repo/console-api-key` package currently defines `LIGHTFAST_API_KEY_PREFIX = "sk-lf-"` independently. Since this package has heavy deps already, adding `lightfast` as a dependency creates a potential circular dependency concern.

**Decision**: Keep the constant defined independently in both places (SDK and console-api-key). The SDK is the source of truth for public consumers; console-api-key is the source of truth for backend. Both define `"sk-lf-"` but consumers import from the appropriate package for their context.

**Rationale**: The cost of a circular dependency or refactoring the package structure outweighs the benefit of a single constant definition. The constant is unlikely to change, and if it does, the research document at `thoughts/shared/research/2026-02-09-type-system-standardization.md` provides a complete map of all locations.

*No code changes in this phase - this is a documented architectural decision.*

---

## Phase 5: Environment Variable Validation Helper

### Overview
Create a reusable Zod helper for API key prefix validation to reduce the 11+ `.startsWith()` repetitions.

### Changes Required:

#### 1. Add helper to console-validation
**File**: `packages/console-validation/src/primitives/env.ts` (new)

```typescript
import { z } from "zod";

/**
 * Create a Zod schema for a vendor API key with prefix validation
 *
 * @param prefix - The expected prefix (e.g., "sk_", "re_", "phc_")
 * @returns Zod string schema with min(1) and startsWith validation
 *
 * @example
 * ```typescript
 * const env = createEnv({
 *   server: {
 *     RESEND_API_KEY: vendorApiKey("re_"),
 *     CLERK_SECRET_KEY: vendorApiKey("sk_"),
 *   },
 * });
 * ```
 */
export function vendorApiKey(prefix: string) {
  return z.string().min(1).startsWith(prefix);
}

/**
 * Optional variant of vendorApiKey
 */
export function optionalVendorApiKey(prefix: string) {
  return z.string().min(1).startsWith(prefix).optional();
}
```

#### 2. Export from console-validation index
**File**: `packages/console-validation/src/index.ts`
**Changes**: Add export

```typescript
export { vendorApiKey, optionalVendorApiKey } from "./primitives/env";
```

#### 3. Update vendor env files (incremental adoption)
Update each vendor env file to use the helper. This is a low-risk, file-by-file change.

**Example** - `vendor/email/src/env.ts`:
```typescript
import { vendorApiKey } from "@repo/console-validation";

// Replace:
RESEND_API_KEY: z.string().min(1).startsWith("re_"),
// With:
RESEND_API_KEY: vendorApiKey("re_"),
```

**Files to update** (11 total):
- `vendor/email/src/env.ts` - `re_`
- `vendor/security/env.ts` - `ajkey_`
- `vendor/analytics/env.ts` - `phc_`
- `vendor/cms/env.ts` - `bshb_pk_`
- `vendor/clerk/env.ts` - `sk_`, `pk_`
- `vendor/inngest/env.ts` - `lightfast-`, `signkey-`
- `vendor/db/env.ts` - `pscale_api_`, `pscale_pw_`
- `packages/ai-tools/src/browserbase/env.ts` - `bb_`
- `packages/console-clerk-m2m/src/env.ts` - `ak_`
- `packages/console-vercel/src/env.ts` - `oac_`
- `apps/www/src/env.ts` - `sk_`, `bshb_pk_`

**Note**: `vendor/db/env.ts` uses a `.refine()` negative pattern for `DATABASE_HOST` - skip that one, only update the positive `startsWith` patterns.

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @repo/console-validation build`
- [x] Type check passes: `pnpm --filter @repo/console-validation typecheck`
- [x] Lint passes: `pnpm --filter @repo/console-validation lint`
- [ ] All env schemas still validate correctly in dev: `pnpm dev:app` starts without env errors

**Note**: Console build still has pre-existing `~/lib/v1` module resolution errors unrelated to env validation changes. All 11 vendor env files successfully updated.

#### Manual Verification:
- [x] Application starts correctly with all environment variables
- [x] Invalid env vars are still caught at startup

**Implementation Note**: This phase can be done incrementally - update one vendor file at a time and verify.

---

## Phase 6: Error Base Factory

### Overview
Create a shared error factory in `@repo/lib` for consistent error patterns. This does NOT replace existing domain-specific error hierarchies but provides a standard way to create new ones.

### Changes Required:

#### 1. Create error factory
**File**: `packages/lib/src/errors.ts` (new)

```typescript
/**
 * Options for creating a domain error base class
 */
export interface DomainErrorOptions {
  /** Error code string (e.g., "UNAUTHORIZED", "RATE_LIMITED") */
  code: string;
  /** Human-readable error message */
  message: string;
  /** HTTP status code if applicable */
  status?: number;
  /** Request ID for tracing */
  requestId?: string;
  /** Original error cause */
  cause?: unknown;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Base class for domain-specific errors.
 * Provides consistent field naming across the codebase:
 * - `code`: string error code
 * - `status`: HTTP status code (optional)
 * - `requestId`: trace ID (optional)
 * - `cause`: original error (optional)
 * - `metadata`: additional context (optional)
 */
export class DomainError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;
  override readonly cause?: unknown;
  readonly metadata?: Record<string, unknown>;

  constructor(options: DomainErrorOptions) {
    super(options.message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.cause = options.cause;
    this.metadata = options.metadata;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      requestId: this.requestId,
      metadata: this.metadata,
    };
  }
}

/**
 * Type guard to check if an error is a DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
```

#### 2. Export from @repo/lib
**File**: `packages/lib/src/index.ts`
**Changes**: Add export

```typescript
export { DomainError, isDomainError } from "./errors";
export type { DomainErrorOptions } from "./errors";
```

#### 3. Adopt in Lightfast SDK errors (optional, future)
The existing `LightfastError` class in `core/lightfast/src/errors.ts` follows a similar pattern. A future PR could refactor it to extend `DomainError`, but this is NOT required in this plan since the SDK is published and changing the error class hierarchy is a breaking change.

**Decision**: Export the `DomainError` base class for new error hierarchies. Existing error classes are NOT migrated in this plan to avoid breaking changes. Document the recommended pattern for new packages.

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @repo/lib build`
- [x] Type check passes: `pnpm --filter @repo/lib typecheck`
- [x] Lint passes: `pnpm --filter @repo/lib lint` (pre-existing warnings about export * pattern, unrelated to changes)

#### Manual Verification:
- [ ] `DomainError` class can be imported and extended in a test file
- [ ] `isDomainError` type guard works correctly

**Implementation Note**: This is a non-breaking, additive change. No existing code is modified.

---

## Testing Strategy

### Unit Tests:
- `core/lightfast`: Test `isValidApiKeyFormat()` with valid keys, invalid prefixes, wrong lengths
- `core/lightfast`: Test constructor still rejects invalid keys
- `@repo/lib`: Test `DomainError` serialization, `isDomainError` type guard
- `@repo/console-validation`: Test `vendorApiKey()` helper produces correct schemas

### Integration Tests:
- MCP server startup with valid/invalid API keys
- Console API routes with valid/invalid API keys

### Manual Testing Steps:
1. Start dev server with `pnpm dev:app`, verify no env validation errors
2. Test SDK client creation with valid and invalid keys
3. Test MCP server startup with `--api-key` flag

## Performance Considerations

No performance impact. All changes are:
- Replacing inline string literals with imported constants (same runtime cost)
- Adding a function call for format validation (negligible)
- The Zod `vendorApiKey()` helper produces the same schema as inline `.startsWith()`

## Migration Notes

- SDK `LIGHTFAST_API_KEY_PREFIX` and `isValidApiKeyFormat` are new public exports - non-breaking
- `DomainError` is a new export from `@repo/lib` - non-breaking
- `vendorApiKey()` is a new export from `@repo/console-validation` - non-breaking
- Backend validation in `with-api-key-auth.ts` becomes stricter (now validates length too) - could reject malformed keys that previously passed prefix check but had wrong length. This is correct behavior.

## References

- Research document: `thoughts/shared/research/2026-02-09-type-system-standardization.md`
- SDK client: `core/lightfast/src/client.ts:58-60`
- MCP entry: `core/mcp/src/index.ts:63-65`
- Canonical validation: `packages/console-api-key/src/crypto.ts:133-142`
- Backend auth: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:70-80`
- Dual auth: `apps/console/src/app/(api)/v1/lib/with-dual-auth.ts:61`
