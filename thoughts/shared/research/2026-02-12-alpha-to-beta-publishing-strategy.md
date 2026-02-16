---
date: 2026-02-12T08:04:24Z
researcher: Claude
git_commit: d9d99c5d
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "Alpha-to-Beta Publishing Strategy for core/lightfast and core/mcp"
tags: [research, codebase, versioning, publishing, alpha, beta, sdk, mcp, changesets]
status: complete
last_updated: 2026-02-12
last_updated_by: Claude
---

# Research: Alpha-to-Beta Publishing Strategy for core/lightfast and core/mcp

**Date**: 2026-02-12T08:04:24Z
**Researcher**: Claude
**Git Commit**: d9d99c5d
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast-search-perf-improvements

## Research Question

From the API docs auto-generation plan, how should we proceed through the beta process? When publishing new versions of `core/lightfast/` and `core/mcp/`, do users need to be notified, and what's the recommended process?

## Summary

Both `lightfast` and `@lightfastai/mcp` are currently at `0.1.0-alpha.1` with a Changesets-based release pipeline. The packages use **fixed versioning** (they always share the same version number). The existing infrastructure includes automated GitHub Actions for publishing to npm, changeset validation on PRs, and provenance attestations. However, there is currently no user notification system, no deprecation policy, no migration guides, and no alpha/beta distinction in npm dist-tags (both use `latest`).

## Detailed Findings

### Current Publishing Infrastructure

#### Changesets Configuration (`.changeset/config.json`)
- Both `lightfast` and `@lightfastai/mcp` are in a **fixed versioning group** — they always receive the same version bump
- Access: `public`, base branch: `main`
- Changelog: default `@changesets/cli/changelog` generator

#### Release Workflow (`.github/workflows/release.yml`)
- Triggered on push to `main` with `.changeset/**` changes
- Uses `lightfast-release-bot` with dedicated GitHub and npm tokens
- Builds both packages, tests `lightfast`, then publishes via `changesets/action@v1`
- npm provenance attestations enabled (`NPM_CONFIG_PROVENANCE: true`)
- Post-publish notification is a placeholder echo (no Slack/Discord integration)

#### PR Validation (`.github/workflows/verify-changeset.yml`)
- Validates changeset files on PRs: must reference a package, include version type (patch/minor/major), and have a summary

#### Current Package Versions
- `lightfast@0.1.0-alpha.1` — TypeScript SDK
- `@lightfastai/mcp@0.1.0-alpha.1` — MCP server
- Both configured with `publishConfig.tag: "latest"` and `publishConfig.access: "public"`

### What Exists for User Communication
- **CHANGELOGs**: `core/ai-sdk/CHANGELOG.md` exists with 2 versions documented — shows the Changesets format is working for other packages
- **No CHANGELOG yet for lightfast or @lightfastai/mcp** — these haven't had a version bump through the Changesets flow yet
- **No notification system**: The release workflow has a placeholder for Slack notifications at line 69
- **No deprecation workflow**: No automation for marking old npm versions as deprecated
- **No migration guide template**: No existing pattern for communicating breaking changes

### How the SDK and MCP Server Relate to the API

- Both packages consume `@repo/console-types` Zod schemas as the source of truth
- The SDK (`lightfast`) re-exports types from console-types and adds developer-friendly wrappers with optional defaults
- The MCP server (`@lightfastai/mcp`) depends on both the SDK and console-types directly
- API versioning is URL-based (`/v1/search`, etc.) — the SDK hardcodes these paths
- The SDK version (`0.1.0-alpha.1`) is independent from the API version (`v1`)

### Key Risk: `publishConfig.tag: "latest"`

Both packages publish to the `latest` npm dist-tag, even though they're alpha versions. This means `npm install lightfast` installs the alpha version. For a beta strategy, this creates a decision point about dist-tag management.

## Recommended Beta Process

### Phase 1: Pre-Beta Preparation

1. **Decide on dist-tag strategy**:
   - **Option A (Recommended for now)**: Keep `latest` tag since you're pre-1.0 and semver already communicates instability. Users who `npm install lightfast` get the current version. Simple, no confusion.
   - **Option B**: Use `alpha`/`beta` dist-tags. Publish pre-releases as `npm publish --tag alpha`. Users install with `npm install lightfast@alpha`. Requires updating `.changeset/config.json` and the release workflow. More complex but cleaner separation.

2. **Add CHANGELOG files** to both packages:
   - `core/lightfast/CHANGELOG.md`
   - `core/mcp/CHANGELOG.md`
   - Changesets will auto-generate these on the first version bump

3. **Add alpha/beta banner to docs** (Phase 3 of the auto-generation plan already covers this)

### Phase 2: Making Breaking Changes During Alpha/Beta

When you make breaking changes to `@repo/console-types` schemas (which flow through to the SDK and MCP server):

1. **Create a changeset** with `major` or `minor` bump type:
   ```bash
   pnpm changeset
   # Select both lightfast and @lightfastai/mcp
   # Choose "minor" for new features, "major" for breaking changes
   # Write a clear summary of what changed and why
   ```

2. **The changeset summary becomes your user notification**. Write it for your users:
   ```markdown
   ---
   "lightfast": minor
   "@lightfastai/mcp": minor
   ---

   ## What changed
   - `SearchInput.mode` now accepts `"precise"` in addition to existing modes
   - `V1SearchResponse.results` now includes `highlights` field by default

   ## Migration
   - No breaking changes. New fields are additive.
   ```

3. **For breaking changes**, include migration steps in the changeset:
   ```markdown
   ---
   "lightfast": major
   "@lightfastai/mcp": major
   ---

   ## Breaking: Renamed `LightfastMemory` to `Lightfast`

   The `LightfastMemory` class and `createLightfastMemory` factory are removed.

   ### Migration
   ```typescript
   // Before
   import { LightfastMemory } from "lightfast";
   const client = new LightfastMemory({ apiKey: "..." });

   // After
   import { Lightfast } from "lightfast";
   const client = new Lightfast({ apiKey: "..." });
   ```
   ```

### Phase 3: Do You Have to Tell Users?

**Short answer: Yes, but Changesets already handles most of it.**

Here's what happens automatically vs. what you need to add:

| Communication Channel | Status | Action Needed |
|---|---|---|
| **CHANGELOG.md** | Auto-generated by Changesets | Write good changeset summaries |
| **GitHub Releases** | Auto-created by `changesets/action` | None — happens on publish |
| **npm version bump** | Auto-published by release workflow | None — happens on merge |
| **Docs alpha banner** | Planned in Phase 3 of auto-gen plan | Implement the plan |
| **Email/Slack to users** | Not implemented | Add post-publish notification (optional) |
| **Migration guides** | Not implemented | Write manually for major bumps |
| **Deprecation notices** | Not implemented | Use `npm deprecate` for old versions if needed |

**What you MUST do for each release:**
1. Write a clear changeset summary (this becomes the CHANGELOG entry and GitHub release notes)
2. For breaking changes: include migration steps in the changeset
3. For deprecations: run `npm deprecate lightfast@"<old-range>" "message"` after publishing

**What you SHOULD do (recommended):**
1. Add a `MIGRATION.md` or migration section to docs for major version bumps
2. Set up post-publish Slack/Discord notification (replace the placeholder in `release.yml:69`)
3. Consider an email list or RSS feed for the CHANGELOG

**What you DON'T need to do during alpha/beta:**
1. Maintain backward compatibility for extended periods — alpha means things can break
2. Support multiple major versions simultaneously
3. Provide automated codemods or migration scripts

### Phase 4: Version Progression

Recommended version progression:

```
0.1.0-alpha.1  (current)
0.1.0-alpha.2  (bug fixes, minor additions)
...
0.1.0-beta.1   (API stabilizing, feature-complete for v1)
0.1.0-beta.2   (bug fixes only)
...
0.1.0           (stable release, semver guarantees begin)
1.0.0           (first major — only if you want to signal maturity)
```

To move to beta, create a changeset that bumps to `0.1.0-beta.1`. You may need to manually set the version in `package.json` since Changesets doesn't natively handle pre-release transitions well. Alternatively, use `pnpm changeset pre enter beta` to enter pre-release mode.

### Phase 5: Post-1.0 Obligations

Once you publish `1.0.0` or any non-pre-release version:
- Semver becomes a contract: breaking changes require major bumps
- You should have a documented deprecation policy (e.g., "deprecated versions supported for 6 months")
- Migration guides become mandatory for major versions
- Consider a versioning policy page in docs

## Code References

- `.changeset/config.json` — Fixed versioning config
- `.github/workflows/release.yml` — Automated publish pipeline
- `.github/workflows/verify-changeset.yml` — PR changeset validation
- `core/lightfast/package.json:3` — Current version `0.1.0-alpha.1`
- `core/mcp/package.json:3` — Current version `0.1.0-alpha.1`
- `core/lightfast/src/client.ts:237-243` — Deprecated aliases (example of backward compat)
- `packages/console-types/src/api/v1/` — Zod schemas (source of truth)

## Architecture Documentation

### Publishing Flow
```
Developer creates changeset → PR validated → Merge to main
    → Changesets Action creates "Version Packages" PR
    → Merge Version PR → Build + Publish to npm
    → GitHub Release created → (Notification placeholder)
```

### Version Lock
```
lightfast@X.Y.Z  ←→  @lightfastai/mcp@X.Y.Z  (always identical)
         ↑                    ↑
    @repo/console-types (workspace dependency, compile-time only)
```

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-12-api-docs-auto-generation.md` — Implementation plan for auto-generated API docs with alpha disclaimers
- `thoughts/shared/research/2026-02-12-api-docs-auto-generation-versioning.md` — Research on API versioning strategy, notes zero alpha/beta mentions in current docs

## Open Questions

1. **Dist-tag strategy**: Should alpha/beta use separate npm dist-tags, or stay on `latest` while pre-1.0?
2. **Pre-release mode in Changesets**: Should you use `pnpm changeset pre enter beta` for formal pre-release management, or manually set versions?
3. **Notification channel**: Where should post-publish notifications go? (Slack, Discord, email list, docs changelog page?)
4. **Deprecated alias removal timeline**: `LightfastMemory` and `createLightfastMemory` are deprecated — when should they be removed? (Suggested: at beta or 1.0)
