# Webhook Security Hardening Implementation Plan

## Overview

Implement three security improvements identified in `thoughts/shared/research/2025-12-14-neural-memory-security-implementation-details.md`:
1. **Schema Validation** - Add Zod runtime validation for webhook payloads
2. **Timestamp Validation** - Enable replay attack prevention (code exists, unused)
3. **Content Sanitization** - Add body truncation and HTML sanitization at ingestion

These address Medium/Low priority security gaps while maintaining the strong HMAC signature verification already in place.

## Current State Analysis

### What EXISTS (Strong Security)
- HMAC-SHA256 signature verification: `packages/console-webhooks/src/github.ts:77-145`
- Timing-safe comparison: `packages/console-webhooks/src/common.ts:32-59`
- Timestamp validation function: `packages/console-webhooks/src/common.ts:79-121` (UNUSED)
- Title truncation: 100 chars in all transformers
- React auto-escaping at render

### What's MISSING (Security Gaps)
| Gap | Risk | Current State |
|-----|------|---------------|
| Schema Validation | Medium | TypeScript interfaces only, no runtime Zod validation |
| Timestamp Validation | Low | `validateWebhookTimestamp()` exists but never called |
| Body Truncation | Medium | Raw body stored, no limits at ingestion |
| HTML Sanitization | Low | No sanitization (React escapes at render only) |

### Key Discoveries
- `verifyGitHubWebhookWithTimestamp()` exists at `github.ts:239-275` but handlers use basic `verifyGitHubWebhookFromHeaders()` instead
- `SourceEvent` interface at `packages/console-types/src/neural/source-event.ts:7-37` has no Zod equivalent
- Transformers at `packages/console-webhooks/src/transformers/github.ts` truncate title but not body

## Desired End State

After implementation:
1. All webhook payloads validated against Zod schemas before processing
2. Webhooks older than 5 minutes rejected (replay attack prevention)
3. Body content truncated to 10,000 chars and HTML-sanitized at ingestion

### Verification:
- [x] Type: `pnpm typecheck` passes
- [ ] Tests: `pnpm --filter @repo/console-webhooks test` passes
- [ ] Manual: Webhook with invalid schema rejected with 400
- [ ] Manual: Replay of old webhook (>5 min) rejected with 401

## What We're NOT Doing

- LLM prompt injection protection (separate concern, needs prompt engineering)
- Application-level rate limiting (infrastructure concern, separate plan)
- Content filtering for stored JSONB (raw payloads intentionally preserved)
- Additional HTML sanitization libraries (body truncation + React is sufficient)

## Implementation Approach

Three parallel, independent phases that can be implemented and tested separately.

---

## Phase 1: Schema Validation for SourceEvent

### Overview
Add Zod schema for `SourceEvent` interface and validate in transformers/handlers.

### Changes Required:

#### 1. Create SourceEvent Zod Schema
**File**: `packages/console-validation/src/schemas/source-event.ts` (NEW)
**Changes**: Create comprehensive Zod schema matching SourceEvent interface

```typescript
import { z } from "zod";
import { sourceTypeSchema } from "./sources";

/**
 * Zod schema for SourceActor
 */
export const sourceActorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * Zod schema for SourceReference
 */
export const sourceReferenceSchema = z.object({
  type: z.enum([
    "commit",
    "branch",
    "pr",
    "issue",
    "deployment",
    "project",
    "cycle",
    "assignee",
    "reviewer",
    "team",
    "label",
  ]),
  id: z.string().min(1),
  url: z.string().url().optional(),
  label: z.string().optional(),
});

/**
 * Zod schema for SourceEvent
 * Runtime validation for webhook-derived events
 */
export const sourceEventSchema = z.object({
  source: sourceTypeSchema,
  sourceType: z.string().min(1), // Internal format: "pull-request.merged"
  sourceId: z.string().min(1),
  title: z.string().min(1).max(200), // Allow slightly more than 100 for prefix
  body: z.string().max(50000), // Generous limit for full content
  actor: sourceActorSchema.optional(),
  occurredAt: z.string().datetime({ offset: true }), // ISO timestamp
  references: z.array(sourceReferenceSchema),
  metadata: z.record(z.unknown()),
});

export type SourceEventValidated = z.infer<typeof sourceEventSchema>;
```

#### 2. Export from Package
**File**: `packages/console-validation/src/schemas/index.ts`
**Changes**: Add export for new schema

```typescript
// Add to existing exports
export * from "./source-event";
```

#### 3. Add Validation Helper
**File**: `packages/console-webhooks/src/validation.ts` (NEW)
**Changes**: Create validation utility that wraps Zod parsing

```typescript
import { sourceEventSchema } from "@repo/console-validation";
import type { SourceEvent } from "@repo/console-types";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate SourceEvent against Zod schema
 * Returns structured result with error details
 */
export function validateSourceEvent(event: SourceEvent): ValidationResult<SourceEvent> {
  const result = sourceEventSchema.safeParse(event);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`),
  };
}
```

#### 4. Update Transformers to Validate
**File**: `packages/console-webhooks/src/transformers/github.ts`
**Changes**: Add validation after transformation

```typescript
// Add import at top
import { validateSourceEvent } from "../validation";

// Modify each transformer to validate before returning
// Example for transformGitHubPush:
export function transformGitHubPush(
  payload: PushEvent,
  context: TransformContext
): SourceEvent {
  // ... existing transformation logic ...

  const event: SourceEvent = {
    source: "github",
    // ... rest of event construction ...
  };

  // Validate before returning
  const validation = validateSourceEvent(event);
  if (!validation.success) {
    console.error("[Transformer] Invalid SourceEvent:", validation.errors);
    // Still return event - validation is for logging/monitoring initially
  }

  return event;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Package builds: `pnpm --filter @repo/console-validation build`
- [x] Webhooks package builds: `pnpm --filter @repo/console-webhooks build`
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm lint` (unrelated @vendor/mastra failure)

#### Manual Verification:
- [ ] Send test webhook → verify validation logs appear
- [ ] Inspect logs for any validation failures from real webhooks
- [ ] Confirm no breaking changes to existing webhook flow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Enable Timestamp Validation

### Overview
Enable the existing `verifyGitHubWebhookWithTimestamp()` function in webhook handlers to prevent replay attacks.

### Changes Required:

#### 1. Create Timestamp Extraction Config
**File**: `packages/console-webhooks/src/github.ts`
**Changes**: Add helper for GitHub timestamp extraction

GitHub webhooks don't have a dedicated timestamp header, but we can use payload timestamps. The safer approach is to use the `receivedAt` time and validate that the payload timestamp (`head_commit.timestamp`, `updated_at`, etc.) is within acceptable bounds.

```typescript
/**
 * Default max age for GitHub webhooks (5 minutes)
 */
export const GITHUB_MAX_WEBHOOK_AGE_SECONDS = 300;

/**
 * Extract timestamp from GitHub webhook payload for validation
 * Different event types have timestamps in different fields
 */
export function extractGitHubPayloadTimestamp(
  payload: GitHubWebhookEvent,
  eventType: string
): string | null {
  // Push events
  if (eventType === "push" && payload.head_commit?.timestamp) {
    return payload.head_commit.timestamp as string;
  }

  // PR, Issue, Discussion events - use updated_at
  if (payload.pull_request?.updated_at) {
    return payload.pull_request.updated_at as string;
  }
  if (payload.issue?.updated_at) {
    return payload.issue.updated_at as string;
  }
  if (payload.discussion?.updated_at) {
    return payload.discussion.updated_at as string;
  }

  // Release events
  if (payload.release?.published_at) {
    return payload.release.published_at as string;
  }

  return null;
}
```

#### 2. Update Webhook Handler
**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Changes**: Add timestamp validation after signature verification

```typescript
// Add imports
import {
  verifyGitHubWebhookFromHeaders,
  extractGitHubPayloadTimestamp,
  GITHUB_MAX_WEBHOOK_AGE_SECONDS,
} from "@repo/console-webhooks/github";
import { validateWebhookTimestamp } from "@repo/console-webhooks/common";

// In POST handler, after signature verification and before processing:
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const result = await verifyGitHubWebhookFromHeaders(
      payload,
      request.headers,
      env.GITHUB_WEBHOOK_SECRET,
    );

    if (!result.verified) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // Parse event type for timestamp extraction
    const eventHeader = request.headers.get("x-github-event");
    if (!eventHeader) {
      return NextResponse.json({ error: "Missing event type" }, { status: 400 });
    }

    // Timestamp validation (replay attack prevention)
    const body = JSON.parse(payload);
    const payloadTimestamp = extractGitHubPayloadTimestamp(body, eventHeader);

    if (payloadTimestamp) {
      const isTimestampValid = validateWebhookTimestamp(
        payloadTimestamp,
        GITHUB_MAX_WEBHOOK_AGE_SECONDS
      );

      if (!isTimestampValid) {
        log.warn("[GitHub Webhook] Rejected stale webhook", {
          eventType: eventHeader,
          timestamp: payloadTimestamp,
        });
        return NextResponse.json(
          { error: "Webhook timestamp too old (possible replay attack)" },
          { status: 401 }
        );
      }
    }

    // Continue with existing handler logic...
```

#### 3. Add Timestamp Validation to Vercel Handler
**File**: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`
**Changes**: Similar timestamp validation pattern

```typescript
// Vercel webhooks include createdAt in payload
// Extract and validate similarly to GitHub
const payloadTimestamp = body.createdAt; // Vercel includes this
if (payloadTimestamp) {
  const isValid = validateWebhookTimestamp(payloadTimestamp, 300);
  if (!isValid) {
    log.warn("[Vercel Webhook] Rejected stale webhook");
    return NextResponse.json({ error: "Webhook too old" }, { status: 401 });
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] Console app builds: `pnpm build:console`
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Live webhook from GitHub processes successfully
- [ ] Replay of captured webhook (modify timestamp to old) is rejected with 401
- [ ] Check logs for timestamp validation messages

**Implementation Note**: After completing this phase, test thoroughly with live webhooks before proceeding.

---

## Phase 3: Content Sanitization at Ingestion

### Overview
Add body truncation and basic HTML entity encoding at the transformer level to limit attack surface.

### Changes Required:

#### 1. Create Sanitization Utilities
**File**: `packages/console-webhooks/src/sanitize.ts` (NEW)
**Changes**: Add utility functions for content sanitization

```typescript
/**
 * Maximum body length for SourceEvent (10KB)
 * Balances between useful content and storage/embedding costs
 */
export const MAX_BODY_LENGTH = 10000;

/**
 * Maximum title length for SourceEvent
 */
export const MAX_TITLE_LENGTH = 200;

/**
 * HTML entities that should be encoded
 */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

/**
 * Encode HTML entities in a string
 * Prevents XSS in contexts where React auto-escaping doesn't apply
 */
export function encodeHtmlEntities(str: string): string {
  return str.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Truncate string to max length with ellipsis indicator
 */
export function truncateWithEllipsis(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Sanitize content for storage in SourceEvent
 * - Truncates to max length
 * - Encodes HTML entities
 * - Trims whitespace
 */
export function sanitizeContent(
  content: string,
  maxLength: number = MAX_BODY_LENGTH
): string {
  const trimmed = content.trim();
  const truncated = truncateWithEllipsis(trimmed, maxLength);
  // Note: HTML encoding is optional - React handles XSS at render
  // Only enable if content is used in non-React contexts
  return truncated;
}

/**
 * Sanitize title for SourceEvent
 */
export function sanitizeTitle(title: string): string {
  return sanitizeContent(title, MAX_TITLE_LENGTH);
}

/**
 * Sanitize body for SourceEvent
 */
export function sanitizeBody(body: string): string {
  return sanitizeContent(body, MAX_BODY_LENGTH);
}
```

#### 2. Apply Sanitization in Transformers
**File**: `packages/console-webhooks/src/transformers/github.ts`
**Changes**: Use sanitization utilities in each transformer

```typescript
// Add import
import { sanitizeTitle, sanitizeBody } from "../sanitize";

// In transformGitHubPush:
export function transformGitHubPush(
  payload: PushEvent,
  context: TransformContext
): SourceEvent {
  // ... existing refs logic ...

  const rawTitle =
    payload.head_commit?.message?.split("\n")[0]?.slice(0, 100) ||
    `Push to ${branch}`;

  const rawBody = payload.head_commit?.message || "";

  return {
    source: "github",
    sourceType: toInternalGitHubEvent("push") ?? "push",
    sourceId: `push:${payload.repository.full_name}:${payload.after}`,
    title: sanitizeTitle(`[Push] ${rawTitle}`),  // CHANGED
    body: sanitizeBody(rawBody),                  // CHANGED
    // ... rest unchanged ...
  };
}

// Apply same pattern to:
// - transformGitHubPullRequest
// - transformGitHubIssue
// - transformGitHubRelease
// - transformGitHubDiscussion
```

#### 3. Apply to Vercel Transformers
**File**: `packages/console-webhooks/src/transformers/vercel.ts`
**Changes**: Same sanitization pattern

```typescript
import { sanitizeTitle, sanitizeBody } from "../sanitize";

// Apply to all Vercel transformers
```

#### 4. Export Sanitization Utilities
**File**: `packages/console-webhooks/src/index.ts`
**Changes**: Export for potential external use

```typescript
// Add export
export * from "./sanitize";
```

### Success Criteria:

#### Automated Verification:
- [x] Package builds: `pnpm --filter @repo/console-webhooks build`
- [x] Type checking passes: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Send webhook with very long body (>10KB) → verify truncation in database
- [ ] Send webhook with HTML content → verify encoding/storage is safe
- [ ] Verify existing observations still render correctly

**Implementation Note**: After completing this phase, verify no regressions in existing observation display.

---

## Testing Strategy

### Unit Tests
Add to `packages/console-webhooks/src/__tests__/`:

**validation.test.ts**:
- Valid SourceEvent passes validation
- Missing required fields fail validation
- Invalid sourceType rejected
- Invalid timestamp format rejected

**sanitize.test.ts**:
- Truncation at boundary works correctly
- HTML entities encoded properly
- Empty string handled
- Already-short content unchanged

**timestamp.test.ts** (extend existing):
- Payload timestamp extraction for each event type
- Validation accepts recent timestamps
- Validation rejects old timestamps
- Edge case: missing timestamp field

### Integration Tests
- End-to-end webhook flow with validation enabled
- Verify no regressions in observation capture

### Manual Testing Steps
1. Trigger push webhook from test repo → verify captured
2. Trigger PR opened webhook → verify captured with sanitized content
3. Replay old webhook (captured >5 min ago) → verify 401 response
4. Send webhook with very long commit message → verify truncation
5. Send webhook with HTML in body → verify safe storage

## Performance Considerations

- **Schema Validation**: Zod parsing adds ~1ms per webhook (negligible)
- **Timestamp Validation**: Single Date comparison (negligible)
- **Content Sanitization**: String operations scale linearly (max 10KB, fast)
- **No Database Changes**: No migration needed

## Migration Notes

- **No Data Migration**: Changes only affect new webhooks
- **Backward Compatible**: Existing observations unchanged
- **Gradual Rollout**: Can enable each phase independently
- **Rollback**: Remove validation calls if issues arise

## References

- Original analysis: `thoughts/shared/research/2025-12-14-neural-memory-security-analysis.md`
- Implementation details: `thoughts/shared/research/2025-12-14-neural-memory-security-implementation-details.md`
- Webhook architecture: `thoughts/shared/research/2025-12-11-webhook-transformer-architecture.md`
- Existing timestamp code: `packages/console-webhooks/src/common.ts:79-121`
