---
name: monitor-vercel-production-deployment
description: Use when a Vercel-backed release, PR merge, or promotion needs production traffic, aliases, runtime health, or related release gates verified.
---

# Monitor Vercel Production Deployment

## Trigger

Need to watch Vercel after a PR merge, release, deploy, or promotion until the expected deployment is production-ready and serving production traffic.

Use Vercel deployment state as the source of truth. A merged PR is not enough: verify the expected commit, `target: production`, `state: READY`, and production alias/domain evidence.

If the release includes database/schema migrations or production workflow changes, Vercel readiness is not enough. Verify the non-Vercel release gate too, or report it as pending.

## Workflow

1. Identify the expected commit SHA, project(s), production domain(s), optional health path, and non-Vercel release gates.
2. Confirm Vercel auth and scope before waiting: `npx vercel whoami` and, when needed, `--scope <team>`.
3. List recent production deployments for each affected project.
4. Match the deployment by supplied deployment URL, deployment ID, or `meta.githubCommitSha`.
5. If the deployment is still building, wait on that deployment with `inspect --wait`.
6. If it fails, collect build logs and recent runtime errors before reporting.
7. Verify production is current by inspecting the production domain/alias or promotion status.
8. Smoke-test a health endpoint when one is known and check recent production logs for error or 5xx bursts.
9. If a database/schema migration gate is present, verify it separately before calling the whole release done.

## Commands

```bash
# Confirm account and use --scope <team> if the account belongs to multiple teams
npx vercel whoami

# Detect Lightfast DB/schema release gates from a PR
gh pr view <pr-number> --json files --jq '.files[].path' \
  | rg '^(db/app/src/(migrations|schema)/|\.github/workflows/db-migrate\.yml)' || true

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

# Lightfast DB migration gate. Trigger only after explicit user approval.
gh workflow run db-migrate.yml --repo lightfastai/lightfast --ref main -f confirm=migrate
gh run watch <run-id> --repo lightfastai/lightfast --exit-status --interval 10
gh run view <run-id> --repo lightfastai/lightfast --json conclusion,headSha,status,url
pscale deploy-request list lightfast --org lightfast -f json
pscale deploy-request show lightfast <number> --org lightfast -f json
pscale branch schema lightfast main --org lightfast
```

## Guardrails

- Do not call production deployed until the matching deployment is `READY` and `target` is `production`.
- Do not call the release complete if changed files include DB/schema migrations until the migration workflow or PlanetScale deploy request is verified, or explicitly report that gate as pending.
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
- Non-Vercel release gate evidence, such as DB migration workflow run, PlanetScale deploy request, or schema verification
- Final status: production deployed, still pending, failed, or blocked with the next concrete diagnostic
