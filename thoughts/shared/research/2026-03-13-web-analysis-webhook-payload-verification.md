---
date: 2026-03-13T02:34:52Z
researcher: claude
topic: "Webhook payload field verification for entity system redesign — GitHub, Vercel, Linear, Sentry"
tags: [research, web-analysis, webhooks, github, vercel, linear, sentry, entity-system]
status: complete
created_at: 2026-03-13
confidence: high
sources_count: 8
---

# Web Research: Webhook Payload Verification

**Date**: 2026-03-13T02:34:52Z
**Topic**: Verify webhook field names, action values, and entity state mappings for the entity system redesign
**Confidence**: High — all major providers checked against official documentation
**Related plan**: `thoughts/shared/plans/2026-03-13-entity-system-redesign.md`

## Research Question

Verify that the entity state mappings and webhook payload field access in the entity system
redesign plan are correct for all 4 providers: GitHub, Vercel, Linear, Sentry.

## Executive Summary

The design plan is largely correct. Six corrections are required:

1. **Vercel**: `deployment.ready` is not a documented event type — use `deployment.succeeded`
2. **Vercel**: `payload.target` values are `"production"` / `"staging"` / `null`, **not** `"preview"`
3. **Vercel**: `payload.project.name` is not in the webhook schema — use `payload.deployment.name`
4. **GitHub**: `discussion.state` only has `"open"` / `"closed"` — `"locked"` is an `action` value, not a state
5. **Sentry**: Issue action `"ignored"` no longer exists — renamed to `"archived"`
6. **Sentry**: Error webhook uses `data.error.datetime` (ISO 8601), not `data.error.timestamp`

Everything else is confirmed correct, including all Linear state type values, GitHub PR/Push/
Issue/Release fields, and Sentry metric alert fields.

---

## Findings by Provider

### GitHub

**Source**: https://docs.github.com/en/webhooks/webhook-events-and-payloads

#### pull_request event

| Field | Status | Notes |
|---|---|---|
| `action: "opened"` | ✅ Confirmed | — |
| `action: "closed"` | ✅ Confirmed | Fires for both merged and non-merged closes; `merged` flag distinguishes them |
| `action: "reopened"` | ✅ Confirmed | — |
| `action: "converted_to_draft"` | ✅ Confirmed | — |
| `action: "ready_for_review"` | ✅ Confirmed | — |
| `action: "review_requested"` | ✅ Confirmed | — |
| `action: "synchronize"` | ✅ Confirmed | — |
| `action: "edited"` | ✅ Confirmed | — |
| `pull_request.state` | ✅ Confirmed | Values: `"open"` \| `"closed"` |
| `pull_request.merged` | ✅ Confirmed | Boolean |
| `pull_request.draft` | ✅ Confirmed | Boolean |
| `pull_request.merge_commit_sha` | ✅ Confirmed | `null` when not yet merged |
| `pull_request.additions` | ✅ Confirmed | Integer |
| `pull_request.deletions` | ✅ Confirmed | Integer |
| `pull_request.changed_files` | ✅ Confirmed | Integer |
| `pull_request.head.sha` | ✅ Confirmed | — |
| `pull_request.head.ref` | ✅ Confirmed | Branch name string |
| `pull_request.base.ref` | ✅ Confirmed | Target branch name string |

Additional undocumented-in-plan actions (won't cause errors, just not handled): `assigned`, `unassigned`, `labeled`, `unlabeled`, `review_request_removed`, `auto_merge_enabled`, `auto_merge_disabled`.

#### issues event

| Field | Status | Notes |
|---|---|---|
| `issue.state` | ✅ Confirmed | Values: `"open"` \| `"closed"` |
| `issue.state_reason` | ✅ Confirmed | Values: `"completed"` \| `"not_planned"` \| `"reopened"` \| `null` |

#### push event

| Field | Status | Notes |
|---|---|---|
| `ref` | ✅ Confirmed | Format: `"refs/heads/main"` |
| `before` | ✅ Confirmed | SHA; zero SHA for new branch |
| `after` | ✅ Confirmed | SHA of head commit after push |
| `forced` | ✅ Confirmed | Boolean |
| `head_commit.timestamp` | ✅ Confirmed | ISO 8601 string |
| `commits[].added` | ✅ Confirmed | Array of filename strings |
| `commits[].modified` | ✅ Confirmed | Array of filename strings |
| `commits[].removed` | ✅ Confirmed | Array of filename strings |

#### release event

| Field | Status | Notes |
|---|---|---|
| `release.draft` | ✅ Confirmed | Boolean |
| `release.prerelease` | ✅ Confirmed | Boolean |
| `release.tag_name` | ✅ Confirmed | String e.g. `"v1.0.0"` |
| `release.target_commitish` | ✅ Confirmed | Branch name or commit SHA |
| `release.published_at` | ✅ Confirmed | ISO 8601 string; `null` for unpublished drafts |
| `release.html_url` | ✅ Confirmed | — |

#### discussion event

| Field | Status | Notes |
|---|---|---|
| `discussion.state` | ⚠️ Partial | Only `"open"` \| `"closed"`. `"locked"` is **NOT** a state value. |
| `discussion.answer_html_url` | ✅ Confirmed | Non-null when answered; `null` otherwise |
| `discussion.category.name` | ✅ Confirmed | String e.g. `"Q&A"`, `"General"` |

**Correction needed**: `"locked"` is conveyed via the `action` field (`"locked"` / `"unlocked"`), not via `discussion.state`. The design plan has `deriveDiscussionState` using `"locked"` as a state — this must be removed.

---

### Vercel

**Source**: https://vercel.com/docs/webhooks/webhooks-api

#### Deployment event types

| Event type | Status | Notes |
|---|---|---|
| `deployment.created` | ✅ Confirmed | — |
| `deployment.succeeded` | ✅ Confirmed | — |
| `deployment.ready` | ❌ NOT CONFIRMED | Does not appear in official docs. The successful deployment event is `deployment.succeeded`. |
| `deployment.error` | ✅ Confirmed | — |
| `deployment.canceled` | ✅ Confirmed | — |
| `deployment.promoted` | ✅ Confirmed | — |
| `deployment.rollback` | ✅ Confirmed | — |
| `deployment.cleanup` | ✅ Confirmed | — |
| `deployment.check-rerequested` | ✅ Confirmed | — |

**Correction**: Remove `deployment.ready` from the event type list and from the `stateMap`. `deployment.succeeded` is the correct event.

#### Payload fields

| Field | Status | Notes |
|---|---|---|
| `payload.deployment.id` | ✅ Confirmed | — |
| `payload.deployment.url` | ✅ Confirmed | — |
| `payload.deployment.meta.githubCommitSha` | ✅ Present (implicit) | Not formally enumerated in webhook spec, but documented in deployment API and propagated to webhooks |
| `payload.deployment.meta.githubCommitRef` | ✅ Present (implicit) | Same caveat |
| `payload.deployment.meta.githubCommitMessage` | ✅ Present (implicit) | Same caveat |
| `payload.deployment.meta.githubPrId` | ✅ Present (implicit) | Same caveat |
| `payload.deployment.meta.githubOrg` | ✅ Present (implicit) | Same caveat |
| `payload.deployment.meta.githubRepo` | ✅ Present (implicit) | Same caveat |
| `payload.project.id` | ✅ Confirmed | Formally in webhook schema |
| `payload.project.name` | ❌ NOT in schema | Only `payload.project.id` is documented. Use `payload.deployment.name` for project name. |
| `payload.team.id` | ✅ Confirmed | Can be null |
| `payload.target` | ⚠️ Partial | Values are `"production"` \| `"staging"` \| `null` — **NOT** `"preview"`. Preview deployments use `null` or `"staging"`. |
| `createdAt` (top-level) | ✅ Confirmed | Top-level envelope field |
| `region` (top-level) | ✅ Confirmed | Top-level envelope field; can be null |

**Corrections needed**:
1. `payload.project.name` → use `payload.deployment.name` instead
2. `payload.target` check for production: `target === "production"` is still correct; `target !== "production"` captures all non-production deployments

---

### Linear

**Source**: https://developers.linear.app/docs/graphql/webhooks + Linear SDK types

#### Issue state types (`data.state.type`)

| Value | Status |
|---|---|
| `"backlog"` | ✅ Confirmed |
| `"unstarted"` | ✅ Confirmed |
| `"started"` | ✅ Confirmed |
| `"completed"` | ✅ Confirmed |
| `"canceled"` | ✅ Confirmed |

All five values confirmed correct.

#### Project state values

| Value | Status |
|---|---|
| `"backlog"` | ✅ Confirmed |
| `"planned"` | ✅ Confirmed |
| `"started"` | ✅ Confirmed |
| `"paused"` | ✅ Confirmed |
| `"completed"` | ✅ Confirmed |
| `"canceled"` | ✅ Confirmed |

All six values confirmed correct.

#### Webhook actions

`"create"`, `"update"`, `"remove"` — all three confirmed. These are the only three action values.

#### Cycle fields

| Field | Status |
|---|---|
| `startsAt` | ✅ Confirmed |
| `endsAt` | ✅ Confirmed |
| `completedAt` | ✅ Confirmed (nullable) |
| `number` | ✅ Confirmed |
| `name` | ✅ Confirmed (optional) |
| `progress` | ✅ Confirmed (float) |
| `scope` | ✅ Confirmed |

#### Attachment fields

| Field | Status | Notes |
|---|---|---|
| `sourceType: "githubPr"` | ✅ Confirmed | Exact casing |
| `sourceType: "sentryIssue"` | ✅ Confirmed | Exact casing |
| `metadata.number` (for githubPr) | ✅ Confirmed | PR number integer |
| `metadata.shortId` (for sentry) | ✅ Confirmed | Sentry short ID string |

#### Other fields

| Field | Status | Notes |
|---|---|---|
| `parent.id` on comments | ✅ Confirmed | Present for threaded replies |
| `health` on project updates | ✅ Confirmed | Values: `"onTrack"` \| `"atRisk"` \| `"offTrack"` (camelCase) |
| `branchName` on issues | ✅ Confirmed | Auto-generated branch name |

All Linear fields confirmed. No corrections needed.

---

### Sentry

**Source**: https://docs.sentry.io/organization/integrations/integration-platform/webhooks/

#### Issue event actions

| Action | Status | Notes |
|---|---|---|
| `"created"` | ✅ Confirmed | — |
| `"resolved"` | ✅ Confirmed | — |
| `"assigned"` | ✅ Confirmed | — |
| `"ignored"` | ❌ INCORRECT | This action no longer exists. Renamed to `"archived"`. |
| `"archived"` | ✅ Confirmed | Correct replacement for `"ignored"` |
| `"unresolved"` | ✅ Confirmed | — |

**Correction**: Replace `"ignored"` with `"archived"` in the Sentry transformer's action map.

Note: `data.issue.status` still uses `"ignored"` as a value (the status field retains old naming), but the `action` field uses `"archived"`. This is an inconsistency in Sentry's API.

#### Issue payload fields

| Field | Status | Notes |
|---|---|---|
| `data.issue.shortId` | ✅ Confirmed | e.g. `"PYTHON-Y"` |
| `data.issue.permalink` | ✅ Confirmed | Can be `null` in self-hosted |
| `data.issue.status` | ✅ Confirmed | Values: `"resolved"` \| `"unresolved"` \| `"ignored"` (old naming retained in status field) |
| `data.issue.level` | ✅ Confirmed | `"fatal"` \| `"error"` \| `"warning"` \| `"info"` \| `"debug"` |
| `data.issue.platform` | ✅ Confirmed | e.g. `"javascript"`, `"python"` |
| `data.issue.count` | ⚠️ Not formally documented | Exists on Issue REST API; likely present in webhook but not enumerated in webhook spec |
| `data.issue.userCount` | ⚠️ Not formally documented | Same caveat |
| `data.issue.firstSeen` | ✅ Confirmed | ISO 8601 string |
| `data.issue.lastSeen` | ✅ Confirmed | ISO 8601 string |
| `data.issue.culprit` | ✅ Confirmed | Transaction/module path string |

#### Issue metadata fields

| Field | Status | Notes |
|---|---|---|
| `data.issue.metadata.type` | ✅ Confirmed | Exception type e.g. `"ReferenceError"` |
| `data.issue.metadata.value` | ✅ Confirmed | Exception message |
| `data.issue.metadata.filename` | ✅ Confirmed | Source filename |
| `data.issue.metadata.function` | ✅ Conditionally confirmed | Present for stack-based exceptions; may be absent |

#### statusDetails

| Field | Status |
|---|---|
| `data.issue.statusDetails.inCommit.commit` | ✅ Confirmed |
| `data.issue.statusDetails.inCommit.repository` | ✅ Confirmed |

#### Error webhook

| Field | Status | Notes |
|---|---|---|
| `data.error.event_id` | ✅ Confirmed | 32-char hex string (no dashes) |
| `data.error.timestamp` | ❌ WRONG FIELD NAME | Field is `data.error.datetime` (ISO 8601 string). Also `data.error.received` (Unix float) |
| `data.error.project` | ✅ Confirmed | Integer (numeric project ID) |
| `data.error.exception.values[].stacktrace.frames` | ✅ Confirmed | Each frame has `filename`, `function`, `lineno`, `in_app` |

**Correction**: Use `data.error.datetime` not `data.error.timestamp`. In the Sentry error transformer, `String(errorEvent.timestamp)` should become `String(errorEvent.datetime)`.

#### Metric alert webhook

| Field | Status | Notes |
|---|---|---|
| `data.metric_alert` | ✅ Confirmed | Incident object |
| `data.metric_alert.alert_rule.name` | ✅ Confirmed | — |
| `data.metric_alert.alert_rule.query` | ✅ Confirmed | — |
| `data.metric_alert.date_started` | ✅ Confirmed | ISO 8601 |
| `data.metric_alert.date_detected` | ✅ Confirmed | ISO 8601 |
| `data.metric_alert.date_closed` | ✅ Confirmed | ISO 8601 or `null` |

Metric alert `action` values: `"critical"` \| `"warning"` \| `"resolved"` (not the same as issue actions).

---

## All Corrections Summary

| # | Provider | Item | Current (wrong) | Correct |
|---|---|---|---|---|
| 1 | Vercel | Event type | `deployment.ready` | Remove — not in official docs; `deployment.succeeded` is the success event |
| 2 | Vercel | `payload.target` values | `"production" \| "preview"` | `"production" \| "staging" \| null` |
| 3 | Vercel | Project name field | `payload.project.name` | `payload.deployment.name` |
| 4 | GitHub | Discussion state | `"open" \| "closed" \| "locked"` | `"open" \| "closed"` only; locked = action value |
| 5 | Sentry | Issue action | `"ignored"` | `"archived"` |
| 6 | Sentry | Error timestamp | `data.error.timestamp` | `data.error.datetime` |

---

## Sources

### Official Documentation
- [GitHub Webhook Events and Payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads) — GitHub, 2026
- [Vercel Webhooks API Reference](https://vercel.com/docs/webhooks/webhooks-api) — Vercel, 2026
- [Linear Webhooks Documentation](https://developers.linear.app/docs/graphql/webhooks) — Linear, 2026
- [Sentry Webhooks — Issues](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/issues/) — Sentry, 2026
- [Sentry Webhooks — Errors](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/errors/) — Sentry, 2026
- [Sentry Webhooks — Metric Alerts](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/metric-alerts/) — Sentry, 2026

### SDK / Source References
- [Linear SDK (github.com/linear/linear)](https://github.com/linear/linear) — WorkflowType enum, Issue type
- [Sentry GitHub Issue #93404](https://github.com/getsentry/sentry/issues/93404) — Live payload example

---

**Last Updated**: 2026-03-13
**Confidence Level**: High — all corrections sourced from live official documentation
**Next Steps**: Apply 6 corrections to `thoughts/shared/plans/2026-03-13-entity-system-redesign.md`
