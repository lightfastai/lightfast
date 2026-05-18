---
name: lightfast-inngest
description: |
  Inspect Inngest function runs, debug failures, send events, and invoke functions via the
  local Inngest dev server MCP. Triggers when the user asks about background jobs, workflow
  runs, failed steps, event delivery, or wants to invoke/test Inngest functions.
---

# Inngest Dev Server Skill

Interact with the local Inngest dev server (localhost:8288) through its built-in MCP tools.

## Tools

Six MCP tools are available via the `inngest` MCP server:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `list_functions` | List all registered functions with triggers | See what functions exist, check registrations |
| `send_event` | Send a named event with data payload | Trigger functions via events, test event delivery |
| `invoke_function` | Execute a function by ID and wait for result | Test a specific function directly |
| `get_run_status` | Get step-by-step execution details for a run | Debug a failed run, inspect step outputs/errors |
| `poll_run_status` | Monitor multiple runs until completion | Wait for runs triggered by send_event |
| `grep_docs` | Search Inngest documentation by regex | Look up API patterns or configuration |

## Workflow

### Debugging a failure

1. `list_functions` to find the function ID
2. `send_event` or `invoke_function` to reproduce
3. `get_run_status` with the run ID to see step-by-step execution and error stack traces

### Testing a function

1. `list_functions` to find the function ID and its expected trigger event
2. `send_event` with the trigger event name and test payload — returns created run IDs
3. `poll_run_status` with the run IDs to wait for completion
4. `get_run_status` on any failed runs to inspect errors

### Quick Decision Tree

```
What do you need?
|- See registered functions -> list_functions
|- Trigger a function via event -> send_event
|- Execute a function directly -> invoke_function
|- Debug a failed run -> get_run_status (with run ID)
|- Wait for runs to finish -> poll_run_status
|- Look up Inngest docs -> grep_docs
```

## Function ID Format

Functions are identified by slug, e.g. `lightfast-platform-ingest-delivery`. Use `list_functions` to discover exact IDs.

## App Mapping

| App | Inngest App ID | Endpoint |
|-----|---------------|----------|
| `apps/platform` | `lightfast-platform` | `http://localhost:4112/api/inngest` |

## Notes

- The MCP server only works when the dev server is running (`pnpm dev:platform` or `pnpm dev:full`)
- After `send_event`, there is a ~500ms delay before runs appear
- `invoke_function` has a 30s default timeout (overridable per-call)
