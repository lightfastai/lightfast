# `@repo/dotlightfast` Path-Prefix Fix Implementation Plan

## Overview

Drop the hardcoded `.lightfast/` path prefix from `@repo/dotlightfast`. The indexed repo (e.g. `lightfastai/.lightfast`) IS the config root — so the parser should read `SPEC.md` and `skills/` at the repo root, not nested under `.lightfast/`. Also create a dedicated test-spam repo so the pending `invoke` and `no_dotlightfast_config` verification checks can be exercised via real commits.

## Current State Analysis

- **Parser** (`packages/dotlightfast/src/parse.ts`) hardcodes the `.lightfast/` prefix in five places:
  - `.lightfast/SPEC.md` — line 33 (fetch), line 43 (error string).
  - `.lightfast/skills` — line 47 (dir listing).
  - `.lightfast/skills/${dirName}/SKILL.md` — line 67.
  - `.lightfast/skills/${dirName}/command/${parsed.data.name}.md` — line 78.
  - `SkillManifest.path` — line 85 returns `` `.lightfast/skills/${dirName}/` ``.
- **Single consumer**: `parseDotLightfast` is imported only by `api/platform/src/inngest/functions/platform-agent-triage.ts:25`. No other callers, no backwards-compat concerns.
- **Current dev repo state**: `lightfastai/.lightfast` on `main` contains `README.md` at root plus a nested `.lightfast/` directory (committed during v1 verification as `dca2985 — test: add SPEC and example skill for agent triage v1 verification`). The nested layout is what the current parser expects but is semantically wrong — the repo IS the config root.
- **GitHub API** (`GET /repos/{owner}/{repo}/contents/{path}`) accepts an empty path — `contents/` without a trailing segment returns the root directory listing. Verified via direct curl of `lightfastai/.lightfast` (public repo).
- **Proxy** (`api/platform/src/router/platform/proxy.ts:95`) accepts empty-string path params — `path.replace("{path}", encodeURIComponent(""))` yields `contents/` (trailing slash), which GitHub accepts.
- **Pending v1 verification checks** (from `thoughts/shared/plans/2026-04-18-lightfast-agent-runtime-v1.md` Phase 5):
  - `no_dotlightfast_config` skip branch never exercised.
  - Explicit `invoke` decision never exercised — no existing `lightfast_org_events` row mentions "example".
- **No dedicated spam-repo exists**. Real push-event verification currently has to piggyback on whatever Vercel/GitHub noise arrives naturally — which is why the `invoke` path was stuck.

### Key Discoveries

- Parser error message includes the failing path string — must also drop the prefix in `DotLightfastParseError` construction (`parse.ts:43`).
- `SkillManifest.path` is exposed publicly via the package's index (`packages/dotlightfast/src/index.ts:16`). It's currently unused by the one consumer, but it's part of the public surface — we should keep the shape but drop the prefix.
- Triage event flow is repo-agnostic for event source: step 1 resolves **config** repo via `orgRepoIndexes`, step 3 loads the event row by `externalId`. An event can originate from any repo tracked by the installation — so commits to a spam repo still trigger triage against the configured `.lightfast` repo.
- The GitHub App installation covers *all* selected repos — adding a new repo to the installation is a one-click UI step (no code change).

## Desired End State

- `packages/dotlightfast/src/parse.ts` uses paths `SPEC.md`, `skills`, `skills/<name>/SKILL.md`, `skills/<name>/command/<name>.md`. No `.lightfast/` literals anywhere in the package.
- `lightfastai/.lightfast` repo layout has `SPEC.md` and `skills/example/SKILL.md` at the repo root. The nested `.lightfast/` directory is removed.
- A dedicated spam-testing repo (e.g. `lightfastai/triage-spam-a1b2c3d4`) exists and is wired into the org's GitHub App installation, so pushes to it produce `orgEvents` rows that trigger the triage function. The 8-char suffix lets us spin up fresh spam repos without name collisions — toss the old one whenever it's too noisy.
- Re-firing a triage event succeeds end-to-end against the new layout and produces identical run shape.
- Both pending v1 verification items (`no_dotlightfast_config` skip, explicit `invoke`) are checked off.
- The old plan (`2026-04-18-lightfast-agent-runtime-v1.md`) carries a clear deprecation notice pointing to this plan, and the two migrated checks are marked as carried-forward.

### Verification

- `pnpm --filter @repo/dotlightfast typecheck` passes.
- `pnpm --filter @api/platform typecheck` passes.
- `pnpm --filter @lightfast/platform build` passes.
- `pnpm typecheck` at root passes.
- Real commit to `lightfastai/triage-spam-<8char>` containing "example" in the message produces an Inngest run with `{decision: "invoke", skillName: "example"}`.
- Real commit to the spam repo with neutral content produces `{decision: "skip"}` with SPEC-aware reasoning.
- Temporarily repointing the single `orgRepoIndexes` row's `repo_full_name` at the spam repo (which has no config) and firing `platform/event.stored` returns `{skipped: "no_dotlightfast_config"}`, then the row is restored to `lightfastai/.lightfast`.

## What We're NOT Doing

- Introducing a config-path override (e.g. to support colocating `.lightfast/` inside a source repo). The current `orgRepoIndexes` model is one repo per org; the dedicated-config-repo convention is explicit.
- Changing the package name `@repo/dotlightfast` — still an accurate name for "parses Lightfast config repos".
- Writing unit tests for `parseDotLightfast` — out of scope per the original v1 plan. Still tracked as a future follow-up.
- Adding new skills or extending the triage prompt — unchanged.
- Touching the GitHub App permissions or token-vault flow — unchanged.
- Automating the UI step to install the GitHub App on the new spam repo — user does that manually.

## Implementation Approach

Four phases in strict order: parser code change (reviewable in isolation), repo-content migration + new spam repo (both GitHub-side, independent of code), re-verification of end-to-end + the two migrated checks, deprecation of the old plan. Each phase is independently verifiable.

---

## Phase 1: Drop `.lightfast/` prefix in parser

### Overview

Edit the single file `packages/dotlightfast/src/parse.ts`. Five literal changes. No public-API change — all types stay identical. The `Fetcher` callback signature is unchanged; only the path strings it's called with change.

### Changes Required

#### 1.1 `packages/dotlightfast/src/parse.ts`

**Changes**: Drop the `.lightfast/` prefix everywhere.

```ts
// Before
const specResult = await fetcher(".lightfast/SPEC.md");
// After
const specResult = await fetcher("SPEC.md");
```

```ts
// Before
throw new DotLightfastParseError(
  "SPEC.md path resolved to a directory",
  ".lightfast/SPEC.md",
);
// After
throw new DotLightfastParseError(
  "SPEC.md path resolved to a directory",
  "SPEC.md",
);
```

```ts
// Before
const skillsRoot = await fetcher(".lightfast/skills");
// After
const skillsRoot = await fetcher("skills");
```

```ts
// Before (in loadSkill)
const skillPath = `.lightfast/skills/${dirName}/SKILL.md`;
// After
const skillPath = `skills/${dirName}/SKILL.md`;
```

```ts
// Before (in loadSkill)
const commandProbe = await fetcher(
  `.lightfast/skills/${dirName}/command/${parsed.data.name}.md`,
);
// After
const commandProbe = await fetcher(
  `skills/${dirName}/command/${parsed.data.name}.md`,
);
```

```ts
// Before (in loadSkill return)
path: `.lightfast/skills/${dirName}/`,
// After
path: `skills/${dirName}/`,
```

**Design notes**:
- The fetcher receives the `skills` directory listing at the repo root. The proxy+GitHub accept this (see Current State Analysis).
- No consumer of `SkillManifest.path` exists today — the value change is safe.
- No changes to `src/types.ts`, `src/schema.ts`, `src/triage.ts`, or `src/index.ts`.
- No dependency changes.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @repo/dotlightfast typecheck` passes.
- [x] `pnpm --filter @api/platform typecheck` passes (consumer still compiles).
- [x] `pnpm typecheck` at the root passes.
- [x] Grep confirms zero remaining `.lightfast/` literals in `packages/dotlightfast/src/`: `rg "\.lightfast/" packages/dotlightfast/src/` returns nothing.

#### Manual Verification

- [x] Code review: diff is only in `parse.ts`, five hunks, all purely prefix removal.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Migrate `lightfastai/.lightfast` repo layout + create spam repo

### Overview

Two independent GitHub-side tasks: (a) flatten the existing `.lightfast` repo so `SPEC.md` and `skills/example/SKILL.md` live at the repo root, removing the nested `.lightfast/` directory; (b) create an empty `lightfastai/triage-spam` repo and the user adds it to the GitHub App installation via the UI.

### Changes Required

#### 2.1 Flatten `lightfastai/.lightfast`

**Location**: `/tmp/repos/lightfast-dotlightfast/` (already cloned locally).

**Changes**: One commit that moves files out of the nested directory.

```sh
cd /tmp/repos/lightfast-dotlightfast
git pull --ff-only origin main
git mv .lightfast/SPEC.md SPEC.md
git mv .lightfast/skills skills
# After mv the .lightfast/ directory is empty — git will not track it, but remove any stragglers.
rmdir .lightfast 2>/dev/null || true
git -c user.email=169354619+jeevanpillay@users.noreply.github.com \
    -c user.name="Jeevan Pillay" \
    commit -m "refactor: flatten config to repo root (repo IS .lightfast)"
git push origin main
```

Resulting repo layout:

```
lightfastai/.lightfast/
├── README.md
├── SPEC.md
└── skills/
    └── example/
        └── SKILL.md
```

#### 2.2 Create `lightfastai/triage-spam-<8char>`

**Tool**: GitHub CLI (`gh`) — user is authenticated as `jeevanpillay` per earlier Phase 5 verification.

**Changes**: Create a public empty repo under the `lightfastai` org with an 8-char random suffix so a fresh name is available whenever the last spam repo gets too noisy.

```sh
SUFFIX=$(openssl rand -hex 4)  # e.g. "a1b2c3d4"
REPO="triage-spam-${SUFFIX}"
gh repo create "lightfastai/${REPO}" \
  --public \
  --description "Spam repo for exercising Lightfast agent-triage event flows" \
  --clone \
  --add-readme
echo "Created: lightfastai/${REPO}"
```

Record the resulting full name (e.g. `lightfastai/triage-spam-a1b2c3d4`) — it's used in Phase 3.

**Created during implementation**: `lightfastai/triage-spam-c384f29f` (https://github.com/lightfastai/triage-spam-c384f29f). Phase 3 uses this full name.

Then the user manually:
1. Opens the GitHub App installation settings for the `lightfastai` org.
2. Adds the newly-created `triage-spam-<suffix>` repo to the list of repos the Lightfast App can access.
3. Confirms push webhooks reach the platform (a single test commit's `platform/webhook.received` event should appear in the Inngest dev dashboard).

**Note**: Do NOT insert a second `lightfast_org_repo_indexes` row for the spam repo — the invariant is one row per org, and the spam repo is explicitly NOT the config repo. Its only role is to generate `push` events. The existing row for `lightfastai/.lightfast` (`is_active=true`) continues to serve as the config source. Phase 3.3 temporarily UPDATES that single row's `repo_full_name` and restores it afterwards; no inserts.

### Success Criteria

#### Automated Verification

- [x] `gh api repos/lightfastai/.lightfast/contents/SPEC.md -q .type` returns `file`.
- [x] `gh api repos/lightfastai/.lightfast/contents/skills/example/SKILL.md -q .type` returns `file`.
- [x] `gh api repos/lightfastai/.lightfast/contents/ -q ".[].name" | rg -v '^\.lightfast$'` (old nested dir is gone).
- [x] `gh repo view lightfastai/triage-spam-<suffix>` succeeds (using the actual suffix from 2.2).

#### Manual Verification

- [x] Push a trivial commit to the spam repo: `lightfast_org_events` gains a new row with `source="github"` and the commit message as `title` (visible via `lightfast-db` / `mcp__postgres__query`). — Mechanism revised to `gh issue create` in Phase 3 because GitHub `push` events lack a registered transformer (only `issues`/`pull_request`/`issue_comment` are wired). See Phase 3 trigger-mechanism note.
- [x] The corresponding `platform/event.stored` event appears in Inngest dashboard and triggers an `Agent Triage` run (which may hit `skip` depending on content — that's fine, Phase 3 will exercise the paths explicitly). — Exercised via issue-create trigger in Phase 3.1.

**Implementation Note**: Pause for manual confirmation (repo added to installation; test webhook flow reaches DB) before proceeding to Phase 3.

---

## Phase 3: End-to-end verification (including migrated checks)

### Overview

Exercise three decision paths against the new layout: `skip` (re-baseline the happy path with flattened config), `invoke` (example-matching commit, migrated from old plan), `no_dotlightfast_config` (temporarily repointed repo index, migrated from old plan). Manual steps only — no code changes.

### Changes Required

No code changes.

Throughout this phase, `SPAM_REPO` refers to the repo created in Phase 2.2 (e.g. `lightfastai/triage-spam-a1b2c3d4`).

**Trigger mechanism note (discovered during implementation)**: the original plan specified pushing a commit to trigger triage. In reality, the GitHub provider only registers `pull_request`, `issues`, and `issue_comment` event types (`packages/app-providers/src/providers/github/index.ts:104-140`); `push` webhooks are received but skipped because there is no transformer. Phase 3 uses `gh issue create` to generate `issues.opened` webhooks, which are registered and become `orgEvents`. Adding a `push` transformer is tracked as future work outside this plan's scope.

#### 3.1 Baseline: re-verify full path with flattened config

1. Open a trivial issue against `$SPAM_REPO`: `gh issue create --repo lightfastai/triage-spam-c384f29f --title "phase 3.1 baseline ping" --body "noise"`.
2. Wait for the `Agent Triage` run to appear (observe via Inngest dev dashboard at http://localhost:8288).
3. Confirm run output has `decision: "skip"` (trivial issues are noise per SPEC) and 5 completed steps.

This sanity-checks Phase 1 against real GitHub content. If this fails, the parser changes are wrong.

#### 3.2 Exercise `invoke` decision (migrated from v1 plan)

1. In `$SPAM_REPO`, open an issue whose content clearly matches the `example` skill description: e.g. `gh issue create --repo lightfastai/triage-spam-c384f29f --title "this is an example issue that should invoke the skill" --body "example"`.
2. Wait for the resulting `Agent Triage` run.
3. Expected output: `{decision: "invoke", skillName: "example", reasoning: <LLM text>}`.
4. Verify a `platform/agent.decided` event was emitted with the same payload (queryable via `curl -s "http://localhost:8288/v1/events?name=platform/agent.decided&limit=5"`).

#### 3.3 Exercise `no_dotlightfast_config` skip (migrated from v1 plan)

Temporarily repoint the org's config repo at the spam repo (which has no `.lightfast/` config), fire an event, verify skip, then restore.

```sql
-- Repoint (substitute the actual spam repo full name from Phase 2.2):
UPDATE lightfast_org_repo_indexes
SET repo_full_name = 'lightfastai/triage-spam-<suffix>'
WHERE clerk_org_id = 'org_3Bq7JX2P4GHXJvMzAf0P0QwSZ6W'
  AND is_active = true;
```

Then fire a triage event against a fresh `eventExternalId`:

```sh
curl -s -X POST http://localhost:8288/e/local-dev-key \
  -H "content-type: application/json" \
  -d '{"name":"platform/event.stored","data":{"clerkOrgId":"org_3Bq7JX2P4GHXJvMzAf0P0QwSZ6W","eventExternalId":"<fresh-external-id>","sourceType":"deployment.succeeded","significanceScore":0,"correlationId":"phase3-no-config"}}'
```

Verify the run output is `{skipped: "no_dotlightfast_config"}`.

Restore:

```sql
UPDATE lightfast_org_repo_indexes
SET repo_full_name = 'lightfastai/.lightfast'
WHERE clerk_org_id = 'org_3Bq7JX2P4GHXJvMzAf0P0QwSZ6W'
  AND is_active = true;
```

### Success Criteria

#### Automated Verification

- [ ] No new test suite required (unit tests remain out of scope — tracked as follow-up).

#### Manual Verification

- [x] Baseline `skip` run with flattened config produces 5 completed steps and valid output (sanity-check that Phase 1 holds against real GitHub content). — Issue #2 (`_DbRS4RhqLHqz3zKeQt03`) completed with SPEC-aware `skip` reasoning.
- [x] `invoke` run: Inngest output is `{decision: "invoke", skillName: "example", reasoning: ...}`. — Issue #3 (`FVOC9ZXH8w9xdrnowqogs`).
- [x] `invoke` run: `platform/agent.decided` event carries `decision: "invoke"`, `skillName: "example"`, and a non-empty `reasoning` string.
- [x] `no_dotlightfast_config` run: output is `{skipped: "no_dotlightfast_config"}` after the SQL repoint. — run `01KPFTATMFGPFPPPBHV1FXH113`.
- [x] After SQL restore, subsequent events resolve to `lightfastai/.lightfast` (verify with another trivial commit). — Issue #4 (`7fmZLRkemXfnujbPq1O__`) returned SPEC-aware `skip`.

**Implementation Note**: Pause for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Deprecate old plan

### Overview

Add a deprecation banner to `thoughts/shared/plans/2026-04-18-lightfast-agent-runtime-v1.md` so anyone reading it is directed to the follow-up. Mark the two migrated checkboxes to point here. No code changes.

### Changes Required

#### 4.1 `thoughts/shared/plans/2026-04-18-lightfast-agent-runtime-v1.md`

**Changes**: Prepend a deprecation banner immediately after the H1, and annotate the two migrated checks in Phase 5.

Insert after line 1 (title):

```markdown
> **Deprecated layout decision**: this plan specified a `.lightfast/` path prefix inside the config repo. Superseded by `thoughts/shared/plans/2026-04-18-dotlightfast-path-prefix-fix.md` — the indexed repo IS the config root, so `SPEC.md` and `skills/` now live at the repo root. Verification items for `no_dotlightfast_config` and `invoke` are carried forward into that plan.
```

Edit the two pending Phase 5 manual-verification bullets to reference the follow-up:

- `- [ ] Emit for an org whose repo has no .lightfast/ directory: returns { skipped: "no_dotlightfast_config" }. ...` → append `Migrated to 2026-04-18-dotlightfast-path-prefix-fix.md Phase 3.3.`
- `- [ ] Emit for an event whose content clearly matches the example skill's description: decision: "invoke", skillName: "example". ...` → append `Migrated to 2026-04-18-dotlightfast-path-prefix-fix.md Phase 3.2.`

### Success Criteria

#### Automated Verification

- [x] `grep -n "Deprecated layout decision" thoughts/shared/plans/2026-04-18-lightfast-agent-runtime-v1.md` returns one line near the top. — line 3.

#### Manual Verification

- [x] Reader opening the old plan sees the banner before reading any implementation detail. — banner at line 3, immediately after H1.
- [x] Grep for `dotlightfast-path-prefix-fix` in the old plan surfaces the banner + both migrated bullets. — lines 3, 836, 837.

---

## Testing Strategy

### Unit Tests

Out of scope. Tracked as a follow-up (originally called out in the v1 plan).

### Integration Tests

Manual verification via Inngest dashboard + DB queries (Phase 3). The spam repo created in Phase 2.2 gives us a repeatable trigger surface going forward — future iterations can push arbitrary commit messages to exercise new skills without synthesizing DB rows. When the current spam repo accumulates too much noise, spin up a fresh one via the same `openssl rand -hex 4` pattern and update the installation.

### Manual Testing Steps

Captured in Phase 3 success criteria.

## Performance Considerations

No change. The parser makes the same number of GitHub API calls against the same repo — only the paths differ. All calls still share the cached installation token.

## Migration Notes

- One-way migration for the `lightfastai/.lightfast` repo — after Phase 2 the nested `.lightfast/` directory is gone. The Phase 1 parser change must ship *before* Phase 2, or revert order: if the repo is flattened while the parser still looks for `.lightfast/SPEC.md`, every triage run hits `no_dotlightfast_config`.
- Safe rollback: if Phase 1 introduces a defect, revert the parser change and `git revert` the flatten commit on `lightfastai/.lightfast`. No DB state changes in Phases 1–2.

## References

- Predecessor plan: `thoughts/shared/plans/2026-04-18-lightfast-agent-runtime-v1.md`
- Parser: `packages/dotlightfast/src/parse.ts`
- Sole consumer: `api/platform/src/inngest/functions/platform-agent-triage.ts:25`
- Proxy (path-param handling): `api/platform/src/router/platform/proxy.ts:85-264`
- GitHub endpoint catalog entry: `packages/app-providers/src/providers/github/api.ts:154-169`
- Config repo: `https://github.com/lightfastai/.lightfast`
- Previous test commit (to be superseded by Phase 2): `dca2985 — test: add SPEC and example skill for agent triage v1 verification`
