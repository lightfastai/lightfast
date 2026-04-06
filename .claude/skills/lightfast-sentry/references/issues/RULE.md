# Issue Investigation

Sentry issues represent grouped error events. The CLI provides four operations for working with issues.

## Workflow

The typical investigation flow:

```
sentry issue list          → find the issue
sentry issue view <ID>     → see stack trace and details
sentry issue explain <ID>  → AI root cause analysis (Seer)
sentry issue plan <ID>     → AI solution plan (Seer)
```

## Running Commands

All commands must run from an app directory with `pnpm with-env`:

```bash
cd apps/<app> && pnpm with-env npx sentry issue <subcommand>
```

The CLI auto-detects the project from `SENTRY_ORG` and `SENTRY_PROJECT` in the loaded env.

## Issue IDs

Issues have two ID formats:

- **Short ID**: Human-readable, e.g. `LIGHTFAST-APP-4T` or `LIGHTFAST-PLATFORM-1`
- **Numeric ID**: Internal, e.g. `6273481923`

Both work with `view`, `explain`, and `plan` commands. The short ID is shown in `list` output.

## Filtering Issues

Use Sentry search syntax with the `-q` flag:

```bash
# Unresolved issues only
sentry issue list -q "is:unresolved"

# By error level
sentry issue list -q "level:error"

# By specific error type
sentry issue list -q "TRPCError"

# Assigned to someone
sentry issue list -q "assigned:me"
```

## Sorting

```bash
sentry issue list -s date   # most recently seen (default)
sentry issue list -s new    # newest issues first
sentry issue list -s freq   # most frequent
sentry issue list -s user   # most users affected
```

## Pagination

Default limit is 25. Use `-n` and `-c` for more:

```bash
sentry issue list -n 50        # first 50
sentry issue list -c next      # next page
sentry issue list -c prev      # previous page
```

## JSON Output

For programmatic use or detailed inspection:

```bash
# Full JSON
sentry issue list --json

# Select specific fields
sentry issue list --json --fields shortId,title,count,lastSeen,priority

# View issue as JSON
sentry issue view <ID> --json
```
