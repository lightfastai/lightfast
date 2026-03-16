---
date: 2026-03-16T00:00:00+00:00
researcher: claude-sonnet-4-6
topic: "Vercel Related Projects - Max Number of Related Projects"
tags: [research, web-analysis, vercel, monorepo, microfrontends, related-projects]
status: complete
created_at: 2026-03-16
confidence: high
sources_count: 7
---

# Web Research: Vercel Related Projects — Max Number Limit

**Date**: 2026-03-16
**Topic**: What is the max number of related projects in Vercel, and what does the feature do?
**Confidence**: High — sourced from official Vercel docs, npm registry, and changelog

## Research Question

Search up Vercel's "related projects" feature and investigate the "max number of related projects".

## Executive Summary

Vercel's **Related Projects** is a February 2025 feature that automatically syncs deployment URLs across separate Vercel projects in the same repository. The hard cap is **3 related projects per app** — a structural limit that cannot be raised by plan tier and is not separately listed on the general limits page.

For Lightfast: if `console` wanted to auto-resolve URLs for `relay` (4108), `gateway` (4110), and `backfill` (4109), that already hits the limit exactly. Any fourth service linkage requires workarounds.

## Key Metrics & Findings

### Hard Limit
**Finding**: Maximum **3 related projects** per app, declared in `vercel.json`
**Source**: https://vercel.com/docs/monorepos

> "While every app in your monorepo can list related projects in their own `vercel.json`, you can **only specify up to three related projects per app**."

- Confirmed by third-party project issue tracker: https://github.com/PolicyEngine/policyengine-app-v2/issues/565
- Not tier-gated (Hobby, Pro, Enterprise all share the same limit)
- No documented escalation path to raise the limit

### What the Feature Does
**Finding**: Injects a `VERCEL_RELATED_PROJECTS` env var at build + runtime with the deployment URLs of related projects, eliminating manual `API_URL` environment variable management.
**Source**: https://vercel.com/changelog/sync-projects-with-vercel-related-projects (Feb 20, 2025)

- Use case: frontend auto-resolves backend preview URL without manual env var wiring
- Works only with **Git-connected deployments** (not CLI deployments)
- Only works within the same repository

### Configuration
**Source**: https://www.npmjs.com/package/@vercel/related-projects

In `vercel.json` of the consuming app:

```json
{
  "relatedProjects": ["prj_123", "prj_456"]
}
```

In application code:

```ts
import { withRelatedProject } from '@vercel/related-projects';

const apiHost = withRelatedProject({
  projectName: 'my-api-project',
  defaultHost: process.env.API_HOST,
});
```

## Trade-off Analysis

### Using Related Projects (≤3 services)
| Factor | Impact | Notes |
|--------|--------|-------|
| URL sync | Automatic | Branch preview URLs injected at build + runtime |
| Configuration | File-based | `vercel.json` only, no dashboard UI |
| Limit exposure | Low (if ≤3) | Fits relay + gateway + backfill exactly |

### Hitting the Limit (>3 services)
| Factor | Impact | Notes |
|--------|--------|-------|
| Flexibility | Blocked | No workaround within the feature itself |
| Fallback | Manual env vars | Same workflow as pre-2025, no auto-sync |
| Escalation | None documented | Cannot raise limit via support or Enterprise |

## Recommendations

1. **Use Related Projects for the 3 Hono services** (relay, gateway, backfill): This exactly fills the limit for `console`. Keep microfrontend apps (`www`, `auth`) out of `console`'s `relatedProjects` since their URLs are already handled via microfrontends proxy rewrites.

2. **Each app can declare its own `relatedProjects`**: The limit is per-app, not per-repo. `www` and `auth` can independently declare their own up-to-3 related projects if needed.

3. **Do not rely on this for CLI deployments**: Feature only works with Git-triggered deploys. Local `vercel deploy` CLI calls will not inject `VERCEL_RELATED_PROJECTS`.

## Known Limitations

- `VERCEL_RELATED_PROJECTS` only contains **branch URLs** for previews, not commit-specific URLs — breaks E2E testing that needs exact deployment URLs
  - Community thread: https://community.vercel.com/t/include-commit-urls-in-vercel-related-projects-and-deployment-webhooks-for-monorepo-e2e-testing/34003
- No dashboard UI to configure — must use `vercel.json`
- The 3-project limit is completely separate from "projects connected per git repo" (10 Hobby / 60 Pro)

## Package Details

- **npm**: `@vercel/related-projects`
- **Version**: 1.0.1 (canary 1.1.0 as of Feb 2026)
- **First published**: February 2025
- **Weekly downloads**: ~21,300
- **Source PR**: https://github.com/vercel/vercel/pull/13027 (merged Feb 11, 2025)

## Sources

### Official Documentation
- [Vercel Monorepos Docs](https://vercel.com/docs/monorepos) — Vercel, states the 3-project limit
- [Changelog: Sync Projects with Related Projects](https://vercel.com/changelog/sync-projects-with-vercel-related-projects) — Feb 20, 2025 (Tom Knickman, Mark Knichel)
- [npm: @vercel/related-projects](https://www.npmjs.com/package/@vercel/related-projects) — usage docs and API reference

### Community & Third-Party
- [PolicyEngine issue #565](https://github.com/PolicyEngine/policyengine-app-v2/issues/565) — confirms "Max 3 related projects can be linked"
- [Vercel Community: commit URLs in VERCEL_RELATED_PROJECTS](https://community.vercel.com/t/include-commit-urls-in-vercel-related-projects-and-deployment-webhooks-for-monorepo-e2e-testing/34003)

### Implementation
- [vercel/vercel PR #13027](https://github.com/vercel/vercel/pull/13027) — original implementation PR

---

**Last Updated**: 2026-03-16
**Confidence Level**: High — official Vercel documentation directly states the limit
**Next Steps**: If `console` needs URL sync for all 3 Hono services, the limit is exactly met. If a 4th service needs linking, fall back to manual env vars or restructure which app declares the `relatedProjects`.
