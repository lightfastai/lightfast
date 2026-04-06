---
name: lightfast-sentry
description: |
  Load Lightfast Sentry skill for investigating issues in the dev environment.
  Use when the user asks to "check sentry", "list issues", "view an error",
  "explain an issue", "what's failing", "show sentry issues for platform/app/www",
  or asks about errors in a specific app.
---

# Lightfast Sentry Skill

Investigate Sentry issues across the Lightfast monorepo from the CLI. Dev environment only.

## IMPORTANT: Always Run from the App Directory

Every Sentry CLI command **must** run from the correct app directory so `pnpm with-env` loads the right `SENTRY_PROJECT` env var.

```bash
# Pattern: cd to the app, then run with-env
cd apps/<app> && pnpm with-env npx sentry <command>
```

**DO NOT** run `sentry` from the repo root — it won't find the project-specific env vars.

## App-to-Project Mapping

| Directory        | Sentry Project       | Port |
| ---------------- | -------------------- | ---- |
| `apps/app`       | `lightfast-app`      | 4107 |
| `apps/platform`  | `lightfast-platform` | 4112 |
| `apps/www`       | `lightfast-www`      | 4101 |

All three share the same `SENTRY_ORG` and `SENTRY_AUTH_TOKEN`. Only `SENTRY_PROJECT` differs.

## Environment Variables

| Variable                  | Scope        | Purpose                        |
| ------------------------- | ------------ | ------------------------------ |
| `NEXT_PUBLIC_SENTRY_DSN`  | Runtime      | SDK error capture              |
| `SENTRY_ORG`              | CLI / Build  | Organization slug              |
| `SENTRY_PROJECT`          | CLI / Build  | Project slug (per-app)         |
| `SENTRY_AUTH_TOKEN`       | CLI / Build  | Auth token (shared across apps)|

Env files live at: `apps/<app>/.vercel/.env.development.local`

## Quick Decision Tree

### "I want to see what's failing"

```
See issues?
├─ All issues for an app → sentry issue list
├─ Filter by query → sentry issue list -q "is:unresolved"
├─ Sort by frequency → sentry issue list -s freq
├─ More results → sentry issue list -n 50
├─ Next page → sentry issue list -c next
└─ JSON output → sentry issue list --json
```

### "I want to understand a specific issue"

```
Investigate an issue?
├─ View details + stack trace → sentry issue view <ID>
├─ Open in browser → sentry issue view <ID> -w
├─ AI root cause analysis → sentry issue explain <ID>
└─ AI solution plan → sentry issue plan <ID>
```

### "I want to check multiple apps"

```
Check all apps?
├─ Run issue list from each app directory separately
├─ Compare across projects by running in parallel
└─ Use --json for programmatic comparison
```

## Anti-Patterns

### Running from Repo Root

```bash
# WRONG — no SENTRY_PROJECT in scope
npx sentry issue list

# CORRECT — run from the app directory
cd apps/platform && pnpm with-env npx sentry issue list
```

### Forgetting `pnpm with-env`

```bash
# WRONG — env vars not loaded
cd apps/app && npx sentry issue list

# CORRECT — with-env loads .vercel/.env.development.local
cd apps/app && pnpm with-env npx sentry issue list
```

### Using sentry-cli Instead of sentry

```bash
# WRONG — sentry-cli binary is not installed
npx sentry-cli issues list

# CORRECT — use the sentry package
npx sentry issue list
```

## Reference Index

### Issues

| File                                              | Purpose                                    |
| ------------------------------------------------- | ------------------------------------------ |
| [issues/RULE.md](./references/issues/RULE.md)     | Issue investigation workflow               |
| [issues/commands.md](./references/issues/commands.md) | list, view, explain, plan flags & examples |
