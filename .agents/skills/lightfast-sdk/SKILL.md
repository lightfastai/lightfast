---
name: lightfast-sdk
description: |
  Use Lightfast tools to search across team knowledge and interact with connected providers
  (GitHub, Linear, Sentry, Vercel, Apollo). Triggers when the user asks about errors, issues,
  PRs, deployments, or wants to search across their dev tools. Also triggers proactively when
  investigating bugs, reviewing code, or checking deployment status.
---

# Lightfast SDK Skill

Search across your team's knowledge and interact with connected providers through the Lightfast MCP tools.

## Tools

Three MCP tools are available:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `lightfast_search` | Semantic search across all indexed entities | Finding related errors, PRs, issues, context |
| `lightfast_proxy_search` | Discover connections, resources, and actions | First call -- learn what's connected and available |
| `lightfast_proxy_call` | Execute a provider API action | Fetch specific data from a connected provider |

## Workflow

### Step 1: Discover what's available

Always call `lightfast_proxy_search` first if you don't know what connections exist. It returns:
- Connected providers and their connection IDs
- Resources (repos, projects, teams) with pre-computed params you can spread directly into `lightfast_proxy_call`
- Available actions with their required params

### Step 2: Search or act

**Search** -- use `lightfast_search` for cross-provider semantic queries:
- Find errors related to a code change
- Find PRs that touched a specific area
- Find Linear issues about a feature

**Act** -- use `lightfast_proxy_call` to execute specific provider actions:
- Pass the `action` string (e.g. `github.list-pull-requests`) and `params` from the proxy_search response
- If multiple connections exist for the same provider, pass `connection: "conn_<id>"`

### Step 3: Correlate

Combine search results with proxy calls to build context. For example:
1. Search for errors mentioning a function name
2. Proxy call to get the Sentry issue details
3. Proxy call to get the related PR from GitHub

## Quick Decision Tree

```
What do you need?
|- Find something across all tools -> lightfast_search
|- Know what's connected/available -> lightfast_proxy_search
|- Fetch specific data from a provider -> lightfast_proxy_call
|- Investigate a bug
   |- 1. lightfast_search (find related errors/PRs)
   |- 2. lightfast_proxy_call (get issue details via action from proxy_search)
   |- 3. lightfast_proxy_call (find related PRs/deployments)
```

## App-to-Sentry Project Mapping

| App | Sentry Slug |
|-----|-------------|
| `apps/app` | `lightfast-app` |
| `apps/platform` | `lightfast-platform` |
| `apps/www` | `lightfast-www` |
