---
name: loop-on-ci
description: Use when a GitHub PR or branch has pending or failing PR-attached checks and needs repeated diagnosis until checks are green.
---

# Loop on CI

## Trigger

Need to watch a branch or pull request and iterate on CI failures until all required checks are green.

Use `gh pr checks` as the source of truth. It includes all PR-attached checks, while `gh run list` only covers GitHub Actions.

## Workflow

1. Resolve the PR for the current branch.
2. Inspect current PR checks before waiting.
3. If checks already failed, diagnose those failures first.
4. If checks are pending, watch with `gh pr checks --watch --fail-fast`.
5. After each push, re-check the full PR check set and repeat until green.
6. Before reporting green, inspect the full check set one last time and confirm no pending/failing checks remain.
7. Before merge handoff, scan changed files for release gates. If the PR touches deployment, migration, database schema, or production workflow files, include the required post-merge verification skill or command in the output.

## Commands

```bash
# Resolve the active PR
gh pr view --json number,url,headRefName

# Inspect all attached checks
gh pr checks --json name,bucket,state,workflow,link

# Assert no failing or pending buckets remain
gh pr checks --json name,bucket,state,workflow,link \
  | jq -e 'length > 0 and all(.[]; .bucket == "pass" or .bucket == "skipping")'

# Watch pending checks and fail fast
gh pr checks --watch --fail-fast

# GitHub Actions logs, when the failing check links to a GHA run
gh run view <run-id> --log-failed

# Find release-sensitive files before merge handoff
gh pr view --json files --jq '.files[].path' \
  | rg '^(db/app/src/(migrations|schema)/|\.github/workflows/db-migrate\.yml|apps/.*/vercel\.json|apps/app/microfrontends\.json)' || true
```

## Guardrails

- Keep each fix scoped to a single failure cause when possible.
- Do not bypass hooks (`--no-verify`) to force progress.
- If the failure is clearly unrelated to the PR and appears fixed on main, merge latest main instead of bloating the PR with unrelated fixes.
- If failures are flaky, retry once and report flake evidence.
- Re-run `gh pr checks --json name,bucket,state,workflow,link` after every push; the check set can change.
- Green CI is not a release-complete signal. If changed files imply production gates, report the handoff explicitly instead of letting the user infer it.

## Output

- Current CI status
- Failure summary and fixes applied
- PR URL once checks are green
- Post-merge follow-ups discovered from changed files, such as Vercel production monitoring or database migration verification
