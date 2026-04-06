---
date: 2026-04-04T12:00:00+08:00
researcher: claude
git_commit: 0b9b0198caebef14d2482e8977a0e95c88373aaf
branch: refactor/drop-workspace-abstraction
repository: lightfast
topic: "Proxy redesign: two-route action-based dispatch with stable connection IDs"
tags: [research, codebase, proxy, schemas, api-contract, mcp, sdk, providers]
status: complete
last_updated: 2026-04-04
---

# Research: Proxy Redesign — Action-Based Dispatch

**Date**: 2026-04-04
**Branch**: refactor/drop-workspace-abstraction

## Decision

Replace the current `proxy.search` + `proxy.execute` (installationId + endpointId) pattern with `proxy.search` + `proxy.call` (stable connection IDs + action strings). Two routes, but fundamentally different payload shape.

### Design Principles

1. **No opaque IDs in the agent's hands** — `installationId` is an internal concept. The agent works with `action` strings and stable `connection` IDs.
2. **Resource discovery via actions, not search** — `proxy.search` returns connections and their available actions. Resource names (repos, projects, teams) come from live action calls, never cached in search.
3. **Flat params** — no `pathParams`/`queryParams`/`body` split. The server routes flat `params` to the right places based on endpoint definition.
4. **Connection ID is the only stable handle** — resource names change (repo renames, org renames). Connection IDs don't.
5. **Tool descriptions are static** — dynamic state comes from `proxy.search` (a live API call), not from MCP tool descriptions which can go stale.

## Architecture

### Request Flow (New)

```
Agent
  → proxy.search
  ← { connections: [{ id, provider, actions }] }

Agent picks action + builds params (discovers resources via actions if needed)

  → proxy.call { action: "github.list-pull-requests", params: { owner, repo }, connection?: "conn_abc" }
  ← { status, data, headers }
```

### Multi-Connection Flow

```
Agent sees 2 GitHub connections from search.

  → proxy.call({ action: "github.list-installation-repos", connection: "conn_abc123" })
  ← { repos: ["acme/api", "acme/web"] }

  → proxy.call({ action: "github.list-installation-repos", connection: "conn_def456" })
  ← { repos: ["jeevan/dotfiles"] }

Agent now knows which connection to use for subsequent calls.
```

### Internal Flow (unchanged)

```
connections.ts procedure
  → createMemoryCaller()     (service JWT, in-process)
  → memory.proxy.execute()   (platform tRPC, no public API)
  → token resolution → fetch → response
```

Internal consumers bypass the public API entirely and continue using `installationId` directly via the platform tRPC caller.

## Schemas

### proxy.search response

```json
{
  "connections": [
    {
      "id": "conn_abc123",
      "provider": "github",
      "actions": [
        { "action": "github.list-pull-requests", "params": ["owner", "repo"], "optional": ["state", "per_page"] },
        { "action": "github.list-installation-repos" },
        { "action": "github.get-file-contents", "params": ["owner", "repo", "path"] }
      ]
    },
    {
      "id": "conn_ghi789",
      "provider": "linear",
      "actions": [
        { "action": "linear.graphql", "params": ["query"], "optional": ["variables"] }
      ]
    }
  ]
}
```

No resource names. No org names. No baseUrls. Just: connection ID, provider, available actions with their param shapes.

### proxy.call request

```typescript
const ProxyCallSchema = z.object({
  action: z.string().describe("Provider action (e.g. github.list-pull-requests)"),
  params: z.record(z.string(), z.unknown()).optional().describe("Action parameters"),
  connection: z.string().optional().describe("Connection ID — required only when multiple connections exist for the same provider"),
});
```

### proxy.call response

```typescript
const ProxyCallResponseSchema = z.object({
  status: z.number().int().describe("HTTP status code from the provider API"),
  data: z.unknown().describe("Response body from the provider API"),
  headers: z.record(z.string(), z.string()).describe("Response headers from the provider API"),
});
```

## Token Budget

```
Current (search + execute):
  System prompt:  ~350 tok (3 tool defs including lightfast_search)
  Search result:  ~800 tok (full catalog with installationIds, baseUrls, paths)
  Execute call:   ~200 tok
  Total:          ~1,350 tok

Proposed (search + call):
  System prompt:  ~200 tok (2 lean tool defs, static descriptions)
  Search result:  ~300 tok (connection IDs + action names + param lists)
  Call:           ~150 tok (action + flat params)
  Total:          ~650 tok
```

Second call in same conversation: current = +1,000 tok (re-reads catalog), proposed = +150 tok.

## Why Two Routes (Not One)

Considered collapsing to a single tool with a dynamic tool description containing the action catalog. Rejected because:

1. **Tool descriptions go stale** — set at MCP `tools/list` time, not all clients re-fetch on `notifications/tools/list_changed`
2. **MCP clients handle descriptions inconsistently** — some truncate, some ignore
3. **Search result is always fresh** — it's a live API call, not cached metadata
4. **Search result lives in conversation context** — model reads it once, compresses mentally, calls search again if context scrolls past. Self-healing.
5. **Action catalog scoped to user's connections** — no noise about providers they haven't connected

## Why Not Other Patterns

| Approach | Rejection reason |
|---|---|
| **One tool per endpoint** | 18 tools today, grows linearly. Token explosion. Agent must hold all schemas. |
| **Cloudflare Code Mode** | 18 endpoints, not 2,594. Codegen errors are a new failure mode for zero benefit at this scale. Revisit at 100+ endpoints. |
| **Semantic vector search** | The LLM consumer IS the semantic router. Adding embedding lookup in the hot path adds latency and a failure mode for zero benefit at 18 endpoints. |
| **Composio / Arcade** | We own the auth layer (platform token vault) and provider definitions. Third-party delegation prevents custom semantics (cross-referencing proxy results with neural graph). |
| **Single semantic tool** | `call(intent: string)` — removes agent's ability to reason about params, retry, or chain. Reliability degrades on multi-step tasks. |

## Server-Side Resolution Logic (proxy.call)

1. Parse `action` → provider name + endpoint ID (split on first `.`)
2. If `connection` provided → validate it belongs to the org and matches the provider
3. If `connection` omitted → query active installations for the provider in the org
   - If 1 → use it
   - If 0 → error: provider not connected
   - If multiple → attempt auto-resolve from `params` context (e.g., which installation has access to `owner/repo`). If still ambiguous → error listing available connection IDs
4. Map flat `params` → path params (from endpoint path template), query params (remainder), body (if POST)
5. Token acquisition, fetch, return

## Files That Need to Change

### Layer 1: Schema Definition
| File | Change |
|---|---|
| `packages/app-validation/src/schemas/api/proxy.ts` | Replace 5 schemas with new: `ProxyActionSchema`, `ProxySearchResponseSchema`, `ProxyCallSchema`, `ProxyCallResponseSchema` |

### Layer 2: Contract
| File | Change |
|---|---|
| `packages/app-api-contract/src/contract.ts` | Replace `proxy.execute` with `proxy.call`, update input/output schemas |
| `packages/app-api-contract/openapi.json` | Regenerated automatically |

### Layer 3: Server Implementation
| File | Change |
|---|---|
| `apps/app/src/lib/proxy.ts` | Rewrite `proxySearchLogic` (lean response with connection IDs + action lists). New `proxyCallLogic` (action parsing, connection resolution, flat param routing → `memory.proxy.execute`) |
| `apps/app/src/app/(api)/lib/orpc-router.ts` | Update handler bindings for new contract shape |

### Layer 4: Internal Consumers
| File | Change |
|---|---|
| `api/app/src/router/org/connections.ts` | **No change** — bypasses public API, calls `memory.proxy.execute` directly |
| `packages/app-providers/src/provider/resource-picker.ts` | **No change** — internal type, uses installationId directly |
| `packages/app-providers/src/provider/api.ts` | **No change** — internal types |

### Layer 5: SDK & MCP
| File | Change |
|---|---|
| `core/lightfast/src/index.ts` | Update re-exports. `LightfastClient` auto-updates from contract. SDK surface becomes `lf.proxy.search()` + `lf.proxy.call({ action, params })` |
| `core/mcp/src/index.ts` | **No change** — `registerContractTools` auto-walks new contract |
| `vendor/mcp/src/index.ts` | **No change** — generic walker |

### Layer 6: Documentation
| File | Change |
|---|---|
| `apps/www/.../code-samples.ts` | Update `OperationId` union, SDK samples for new method signatures |

### Platform Layer (unchanged)
| File | Change |
|---|---|
| `api/platform/src/router/memory/proxy.ts` | **No change** — keeps `installationId`-based interface. The app layer resolves action → installationId before calling platform. |

## Evolution Path

```
Day 1:   Two routes (search + call), 18 actions, server-side connection resolution
Day 30:  Add proxy.batch for parallel fan-out (multiple actions in one call)
Day 90:  If action count > ~50, add category grouping to search response
Day 180: If action count > ~200, consider Code Mode or lazy tool hydration
```

## Provider Endpoint Inventory (current)

| Provider | Endpoints | Count |
|---|---|---|
| GitHub | get-app-installation, list-installation-repos, get-repo, get-file-contents, list-pull-requests, list-issues | 6 |
| Linear | graphql | 1 |
| Sentry | list-projects, list-organizations, list-org-issues, list-events | 4 |
| Vercel | get-team, get-user, list-projects, list-deployments | 4 |
| Apollo | search-people, search-organizations, get-account | 3 |
| **Total** | | **18** |
