---
description: General Lightfast debugging entrypoint. Triggers on "debug", "investigate", "trace", "reproduce", "diagnose", "why is this failing", "what broke", or any issue where the failing surface is unclear or may cross browser, runtime, Inngest, DB, provider, or observability boundaries. Prefer narrower direct skills for explicit DB, Inngest, or provider-only requests.
---

Use the Lightfast debug skill to choose the right investigation block and drive the next tool calls.

## Workflow

### Step 1: Load lightfast-debug

```text
skill({ name: 'lightfast-debug' })
```

### Step 2: Pick the primary debug block from $ARGUMENTS

- **Browser**: user repro, UI behavior, auth flow, navigation, client request failure
- **Runtime**: direct HTTP/API behavior, middleware, rewrites, local app/platform execution
- **Inngest**: workflows, runs, retries, backfills, step failures
- **DB**: persisted rows, joins, state transitions, ground truth
- **SDK**: connected providers, remote-system truth, proxy actions
- **Observability**: logs, traces, errors, request/run timelines

### Step 3: Read only the relevant references

Start with one primary block. Read additional block references only when the evidence crosses
that boundary.

### Step 4: Investigate with an evidence chain

Keep the chain explicit:

- repro or entrypoint
- failing request, run, or provider action
- persisted state
- upstream or downstream confirmation

### Step 5: Summarize by block

Report:

- primary block used
- secondary blocks used
- entrypoint or repro
- failing boundary
- truth source / strongest evidence found
- next decisive check if the issue is not yet resolved

Use the same evidence-chain fields in any handoff or resume summary:
`primary block`, `secondary blocks`, `entrypoint or repro`, `failing boundary`,
`truth source`, and `next decisive check`.

<user-request>
$ARGUMENTS
</user-request>
