---
description: Interact with Inngest dev server — list functions, debug runs, send events, invoke functions. Triggers on "inngest", "background job", "workflow run", "failed run", "send event", "invoke function", "what functions", "debug step", "run status".
---

Use the Inngest MCP tools to help with the user's request.

## Workflow

### Step 1: Load lightfast-inngest skill

```
skill({ name: 'lightfast-inngest' })
```

### Step 2: Determine intent from $ARGUMENTS

- **List functions** ("what functions", "show functions"): Call `list_functions`
- **Debug failure** ("why did X fail", "debug run", "run status"): Call `get_run_status` with the run ID
- **Send event** ("send event", "trigger", "fire event"): Call `send_event` with event name and data
- **Invoke function** ("invoke", "execute", "run function"): Call `invoke_function` with function ID
- **Wait for completion** ("wait for", "poll"): Call `poll_run_status` with run IDs

### Step 3: Follow up

If a run failed, read the error and stack trace. Cross-reference with the codebase to identify the issue.
If an event was sent, use `poll_run_status` to track the resulting runs.

### Step 4: Summarize

Present results with relevant context. For failures, include the error message and point to the relevant source code.

<user-request>
$ARGUMENTS
</user-request>
