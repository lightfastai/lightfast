---
description: Load Lightfast Sentry skill for investigating issues in the dev environment. Use when the user asks to "check sentry", "list issues", "view an error", "explain an issue", "what's failing", "show sentry issues for platform/app/www", or asks about errors in a specific app.
---

Load the Lightfast Sentry skill and help investigate issues across the monorepo.

## Workflow

### Step 1: Load lightfast-sentry skill

```
skill({ name: 'lightfast-sentry' })
```

### Step 2: Identify target app from user request

Analyze $ARGUMENTS to determine:

- **App**: app, platform, or www (if unspecified, ask or check all)
- **Action**: list issues, view issue, explain issue, or plan fix

Use the decision tree in SKILL.md to select the right approach.

### Step 3: Read relevant reference files

Based on action, read from `references/issues/`:

| Action              | Files to Read                    |
| ------------------- | -------------------------------- |
| List/filter issues  | `issues/RULE.md`                 |
| View/explain/plan   | `issues/RULE.md` + `issues/commands.md` |

### Step 4: Execute command

Run the sentry command from the correct app directory:

```bash
cd apps/<app> && pnpm with-env npx sentry <subcommand>
```

**CRITICAL:**
1. Always `cd` to the app directory first
2. Always use `pnpm with-env` to load env vars
3. Use `npx sentry` (not `sentry-cli`)

### Step 5: Summarize

```
=== Sentry Investigation Complete ===

App: <app|platform|www>
Project: <lightfast-app|lightfast-platform|lightfast-www>

<brief summary of findings>
```

<user-request>
$ARGUMENTS
</user-request>
