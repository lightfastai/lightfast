# Backfill Phase 5: Sentry Backfill Implementation

## Overview

Add full backfill support for Sentry. Sentry uses REST API with cursor-based pagination via `Link` headers. This phase first fixes the `resourceName` format for Sentry resources (prerequisite), then implements the backfill handlers with Zod response schemas.

## Parent Plan

This is Phase 5 of the Backfill Provider Unification plan. Depends on Phase 4 (Linear backfill).

## Current State Analysis

- Sentry API definition exists (`sentry/api.ts`) with `buildAuthHeader` (uses `decodeSentryToken`) and `parseSentryRateLimit`, but `endpoints: {}` is empty
- Sentry backfill is a stub: `supportedEntityTypes: [], entityTypes: {}`
- Sentry uses REST API with cursor-based pagination via RFC 5988 `Link` headers
- Sentry composite tokens: `installationId:token` format, decoded via `decodeSentryToken` in `sentry/auth.ts:68-74`

### Prerequisite Problem:
- Sentry's `resourceName` currently stores only the project display name (e.g., `"My Backend"`)
- The backfill entity handler needs `orgSlug` and `projectSlug` to build Sentry API URLs like `/api/0/organizations/{orgSlug}/issues/` and `/api/0/projects/{orgSlug}/{projectSlug}/events/`
- The tRPC handler at `api/console/src/router/org/connections.ts:1167` casts the Sentry API response and loses the `organization.slug` field
- The resource-linking adapter at `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts:208-212` stores just the display name

## Desired End State

After this phase:
1. Sentry `listProjects` tRPC response includes `organizationSlug` per project
2. Sentry resource linking stores `"orgSlug/projectSlug"` in `resourceName`
3. Sentry API definition has `list-org-issues` and `list-events` endpoints with response schemas
4. Sentry has two backfill entity types: `issue` and `error`
5. Sentry `processResponse` extracts pagination cursor from `Link` headers

## What We're NOT Doing

- Migrating existing Sentry resources (users re-link manually for backfill)
- Changing Sentry webhook delivery (routes via `external_id`, not `resourceName`)
- Adding more Sentry entity types (transactions, etc.)

## Changes Required

### 0. (Prerequisite) Fix Sentry resource `resourceName` format

**File**: `api/console/src/router/org/connections.ts`
**Changes**:

1. At line 1167, update the type cast to include `organization`:
```typescript
const projects = (await response.json()) as {
  id: string;
  slug: string;
  name: string;
  platform: string | null;
  status: string;
  organization: { slug: string };
}[];
```

2. At lines 1190-1198, include `organizationSlug` and `projectSlug` in the return:
```typescript
return {
  projects: projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    platform: p.platform,
    organizationSlug: p.organization.slug,
    isConnected: connectedResourceIds.has(p.id),
  })),
};
```

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts`
**Changes**: Update Sentry adapter's `buildLinkResources` (line 208-212) to store `"orgSlug/projectSlug"` in `resourceName`:
```typescript
buildLinkResources: (rawResources) =>
  (rawResources as any[]).map((p) => ({
    resourceId: p.id,
    resourceName: `${p.organizationSlug}/${p.slug}`,
  })),
```

**Migration note**: Existing Sentry resources will have `resourceName` as just the display name. After this change, users must re-link their Sentry resources (unlink → re-link) for backfill to work. Webhook delivery is unaffected since it routes via `external_id` (installation UUID), not `resourceName`.

### 1. Update Sentry API definition with endpoints and response schemas

**File**: `packages/console-providers/src/providers/sentry/api.ts`
**Changes**: Add endpoints and response schemas to the existing file.

```typescript
// ── Response Schemas ────────────────────────────────────────────────────────────

export const sentryIssueSchema = z.object({
  id: z.string(),
  shortId: z.string().optional(),
  title: z.string(),
  culprit: z.string().optional(),
  permalink: z.string().optional(),
  level: z.string().optional(),
  status: z.string(),
  platform: z.string().optional(),
  project: z.object({
    id: z.string(),
    name: z.string().optional(),
    slug: z.string(),
  }).passthrough(),
  type: z.string().optional(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  count: z.string().optional(),
  userCount: z.number().optional(),
  assignedTo: z.object({
    type: z.string(),
    id: z.string(),
    name: z.string(),
  }).passthrough().nullable().optional(),
}).passthrough();

export type SentryIssue = z.infer<typeof sentryIssueSchema>;

export const sentryErrorEventSchema = z.object({
  eventID: z.string(),
  title: z.string().optional(),
  message: z.string().optional(),
  dateCreated: z.string(),
  platform: z.string().optional(),
  tags: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
}).passthrough();

export type SentryErrorEvent = z.infer<typeof sentryErrorEventSchema>;
```

Update `sentryApi.endpoints`:
```typescript
endpoints: {
  "list-org-issues": {
    method: "GET",
    path: "/api/0/organizations/{organization_slug}/issues/",
    description: "List issues for an organization (filter by project via query param)",
    responseSchema: z.array(sentryIssueSchema),
  },
  "list-events": {
    method: "GET",
    path: "/api/0/projects/{organization_slug}/{project_slug}/events/",
    description: "List error events for a Sentry project",
    responseSchema: z.array(sentryErrorEventSchema),
  },
},
```

### 2. Implement Sentry backfill entity handlers

**File**: `packages/console-providers/src/providers/sentry/backfill.ts`
**Changes**: Replace stub with full implementation.

Sentry's cursor pagination uses RFC 5988 `Link` headers with `rel="next"`, `results="true"/"false"`, and `cursor="..."`.

```typescript
import { z } from "zod";
import type { BackfillContext, BackfillDef } from "../../define";
import { sentryIssueSchema, sentryErrorEventSchema, type SentryIssue, type SentryErrorEvent } from "./api";

/** Parse Sentry's RFC 5988 Link header to extract the next page cursor.
 *  Returns null if no next page (results="false") or header is missing. */
function parseSentryLinkCursor(linkHeader?: string): string | null {
  if (!linkHeader) return null;
  const nextMatch = linkHeader.match(
    /rel="next";\s*results="true";\s*cursor="([^"]+)"/
  );
  return nextMatch?.[1] ?? null;
}

export const sentryBackfill: BackfillDef = {
  supportedEntityTypes: ["issue", "error"],
  defaultEntityTypes: ["issue", "error"],
  entityTypes: {
    issue: {
      endpointId: "list-org-issues",
      buildRequest(ctx, cursor) {
        // resourceName format: "orgSlug/projectSlug" (set during resource linking)
        const [orgSlug] = (ctx.resource.resourceName ?? "").split("/");
        return {
          pathParams: {
            organization_slug: orgSlug,
          },
          queryParams: {
            project: ctx.resource.providerResourceId,
            start: ctx.since,
            end: new Date().toISOString(),
            sort: "new",
            query: "",
            limit: "100",
            collapse: "stats",
            ...(cursor ? { cursor: cursor as string } : {}),
          },
        };
      },
      processResponse(data, ctx, _cursor, responseHeaders) {
        const issues = z.array(sentryIssueSchema).parse(data);
        const nextCursor = parseSentryLinkCursor(responseHeaders?.link);

        const events = issues.map((issue) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-issue-${issue.id}`,
          eventType: "issue",
          payload: adaptSentryIssueForTransformer(issue, ctx),
        }));

        return {
          events,
          nextCursor,
          rawCount: issues.length,
        };
      },
    },
    error: {
      endpointId: "list-events",
      buildRequest(ctx, cursor) {
        // resourceName format: "orgSlug/projectSlug" (set during resource linking)
        const [orgSlug, projectSlug] = (ctx.resource.resourceName ?? "").split("/");
        return {
          pathParams: {
            organization_slug: orgSlug,
            project_slug: projectSlug,
          },
          queryParams: {
            start: ctx.since,
            end: new Date().toISOString(),
            full: "true",
            ...(cursor ? { cursor: cursor as string } : {}),
          },
        };
      },
      processResponse(data, ctx, _cursor, responseHeaders) {
        const events = z.array(sentryErrorEventSchema).parse(data);
        const nextCursor = parseSentryLinkCursor(responseHeaders?.link);

        const adapted = events.map((event) => ({
          deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-error-${event.eventID}`,
          eventType: "error",
          payload: adaptSentryErrorForTransformer(event, ctx),
        }));

        return {
          events: adapted,
          nextCursor,
          rawCount: events.length,
        };
      },
    },
  },
};
```

The adapter functions (`adaptSentryIssueForTransformer`, `adaptSentryErrorForTransformer`) transform Sentry REST API response objects into `PreTransformSentry*Webhook` shapes that the existing webhook transformers expect. These must be implemented in the same file, referencing the existing pre-transform schemas in `sentry/schemas.ts`.

Note: `processResponse` uses `responseHeaders?.link` to extract cursor from the raw headers returned by the gateway proxy. This is why `processResponse` has the optional `responseHeaders` parameter — Sentry is the primary consumer.

### 3. Add Sentry backfill tests

**File**: `packages/console-providers/src/providers/sentry/backfill.test.ts` (NEW)

Test coverage:
- `buildRequest` produces correct path params from `resourceName` split
- `buildRequest` passes cursor as query param when non-null
- `processResponse` validates with Zod schemas
- `processResponse` extracts cursor from `Link` header via `parseSentryLinkCursor`
- `parseSentryLinkCursor` handles: missing header, `results="false"`, `results="true"`, malformed header
- Round-trip: adapter output → Sentry transformer → valid `PostTransformEvent`

## Success Criteria

### Automated Verification:
- [x] `pnpm --filter @repo/console-providers typecheck` passes
- [x] `pnpm --filter @repo/console-providers test` passes
- [x] `pnpm --filter @lightfast/backfill typecheck` passes
- [ ] `pnpm --filter @lightfast/backfill test` passes
- [x] `pnpm --filter @api/console typecheck` passes (tRPC return type change)
- [x] `pnpm typecheck` passes (adapter change may affect console app types)

### Manual Verification:
- [ ] Verify Sentry `listProjects` tRPC response now includes `organizationSlug` per project
- [ ] Unlink and re-link a Sentry resource — verify `resourceName` is now `"orgSlug/projectSlug"` format
- [ ] Trigger a backfill for a Sentry connection
- [ ] Verify Sentry issues appear as observations in the console
- [ ] Test with a project that has many issues to verify Link header pagination

**Implementation Note**: After completing this phase, proceed to Phase 6 for cleanup.

## References

- Sentry API definition: `packages/console-providers/src/providers/sentry/api.ts`
- Sentry auth (decodeSentryToken): `packages/console-providers/src/providers/sentry/auth.ts:68-74`
- Sentry pre-transform schemas: `packages/console-providers/src/providers/sentry/schemas.ts`
- Sentry transformers: `packages/console-providers/src/providers/sentry/transformers.ts`
- Sentry listProjects tRPC: `api/console/src/router/org/connections.ts:1112-1198`
- Sentry adapter: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/new/_components/adapters.ts:180-212`
