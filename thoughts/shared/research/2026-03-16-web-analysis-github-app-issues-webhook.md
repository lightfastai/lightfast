---
date: 2026-03-16T00:00:00+00:00
researcher: claude-sonnet-4-6
topic: "Does a GitHub App emit webhook events for Issues?"
tags: [research, web-analysis, github, webhooks, issues, github-app]
status: complete
created_at: 2026-03-16
confidence: high
sources_count: 6
---

# Web Research: Does a GitHub App emit webhook events for Issues?

**Date**: 2026-03-16
**Topic**: GitHub App issues webhook support and configuration
**Confidence**: High — official GitHub docs + confirmed against local codebase

## Research Question

Does a GitHub App emit webhook events for "issues"? We currently have PRs and issues set up. Is the GitHub App actually sending issue webhooks?

## Executive Summary

Yes — GitHub Apps fully support `issues` webhooks via a dedicated `x-github-event: issues` header. It is a **separate event** from `pull_request` and requires its own permission ("Issues: Read") and explicit subscription in the GitHub App registration. Our codebase already handles this correctly end-to-end: `extractEventType` reads `x-github-event` directly, `githubWebhookEventTypeSchema` enumerates both `"pull_request"` and `"issues"`, and `defaultSyncEvents` includes both.

The question is not whether the code supports it — it does — but whether the **GitHub App registration** (on github.com) has the `issues` event checked under "Subscribe to events".

## Key Findings

### The `issues` Webhook Event

GitHub sends `x-github-event: issues` for all issue lifecycle events. The 12 supported `action` values are:

| Action | Description |
|--------|-------------|
| `opened` | New issue created |
| `edited` | Title/body edited |
| `deleted` | Issue deleted |
| `transferred` | Issue transferred to another repo |
| `closed` | Issue closed |
| `reopened` | Closed issue reopened |
| `assigned` | User assigned |
| `unassigned` | User unassigned |
| `labeled` | Label applied |
| `unlabeled` | Label removed |
| `milestoned` | Milestone added |
| `demilestoned` | Milestone removed |

Our relay currently handles `opened`, `closed`, `reopened` (see `packages/console-providers/src/providers/github/index.ts:112-116`).

### How GitHub App Permissions Gate Webhook Subscriptions

This is the critical path: on the GitHub App registration page:

1. Grant **"Issues: Read"** (or Read & Write) under Repository permissions
2. Once granted, the **`issues` event checkbox appears** under "Subscribe to events"
3. Check it

If "Issues" permission is not granted, the `issues` subscription checkbox is hidden entirely. This is why a setup can look complete but still not receive issues webhooks — the subscription was never visible to check.

Same pattern for `pull_request` — requires "Pull requests: Read" permission first.

### Our Codebase's Issues Support (Already Complete)

Everything is already in place:

```
packages/console-providers/src/providers/github/schemas.ts:101
  githubWebhookEventTypeSchema = z.enum(["pull_request", "issues"])

packages/console-providers/src/providers/github/index.ts:107-117
  issues: actionEvent({
    actions: { opened, closed, reopened }
  })

packages/console-providers/src/providers/github/index.ts:136
  extractEventType: (headers) => headers.get("x-github-event") ?? "unknown"

packages/console-providers/src/providers/github/index.ts:248
  events: ["pull_request", "issues"]  ← stored in accountInfo on connect

packages/console-providers/src/providers/github/index.ts:257
  defaultSyncEvents: ["pull_request", "issues"]
```

The relay will correctly parse an incoming `x-github-event: issues` payload through `preTransformGitHubIssuesEventSchema` → `transformGitHubIssue` and dispatch it via QStash.

## Trade-off Analysis

### If `issues` Webhook is NOT Subscribed on GitHub App

| Impact | Details |
|--------|---------|
| No `issues` webhooks received | Relay gets zero issue events, all issue data is silent |
| No error surfaced | GitHub simply doesn't send them; relay won't show missing deliveries |
| Backfill can compensate | Historical issues can be fetched via REST API backfill |
| Real-time gap | Any issue opened/closed after connection won't be captured until subscription is added |

### If `issues` Webhook IS Subscribed (correct state)

| Impact | Details |
|--------|---------|
| Relay receives `x-github-event: issues` | Parsed by `preTransformGitHubIssuesEventSchema` |
| Actions `opened`, `closed`, `reopened` handled | Other actions (labeled, assigned, etc.) pass through as eventType but aren't in the `actions` map |
| Full real-time coverage | Issues captured as they happen |

## How to Verify

### Check GitHub App Registration

1. Go to github.com → Settings → Developer settings → GitHub Apps → your app
2. Click "Permissions & events"
3. Under "Repository permissions" → confirm "Issues" is set to Read or Read & Write
4. Scroll to "Subscribe to events" → confirm `issues` checkbox is checked

### Check via GitHub App Deliveries API

```bash
# List recent webhook deliveries for your app
curl -H "Authorization: Bearer <app-jwt>" \
  https://api.github.com/app/hook/deliveries?per_page=10

# Look for deliveries where:
# "event": "issues"
```

### Check Relay Logs

```bash
# In production/staging — search for issues eventType
# If no `issues` deliveries appear but PRs do → subscription not enabled
```

## Recommendations

1. **Verify the GitHub App registration** has both "Issues: Read" permission AND the `issues` event checked. This is the most likely gap if issues aren't arriving.

2. **No code changes needed** — `packages/console-providers/src/providers/github/` already handles the full issues pipeline correctly.

3. **Consider expanding handled actions** — currently only `opened`, `closed`, `reopened` are in the `actions` map. If labeled/assigned events matter, they can be added to the `issues` event definition without schema changes.

4. **Test with a real issue** — once the subscription is confirmed, open and close a test issue in a connected repo and verify it appears in `gatewayWebhookDeliveries` with `eventType = "issues"`.

## Open Questions

- Are `labeled`, `assigned`, `edited` issue actions needed for product features? Currently they'd be received but not mapped to named actions.
- Does the GitHub App currently have "Issues: Read" permission granted, or only "Pull requests"?

## Sources

### Official Documentation
- [GitHub Webhook Events — `issues`](https://docs.github.com/en/webhooks/webhook-events-and-payloads#issues) — GitHub, 2024
- [Using webhooks with GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps) — GitHub, 2024
- [Choosing permissions for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app) — GitHub, 2024

### Specifications
- [Octokit Webhooks spec](https://github.com/octokit/webhooks) — machine-readable canonical list of all GitHub webhook event action types

### Codebase References
- `packages/console-providers/src/providers/github/index.ts` — provider definition with `issues` event + actions
- `packages/console-providers/src/providers/github/schemas.ts:101` — `githubWebhookEventTypeSchema`
- `apps/relay/src/middleware/webhook.ts:136` — `extractEventType` reads `x-github-event` header

---

**Last Updated**: 2026-03-16
**Confidence Level**: High — GitHub docs are authoritative; codebase confirmed
**Next Steps**: Verify GitHub App registration has "Issues: Read" permission + `issues` event subscription checked
