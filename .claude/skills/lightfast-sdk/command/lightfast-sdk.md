---
description: Use Lightfast tools to search across team knowledge and interact with connected providers. Triggers on "search for", "find issues", "check sentry", "list PRs", "check deployments", "what's failing", "show errors", or any request to look up data from GitHub, Linear, Sentry, Vercel, or Apollo.
---

Use the Lightfast MCP tools to help with the user's request.

## Workflow

### Step 1: Load lightfast-sdk skill

```
skill({ name: 'lightfast-sdk' })
```

### Step 2: Discover available connections

Call `lightfast_proxy_search` to learn what providers are connected and what actions are available. Use the returned resources and action catalog to inform your next calls.

### Step 3: Execute based on intent

Analyze $ARGUMENTS and use the decision tree in SKILL.md:

- **Search intent** ("find", "search", "what's related to"): Use `lightfast_search` with appropriate filters
- **Discovery intent** ("what's connected", "what can I do"): Present the `lightfast_proxy_search` results
- **Action intent** ("list PRs", "check sentry", "show deployments"): Use `lightfast_proxy_call` with the action and params from Step 2
- **Investigation intent** ("what's failing", "debug this error"): Chain `lightfast_search` -> `lightfast_proxy_call` to correlate across providers

### Step 4: Summarize

Present results clearly with relevant context and suggested next steps.

<user-request>
$ARGUMENTS
</user-request>
