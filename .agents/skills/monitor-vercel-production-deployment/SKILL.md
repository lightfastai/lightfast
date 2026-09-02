---
name: monitor-vercel-production-deployment
description: Use when a Vercel-backed release, PR merge, or promotion needs production traffic, aliases, runtime health, or related release gates verified.
---

# Monitor Vercel Production Deployment

This Lightfast repository has no Vercel-backed production target. Do not use
this skill for `apps/example`; website deployments belong to `lightfastai/www`.

## Trigger

Need to watch Vercel after a PR merge, release, deploy, or promotion until the expected deployment is production-ready and serving production traffic.

Use Vercel deployment state as the source of truth. A merged PR is not enough: verify the expected commit, `target: production`, `state: READY`, and production alias/domain evidence.

## Workflow

1. Identify the expected commit SHA, project(s), production domain(s), and optional health path.
2. Confirm Vercel auth and scope before waiting: `npx vercel whoami` and, when needed, `--scope <team>`.
3. List recent production deployments for each affected project.
4. Match the deployment by supplied deployment URL, deployment ID, or `meta.githubCommitSha`.
5. If the deployment is still building, wait on that deployment with `inspect --wait`.
6. If it fails, collect build logs and recent runtime errors before reporting.
7. Verify production is current by inspecting the production domain/alias or promotion status.
8. Smoke-test a health endpoint when one is known and check recent production logs for error or 5xx bursts.

## Commands

```bash
# Confirm account and use --scope <team> if the account belongs to multiple teams
npx vercel whoami

# List production deployments; pass a project in monorepos
npx vercel list <project> --environment production --format json --yes

# Find the deployment for an expected Git commit SHA
npx vercel list <project> --environment production --format json --yes \
  | jq -r --arg sha "$SHA" '.deployments[] | select(.meta.githubCommitSha == $sha) | [.state, .target, .url] | @tsv'

# Wait for a specific deployment to finish
npx vercel inspect <deployment-url-or-id> --wait --timeout 10m --format json

# Build logs when the deployment errors
npx vercel inspect <deployment-url-or-id> --logs

# Check whether a production domain/alias points at the expected deployment
npx vercel inspect <production-domain> --format json

# Check pending promotions, especially after promote/rolling-release flows
npx vercel promote status <project> --timeout 30s --yes

# Recent runtime signals; keep windows bounded
set -o pipefail; npx vercel logs <deployment-url-or-id> --environment production --since 30m --level error --limit 50 --json | jq -s 'length'
set -o pipefail; npx vercel logs <deployment-url-or-id> --environment production --since 30m --status-code 500,501,502,503,504,505 --limit 50 --json | jq -s 'length'

```

## Guardrails

- Do not call production deployed until the matching deployment is `READY` and `target` is `production`.
- Do not accept a preview URL, branch alias, or latest unrelated production deployment as evidence.
- `vercel inspect` can omit Git metadata. Use `vercel list` for the commit SHA match and `vercel inspect <domain>` for production alias/domain routing.
- In monorepos, check every affected Vercel project; one project being ready does not prove the whole release is live.
- Use `VERCEL_TOKEN` env var for automation, not `--token`; add `--scope` when the token can access multiple teams.
- Keep waits and logs bounded with `--timeout`, `--since`, and `--limit`; do not leave live log streams running.
- When piping CLI output into `jq`, use `set -o pipefail` so a CLI validation error cannot look like an empty successful result.
- If no matching deployment appears, verify Git integration settings, ignored-build/path filters, and whether the project is expected to deploy for that merge.

## Output

- Expected PR/merge/release identifier and commit SHA
- Project(s) checked
- Deployment URL/ID, state, target, and matched commit evidence
- Production alias/domain or promotion evidence
- Smoke-test and recent-error summary, if checked
- Final status: production deployed, still pending, failed, or blocked with the next concrete diagnostic
