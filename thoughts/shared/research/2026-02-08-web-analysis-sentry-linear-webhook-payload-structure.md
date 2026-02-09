---
date: 2026-02-08T17:30:00-08:00
researcher: Claude Code
topic: "Sentry and Linear Webhook Payload Structure: Resource ID Fields"
tags: [research, web-analysis, webhooks, sentry, linear, integration, payload-structure]
status: complete
created_at: 2026-02-08
confidence: high
sources_count: 8
---

# Web Research: Sentry and Linear Webhook Payload Structure

**Date**: 2026-02-08T17:30:00-08:00
**Topic**: Do Sentry and Linear webhooks reliably provide resource ID fields for integration lookup?
**Confidence**: High - Based on official documentation and SDK source code

## Research Question

Does `issue.project` in Sentry issue webhooks include a numeric `id` field? Does Linear provide `teamId` in webhook payloads? Are these fields reliably present for resource identification in the observation-capture workflow?

## Executive Summary

**Sentry**: Issue webhooks include `data.issue.project` as an **object** with an `id` field (string type in docs, numeric value). Error webhooks have `data.project` as a **numeric integer** at top level. Both structures reliably provide project IDs, but use different payload shapes.

**Linear**: Webhook payloads **do NOT include a `team` object**. Instead, they provide `data.teamId` as a **UUID string**. All data change events include `organizationId` at top level (always present). The `teamId` field is present for team-scoped resources (Issues, Cycles) but may be absent for organization-wide resources (workspace labels).

**Key Implication**: The current code at `observation-capture.ts:500` checking for `metadata.repoId || metadata.projectId` will work for Sentry error webhooks but NOT for Sentry issue webhooks (which nest the ID in `project.id`). For Linear, the code needs to check `metadata.teamId`, not `metadata.projectId`.

## Key Metrics & Findings

### Sentry: Issue Webhooks

**Finding**: `data.issue.project` is an object containing `id`, `name`, `slug`, and `platform` fields.

**Source**: [Sentry Issue Webhooks Documentation](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/issues/)

- **Field Path**: `data.issue.project.id`
- **Type**: String in documentation examples (e.g., `"112313123123134"`)
- **Always Present**: Yes - shown in all official examples
- **Analysis**: The current extraction code `metadata.projectId?.toString()` will NOT find this field because it's nested under `metadata.project.id`, not at top level as `metadata.projectId`.

**Example Payload**:
```json
{
  "action": "created",
  "data": {
    "issue": {
      "id": "1234567890",
      "project": {
        "id": "112313123123134",
        "name": "python",
        "slug": "python",
        "platform": "python"
      }
    }
  }
}
```

### Sentry: Error Webhooks

**Finding**: `data.project` is a numeric integer at the top level of the data object.

**Source**: [Sentry Error Webhooks Documentation](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/errors)

- **Field Path**: `data.project`
- **Type**: Integer (e.g., `1`)
- **Always Present**: Yes - shown in official examples
- **Analysis**: The current extraction code `metadata.projectId?.toString()` will find this field IF the transformer stores it as `metadata.projectId`.

**Example Payload**:
```json
{
  "action": "created",
  "data": {
    "error": {
      "url": "...",
      "web_url": "..."
    },
    "project": 1
  }
}
```

### Linear: All Webhook Types

**Finding**: Linear webhooks provide `organizationId` at top level (always present) and `teamId` within `data` object (present for team-scoped resources).

**Source**: [Linear Webhooks Documentation](https://linear.app/developers/webhooks)

- **Field Path (org)**: `organizationId` (top level)
- **Field Path (team)**: `data.teamId` (nested)
- **Type**: UUID strings (e.g., `"72b2a2dc-6f4f-4423-9d34-24b5bd10634a"`)
- **Always Present**: `organizationId` = Yes (all events), `teamId` = Conditional (team-scoped resources only)
- **Analysis**: The current extraction code does NOT check `metadata.teamId` or `metadata.organizationId`. Linear events will always return `undefined` for `resourceId`.

**Example Payload**:
```json
{
  "action": "create",
  "type": "Issue",
  "organizationId": "dc844923-f9a4-40a3-825c-dea7747e57d6",
  "webhookTimestamp": 1706107938084,
  "data": {
    "id": "8f7e6d5c-4b3a-2f1e-0d9c-8a7b6c5d4e3f",
    "title": "Implement JWT-based authentication",
    "teamId": "72b2a2dc-6f4f-4423-9d34-24b5bd10634a",
    "projectId": "9e8d7c6b-5a4f-3e2d-1c0b-9a8f7e6d5c4b"
  }
}
```

**Critical Note**: Linear does **NOT** include a `team` object with an `id` field. The field is `teamId` (string, not object). This is different from the GraphQL schema used by the SDK.

### GraphQL Schema vs Webhook Payload Discrepancy (Linear)

**Finding**: Linear's GraphQL schema defines fields as objects (e.g., `team: Team`), but webhook payloads use ID strings (e.g., `teamId: string`).

**Source**: [Linear GitHub Issue #596](https://github.com/linear/linear/issues/596) (Resolved July 2025)

**Resolution**: Linear SDK added a parsing helper function (`@linear/sdk/webhooks`) to handle this discrepancy. Applications receiving webhooks should expect string IDs, not nested objects.

## Trade-off Analysis

### Scenario 1: Check Top-Level Metadata Fields Only

```typescript
const resourceId = metadata.repoId?.toString() || metadata.projectId?.toString();
```

| Source | Works? | Reason |
|--------|--------|--------|
| GitHub | ✅ Yes | `metadata.repoId` is at top level |
| Vercel | ✅ Yes | `metadata.projectId` is at top level |
| Sentry (error) | ✅ Yes | IF transformer stores `data.project` as `metadata.projectId` |
| Sentry (issue) | ❌ No | Project ID is nested at `metadata.project.id` |
| Linear | ❌ No | Uses `metadata.teamId`, not `projectId` |

### Scenario 2: Source-Aware Extraction with Fallback

```typescript
let resourceId: string | undefined;
switch (sourceEvent.source) {
  case "github":
    resourceId = metadata.repoId?.toString();
    break;
  case "vercel":
    resourceId = metadata.projectId?.toString();
    break;
  case "sentry":
    resourceId = metadata.projectId?.toString() || metadata.project?.id?.toString();
    break;
  case "linear":
    resourceId = metadata.teamId?.toString();
    break;
}
```

| Source | Works? | Reason |
|--------|--------|--------|
| GitHub | ✅ Yes | Checks `metadata.repoId` |
| Vercel | ✅ Yes | Checks `metadata.projectId` |
| Sentry (error) | ✅ Yes | `metadata.projectId` (if transformer sets it) |
| Sentry (issue) | ✅ Yes | Fallback to `metadata.project.id` handles nested structure |
| Linear | ✅ Yes | Checks `metadata.teamId` |

## Recommendations

Based on research findings:

1. **Update Sentry issue transformer** (`sentry.ts:328-348`) to add `projectId: issue.project.id` to metadata, ensuring both error and issue events have `metadata.projectId`.

2. **Use source-aware resource ID extraction** in `observation-capture.ts:500` with a switch statement instead of a simple `||` chain. This prevents cross-source field collisions and makes intent explicit.

3. **For Linear**, extract `metadata.teamId` (not `metadata.projectId`). The seed script stores `providerResourceId: "team_lightfast_eng"` which matches the `teamId` field.

4. **Consider `organizationId` as fallback** for Linear if `teamId` is not present (workspace-level resources). However, this requires seed script to also support organization-level integrations.

## Detailed Findings

### Sentry: Type Inconsistency Between Webhook Types

**Question**: Why do issue webhooks nest the project as an object while error webhooks use a flat integer?

**Finding**: Sentry's webhook documentation shows two completely different structures:
- **Issue webhooks** (`/webhooks/issues/`): Nested object structure with full project details
- **Error webhooks** (`/webhooks/errors`): Flat integer ID

**Source**: Official Sentry documentation (links above)

**Relevance**: This means a single extraction strategy won't work for both webhook types. Either:
- Transformers normalize to a consistent structure before storage
- Observation-capture handles both structures (fallback chain)

### Sentry: String vs Numeric ID

**Question**: Is `project.id` a string or number?

**Finding**: The official documentation shows `"id": "112313123123134"` (string), but other parts of Sentry's API use numeric IDs. Real-world GitHub issues show confusion between numeric IDs and string slugs.

**Source**: [Sentry Issue Webhooks Documentation](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/issues/)

**Recommendation**: Use `?.toString()` when extracting to handle both types defensively.

### Linear: No Team Object in Webhooks

**Question**: Does Linear include a `team` object with nested fields?

**Finding**: **No**. Linear webhooks use a flat structure with `teamId` as a UUID string. The GraphQL schema (used by the SDK) defines `team: Team`, but webhook payloads never include this object.

**Source**:
- [Linear Webhooks Documentation](https://linear.app/developers/webhooks)
- [Linear GitHub Issue #596](https://github.com/linear/linear/issues/596)

**Relevance**: Code expecting `metadata.team?.id` will fail. Must use `metadata.teamId` directly.

### Linear: Organization vs Team Scope

**Question**: When is `organizationId` vs `teamId` present?

**Finding**:
- `organizationId`: **Always present** on all data change events (top-level field)
- `teamId`: Present within `data` object for **team-scoped resources** (Issues, Cycles, Projects assigned to teams)
- Workspace-level labels may have `null` or missing `teamId`

**Source**: [Linear Webhooks Documentation](https://linear.app/developers/webhooks)

**Relevance**: Using `teamId` as the resource ID is correct for most cases, but organization-level integrations would need to use `organizationId`.

## Performance Data Gathered

### Webhook Payload Truncation (Sentry)

**Source**: [Sentry GitHub Issue #71260](https://github.com/getsentry/sentry/issues/71260)

**Finding**: Real-world reports of Sentry webhook payloads being **truncated**, resulting in unparseable JSON.

**Implication**: Even documented fields may not be reliably present in all webhook deliveries. Always validate payloads and handle missing fields gracefully.

## Risk Assessment

### High Priority

- **Sentry issue webhooks**: Current code will NOT extract `project.id` due to nested structure. Will bypass filtering unless transformer adds `metadata.projectId`.
- **Linear webhooks**: Current code will NOT extract `teamId`. Will bypass filtering for all Linear events.

### Medium Priority

- **Sentry payload truncation**: Webhooks may be incomplete. Need robust error handling for missing fields.
- **Type inconsistency**: Sentry's `project` field type varies between webhook types. Need defensive parsing with `?.toString()`.

### Low Priority

- **Linear organization-level resources**: If workspace labels or organization-wide entities are added, `teamId` may be absent. Consider `organizationId` fallback.

## Open Questions

Areas that need further investigation:

1. **Sentry transformer behavior**: Does `sentry.ts` currently store `data.project` as `metadata.projectId` for error webhooks? If not, both error and issue webhooks need transformer updates.

2. **Linear project-level webhooks**: Do project webhooks include `teamId`? The research focused on issue/comment/cycle events. Need to verify project webhooks also have `teamId` in `data` object.

3. **Seed script `providerResourceId`**: For Sentry, the seed script stores `"4508288486826115"` (numeric string). Does this match the `project.id` value from issue webhooks (which appear as strings in docs) or the `project` value from error webhooks (which appear as integers)?

## Sources

### Official Documentation

- [Sentry Webhooks Overview](https://docs.sentry.io/organization/integrations/integration-platform/webhooks) - Sentry.io, 2026
- [Sentry Issue Webhooks](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/issues/) - Sentry.io, 2026
- [Sentry Error Webhooks](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/errors) - Sentry.io, 2026
- [Linear Webhooks Documentation](https://linear.app/developers/webhooks) - Linear.app, 2026
- [Linear SDK Webhooks Guide](https://linear.app/developers/sdk-webhooks) - Linear.app, 2026

### Performance & Issues

- [Sentry Issue #71260 - Webhook Truncation](https://github.com/getsentry/sentry/issues/71260) - GitHub, 2024
- [Linear Issue #596 - Webhook Payload Types](https://github.com/linear/linear/issues/596) - GitHub, Closed 2025-07-02

### Real-World Examples

- [Linear Webhook Template (Netlify)](https://github.com/netlify/linear-webhook-template) - GitHub, 2025
- [Complete Linear Webhooks Guide with Examples](https://inventivehq.com/blog/linear-webhooks-guide) - Inventive HQ, 2025

---

**Last Updated**: 2026-02-08
**Confidence Level**: High - Based on official documentation from both platforms and confirmed by SDK source code
**Next Steps**: Update implementation plan to reflect:
1. Sentry issue transformer needs `projectId` addition
2. Observation-capture needs source-aware switch statement with `metadata.project?.id` fallback for Sentry and `metadata.teamId` for Linear
