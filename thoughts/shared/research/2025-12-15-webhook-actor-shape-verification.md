---
date: 2025-12-15T16:30:00+08:00
researcher: claude-opus-4-5
topic: "GitHub and Vercel Webhook Actor Shape Verification"
tags: [research, web-analysis, webhooks, github, vercel, actor-identity]
status: complete
created_at: 2025-12-15
confidence: high
sources_count: 12
---

# Web Research: GitHub and Vercel Webhook Actor Shape Verification

**Date**: 2025-12-15T16:30:00+08:00
**Topic**: Verify webhook payload structures for GitHub and Vercel to validate actor implementation bugfix plan
**Confidence**: High - Based on official documentation and SDK type definitions

## Research Question

Verify that the assumptions in `thoughts/shared/plans/2025-12-15-actor-implementation-bugfix-oauth.md` are correct regarding:
1. GitHub push event `pusher` vs `sender` field structures
2. GitHub PR/Issue/Release/Discussion user object structures
3. Vercel webhook git metadata availability

## Executive Summary

**All claims in the plan document are VERIFIED as correct.** The research confirms:

1. **GitHub Push Events**: `payload.pusher` only has `name` and `email` (from Git commit metadata). `payload.sender` has the full GitHub user object with numeric `id`, `login`, and `avatar_url`.

2. **GitHub PR/Issue/Release/Discussion Events**: User objects (`pr.user`, `issue.user`, `release.author`, `discussion.user`) all contain numeric `id`, `login`, and `avatar_url`.

3. **Vercel Webhooks**: Only provide `githubCommitAuthorName` (username string), NOT a numeric GitHub user ID. This is a fundamental limitation of Vercel's webhook payload structure.

## Key Findings

### GitHub Webhook Payload Structures

#### Push Event - Two Different User Representations

GitHub uses two distinct patterns in push events:

| Field | Purpose | Available Data | Has Numeric ID? |
|-------|---------|----------------|-----------------|
| `pusher` | Git-level identity (from commit) | `name`, `email` only | **NO** |
| `sender` | GitHub account that triggered event | Full user object | **YES** |

**Evidence from real webhook payload** ([Source](https://gist.github.com/walkingtospace/0dcfe43116ca6481f129cdaa0e112dc4)):

```json
"pusher": {
  "name": "walkingtospace",
  "email": "walkingtospace@..."
}

"sender": {
  "login": "walkingtospace",
  "id": 2024264,
  "node_id": "MDQ6VXNlcjIwMjQyNjQ=",
  "avatar_url": "https://avatars.githubusercontent.com/u/2024264?v=4"
}
```

**Why the distinction exists**: `pusher` represents Git-level identity from commit metadata, while `sender` represents the GitHub account. The plan correctly identifies that we should use `sender.id` for consistency.

#### PR/Issue/Release/Discussion Events - Full User Objects

All other GitHub events include full user objects with numeric IDs:

| Event | User Field | Has `id` | Has `login` | Has `avatar_url` |
|-------|------------|----------|-------------|------------------|
| Pull Request | `pr.user` | ✅ | ✅ | ✅ |
| Issue | `issue.user` | ✅ | ✅ | ✅ |
| Release | `release.author` | ✅ | ✅ | ✅ |
| Discussion | `discussion.user` | ✅ | ✅ | ✅ |

**Source**: [GitHub Event Types Documentation](https://docs.github.com/en/rest/using-the-rest-api/github-event-types)

### Vercel Webhook Payload Structure

**Critical Finding**: Vercel webhooks do NOT include numeric GitHub user IDs.

| Field | Type | Example Value |
|-------|------|---------------|
| `meta.githubCommitAuthorName` | string | `"developer-username"` |
| `gitMetadata.commitAuthorName` | string | `"Developer Name"` |
| `gitMetadata.commitAuthorEmail` | string | `"dev@example.com"` |

**What's NOT available**:
- ❌ Numeric GitHub user ID
- ❌ GitHub account ID
- ❌ Any GitHub-specific identifier beyond username

**Source**: [Vercel SDK PayloadDeployment](https://raw.githubusercontent.com/vercel/sdk/main/docs/models/payloaddeployment.md), [Vercel API Create Deployment](https://vercel.com/docs/rest-api/reference/endpoints/deployments/create-a-new-deployment)

## Plan Validation

### Claim 1: Push events - `pusher` only has `name` and `email`

**Status**: ✅ VERIFIED

The plan states:
> Push events use `payload.pusher.name` (username), while other events use numeric user ID

This is correct. `pusher` is limited to Git commit metadata fields.

### Claim 2: Push events - Use `sender.id` for consistency

**Status**: ✅ VERIFIED AND RECOMMENDED

The plan proposes:
```typescript
// Use sender (has numeric ID) instead of pusher (only has username)
actor: payload.sender
  ? {
      id: String(payload.sender.id),
      name: payload.sender.login,
      email: payload.pusher?.email || undefined,
      avatarUrl: payload.sender.avatar_url,
    }
  : undefined,
```

This is the correct approach. Note: email is still taken from `pusher` since `sender` doesn't have email in the payload.

### Claim 3: PR/Issue/Release/Discussion have numeric `id`

**Status**: ✅ VERIFIED

All these events use standard GitHub user objects with numeric `id`, `login`, and `avatar_url`.

### Claim 4: Vercel only provides username, not numeric ID

**Status**: ✅ VERIFIED

The plan correctly identifies this as a known limitation:
> Vercel webhook payloads only include `gitMeta.githubCommitAuthorName` (username), not the numeric GitHub user ID.

## Implications for Actor Identity System

### Consistent ID Format (Recommended)

After the fix, all GitHub-sourced actor IDs will be numeric:
- Push: `github:12345678` (from `sender.id`)
- PR: `github:12345678` (from `pr.user.id`)
- Issue: `github:12345678` (from `issue.user.id`)
- Release: `github:12345678` (from `release.author.id`)
- Discussion: `github:12345678` (from `discussion.user.id`)

### Vercel Exception (Accepted Limitation)

Vercel deployments will still use username-based IDs:
- Vercel: `github:alice` (from `meta.githubCommitAuthorName`)

This means the same user may have two actor profiles:
1. `github:12345678` (from GitHub events)
2. `github:alice` (from Vercel events)

The plan correctly documents this as a "Known Limitation" with future fix options.

## Risk Assessment

### Low Risk
- **Double prefix bug fix**: Straightforward removal of `github:` prefix from transformers
- **PR/Issue/Release/Discussion changes**: Already using numeric IDs, just removing prefix

### Medium Risk
- **Push event sender change**: Switching from `pusher.name` to `sender.id` changes the ID format
  - **Mitigation**: No production data exists yet; test data can be cleared

### Accepted Limitations
- **Vercel username-based IDs**: Cannot be resolved via OAuth (matches on numeric ID)
  - **Mitigation**: Email resolution still works; document as known behavior

## Recommendations

1. **Proceed with plan as written** - All assumptions are verified correct

2. **Add comment explaining pusher vs sender** in the code:
   ```typescript
   // GitHub push payloads have two user representations:
   // - pusher: Git-level identity with only name/email (no numeric ID)
   // - sender: GitHub account with full user object including numeric ID
   // We use sender for consistency with PR/Issue/Release/Discussion events
   ```

3. **Consider future Vercel enhancement**: If username-to-ID resolution becomes important, add GitHub API call or username fallback to OAuth resolution (as documented in Future Considerations)

## Sources

### Official Documentation
- [GitHub Webhook Events and Payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads) - Official reference
- [GitHub REST API Event Types](https://docs.github.com/en/rest/using-the-rest-api/github-event-types) - User object properties
- [Vercel Create Deployment API](https://vercel.com/docs/rest-api/reference/endpoints/deployments/create-a-new-deployment) - gitMetadata structure
- [Vercel SDK Models](https://raw.githubusercontent.com/vercel/sdk/main/docs/models/payloaddeployment.md) - TypeScript definitions

### Real-World Examples
- [GitHub Push Event Payload Example](https://gist.github.com/walkingtospace/0dcfe43116ca6481f129cdaa0e112dc4) - Shows pusher vs sender
- [GitHub Community Discussion #25448](https://github.com/orgs/community/discussions/25448) - Pusher field access
- [GitHub Community Discussion #26029](https://github.com/orgs/community/discussions/26029) - Issue user fields
- [MagicBell PR Review Event](https://www.magicbell.com/workflows/github/pull-request-review-submitted) - Sample payloads

### Additional References
- [AWS CodeBuild GitHub Webhooks](https://docs.aws.amazon.com/codebuild/latest/userguide/github-webhook.html) - Confirms sender.id pattern
- [Vercel GitHub Discussion #5301](https://github.com/vercel/vercel/discussions/5301) - Deployment structure

---

**Last Updated**: 2025-12-15
**Confidence Level**: High - Based on official documentation and SDK type definitions
**Related Document**: `thoughts/shared/plans/2025-12-15-actor-implementation-bugfix-oauth.md`
**Next Steps**: Proceed with implementation of Phase 1 (transformer fixes)
