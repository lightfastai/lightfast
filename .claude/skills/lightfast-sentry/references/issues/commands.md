# Issue Commands Reference

## `sentry issue list`

List issues in a project.

```bash
sentry issue list [org/project]
```

### Flags

| Flag | Short | Default | Description |
| ---- | ----- | ------- | ----------- |
| `--query` | `-q` | — | Search query (Sentry search syntax) |
| `--limit` | `-n` | `25` | Maximum number of issues |
| `--sort` | `-s` | `date` | Sort by: `date`, `new`, `freq`, `user` |
| `--period` | `-t` | `90d` | Time period (e.g. `24h`, `14d`, `90d`) |
| `--cursor` | `-c` | — | Pagination (`next`, `prev`) |
| `--compact` | — | auto | Single-line rows |
| `--fresh` | `-f` | — | Bypass cache, fetch fresh data |
| `--json` | — | — | Output as JSON |
| `--fields` | — | — | Comma-separated fields for JSON output |

### JSON Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | string | Numeric issue ID |
| `shortId` | string | Human-readable short ID (e.g. `PROJ-ABC`) |
| `title` | string | Issue title |
| `culprit` | string | Culprit string |
| `count` | string | Total event count |
| `userCount` | number | Number of affected users |
| `firstSeen` | string | First occurrence (ISO 8601) |
| `lastSeen` | string | Most recent occurrence (ISO 8601) |
| `level` | string | Severity level |
| `status` | string | Issue status |
| `priority` | string | Triage priority |
| `platform` | string | Platform |
| `permalink` | string | URL to the issue in Sentry |
| `project` | object | Project info |
| `metadata` | object | Issue metadata |
| `assignedTo` | unknown | Assigned user or team |
| `substatus` | string | Issue substatus |
| `isUnhandled` | boolean | Whether the issue is unhandled |
| `seerFixabilityScore` | number | Seer AI fixability score (0-1) |

### Examples

```bash
# List all issues for platform
cd apps/platform && pnpm with-env npx sentry issue list

# Unresolved issues sorted by frequency
cd apps/app && pnpm with-env npx sentry issue list -q "is:unresolved" -s freq

# Last 24 hours, top 10
cd apps/www && pnpm with-env npx sentry issue list -t 24h -n 10

# JSON with selected fields
cd apps/app && pnpm with-env npx sentry issue list --json --fields shortId,title,count,lastSeen
```

---

## `sentry issue view`

View details of a specific issue including stack trace.

```bash
sentry issue view <issue>
```

### Flags

| Flag | Short | Default | Description |
| ---- | ----- | ------- | ----------- |
| `--web` | `-w` | — | Open in browser |
| `--spans` | — | `3` | Span tree depth (`number`, `all`, `no`) |
| `--fresh` | `-f` | — | Bypass cache, fetch fresh data |
| `--json` | — | — | Output as JSON |
| `--fields` | — | — | Fields for JSON output |

### Examples

```bash
# View issue details
cd apps/app && pnpm with-env npx sentry issue view LIGHTFAST-APP-4T

# Open in browser
cd apps/platform && pnpm with-env npx sentry issue view LIGHTFAST-PLATFORM-1 -w

# Full span tree
cd apps/app && pnpm with-env npx sentry issue view LIGHTFAST-APP-4T --spans all
```

---

## `sentry issue explain`

Analyze an issue's root cause using Seer AI.

```bash
sentry issue explain <issue>
```

### Flags

| Flag | Short | Default | Description |
| ---- | ----- | ------- | ----------- |
| `--force` | — | — | Force new analysis even if one exists |
| `--fresh` | `-f` | — | Bypass cache, fetch fresh data |
| `--json` | — | — | Output as JSON |
| `--fields` | — | — | Fields for JSON output |

### Examples

```bash
# Explain root cause
cd apps/app && pnpm with-env npx sentry issue explain LIGHTFAST-APP-4T

# Force re-analysis
cd apps/platform && pnpm with-env npx sentry issue explain LIGHTFAST-PLATFORM-1 --force
```

---

## `sentry issue plan`

Generate a solution plan using Seer AI.

```bash
sentry issue plan <issue>
```

### Flags

| Flag | Short | Default | Description |
| ---- | ----- | ------- | ----------- |
| `--cause` | — | — | Root cause ID (required if multiple causes) |
| `--force` | — | — | Force new plan even if one exists |
| `--fresh` | `-f` | — | Bypass cache, fetch fresh data |
| `--json` | — | — | Output as JSON |
| `--fields` | — | — | Fields for JSON output |

### Examples

```bash
# Generate solution plan
cd apps/app && pnpm with-env npx sentry issue plan LIGHTFAST-APP-4T

# Force new plan
cd apps/app && pnpm with-env npx sentry issue plan LIGHTFAST-APP-4T --force

# Plan for specific root cause
cd apps/app && pnpm with-env npx sentry issue plan LIGHTFAST-APP-4T --cause 12345
```
