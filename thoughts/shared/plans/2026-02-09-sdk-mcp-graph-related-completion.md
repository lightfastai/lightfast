# SDK & MCP: Add Graph and Related Methods

## Overview

Complete the Lightfast SDK (`lightfast`) and MCP server (`@lightfastai/mcp`) by adding the missing `graph()` and `related()` methods/tools. This closes the alignment gap between the v1 API (6 endpoints) and SDK/MCP (currently 3 of 6). The `/v1/answer` endpoint is intentionally excluded (streaming-only, different paradigm).

## Current State Analysis

### What Exists
- **API**: 6 endpoints fully implemented in `apps/console/src/app/(api)/v1/`
- **SDK**: 3 methods (`search`, `contents`, `findSimilar`) - all POST-based
- **MCP**: 3 tools matching SDK methods
- **Types**: Response schemas for graph/related exist in `packages/console-types/src/api/v1/graph.ts`
- **Tests**: SDK tests exist for all 3 current methods in `core/lightfast/src/client.test.ts`

### What's Missing
- SDK `graph()` and `related()` methods
- MCP `lightfast_graph` and `lightfast_related` tools
- Request Zod schemas for graph/related (only response schemas exist)
- POST handlers on graph/related API routes (currently GET-only)
- SDK tests for new methods

### Key Discoveries
- SDK `request()` method hardcodes POST at `core/lightfast/src/client.ts:150`
- Graph API is GET with path param + query params: `GET /v1/graph/{id}?depth=2&types=fixes,deploys`
- Related API is GET with path param only: `GET /v1/related/{id}`
- All existing SDK methods use POST with JSON body - graph/related need to match this pattern
- Graph response schema: `GraphResponseSchema` at `packages/console-types/src/api/v1/graph.ts:40-60`
- Related response schema: `RelatedResponseSchema` at `packages/console-types/src/api/v1/graph.ts:81-98`

## Desired End State

After this plan is complete:
- SDK exposes 5 methods: `search()`, `contents()`, `findSimilar()`, `graph()`, `related()`
- MCP exposes 5 tools: `lightfast_search`, `lightfast_contents`, `lightfast_find_similar`, `lightfast_graph`, `lightfast_related`
- All 5 use POST with JSON body for consistency
- Graph/related API routes accept both GET and POST
- Full test coverage for new methods
- Types re-exported for SDK consumers

### Verification:
- `pnpm --filter lightfast test` passes with graph/related tests
- `pnpm --filter lightfast build` succeeds
- `pnpm --filter @lightfastai/mcp build` succeeds
- `pnpm typecheck` passes

## What We're NOT Doing

- `/v1/answer` endpoint (streaming-only, requires different SDK architecture)
- ~~Changing the existing GET handlers (backward compatible - adding POST alongside)~~ **Changed: Removed GET handlers for consistency**
- Publishing to npm (separate changeset flow)
- Adding MCP tests (no existing test infrastructure in `core/mcp/`)

## Implementation Approach

Bottom-up: types/schemas first, then API POST handlers, then SDK methods, then MCP tools, then tests.

---

## Phase 1: Add Request Schemas to console-types

### Overview
Create Zod request schemas for graph and related endpoints so SDK and MCP can validate input.

### Changes Required:

#### 1. Add request schemas to graph.ts
**File**: `packages/console-types/src/api/v1/graph.ts`
**Changes**: Add `V1GraphRequestSchema` and `V1RelatedRequestSchema` before existing response schemas.

```typescript
/**
 * Graph API request
 */
export const V1GraphRequestSchema = z.object({
  id: z.string().describe("Observation ID to start graph traversal from"),
  depth: z.number().int().min(1).max(3).default(2).describe("Traversal depth (1-3)"),
  types: z.array(z.string()).optional().describe("Filter by relationship types"),
});

export type V1GraphRequest = z.infer<typeof V1GraphRequestSchema>;

/**
 * Related events API request
 */
export const V1RelatedRequestSchema = z.object({
  id: z.string().describe("Observation ID to find related events for"),
});

export type V1RelatedRequest = z.infer<typeof V1RelatedRequestSchema>;
```

These are already re-exported via `packages/console-types/src/api/v1/index.ts:8` (`export * from "./graph"`).

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] New types are accessible: `import { V1GraphRequestSchema, V1RelatedRequestSchema } from "@repo/console-types/api"`

---

## Phase 2: Add POST Handlers to API Routes (POST-only, GET removed)

### Overview
Add POST handlers to graph and related API routes so the SDK can call them with JSON body (consistent with search/contents/findSimilar). **Removed existing GET handlers** to simplify the API surface - all v1 endpoints now use POST with JSON body.

### Changes Required:

#### 1. Add POST handler to graph route
**File**: `apps/console/src/app/(api)/v1/graph/[id]/route.ts`
**Changes**: Add `POST` export that reads `id` from request body instead of URL params, plus `depth` and `types` from body.

```typescript
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();

  log.info("v1/graph POST request", { requestId });

  try {
    const body = await request.json();
    const observationId = body.id;
    if (!observationId) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "'id' is required", requestId },
        { status: 400 }
      );
    }
    const depth = Math.min(body.depth ?? 2, 3);
    const allowedTypes = body.types ?? null;

    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId } = authResult.auth;

    const result = await graphLogic(
      { workspaceId, userId: authResult.auth.userId, authType: authResult.auth.authType },
      { observationId, depth, allowedTypes, requestId }
    );

    log.info("v1/graph POST complete", {
      requestId,
      nodeCount: result.data.nodes.length,
      edgeCount: result.data.edges.length,
      depth,
      took: Date.now() - startTime,
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error("v1/graph POST error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Graph traversal failed",
        requestId,
      },
      { status: 500 }
    );
  }
}
```

**Note**: The POST handler goes in the existing `graph/[id]/route.ts` file but the `[id]` param is ignored for POST - the `id` comes from the JSON body instead. This is consistent with how search/contents/findSimilar work. Actually, since POST doesn't use the URL param, this route file needs to stay where it is for the GET handler, but we should add a new route file for POST at the `/v1/graph/` level (without `[id]`).

**Correction**: We need a new route file at `apps/console/src/app/(api)/v1/graph/route.ts` for the POST handler (no `[id]` in path since id comes from body).

#### 2. Create POST route for graph
**File**: `apps/console/src/app/(api)/v1/graph/route.ts` (NEW)
**Changes**: POST handler that reads all params from JSON body.

#### 3. Create POST route for related
**File**: `apps/console/src/app/(api)/v1/related/route.ts` (NEW)
**Changes**: POST handler that reads `id` from JSON body.

```typescript
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();

  log.info("v1/related POST request", { requestId });

  try {
    const body = await request.json();
    const observationId = body.id;
    if (!observationId) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "'id' is required", requestId },
        { status: 400 }
      );
    }

    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId } = authResult.auth;

    const result = await relatedLogic(
      { workspaceId, userId: authResult.auth.userId, authType: authResult.auth.authType },
      { observationId, requestId }
    );

    log.info("v1/related POST complete", {
      requestId,
      total: result.data.related.length,
      took: Date.now() - startTime,
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error("v1/related POST error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Related lookup failed",
        requestId,
      },
      { status: 500 }
    );
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [ ] `pnpm build:console` succeeds

#### Manual Verification:
- [x] POST `/v1/graph` with `{"id": "obs_xxx", "depth": 2}` returns graph response
- [x] POST `/v1/related` with `{"id": "obs_xxx"}` returns related response
- [x] ~~Existing GET `/v1/graph/{id}` still works unchanged~~ **Removed - POST-only now**

---

## Phase 3: Add SDK Methods

### Overview
Add `graph()` and `related()` methods to the Lightfast SDK client, along with types.

### Changes Required:

#### 1. Add type re-exports and SDK input types
**File**: `core/lightfast/src/types.ts`
**Changes**:
- Add graph/related type re-exports from `@repo/console-types`
- Add `GraphInput` and `RelatedInput` SDK input types
- Import `V1GraphRequest` for the input type transformation

Add to the re-export block (after line 22):
```typescript
  // Graph types
  V1GraphRequest,
  GraphResponse,
  GraphNode,
  GraphEdge,
  // Related types
  V1RelatedRequest,
  RelatedResponse,
  RelatedEvent,
```

Add to imports (after line 28):
```typescript
  V1GraphRequest,
```

Add after `FindSimilarInput` (after line 62):
```typescript
/**
 * SDK input type for graph requests.
 * Makes depth optional (defaults to 2).
 */
export type GraphInput = Omit<V1GraphRequest, "depth"> &
  Partial<Pick<V1GraphRequest, "depth">>;

/**
 * SDK input type for related requests.
 * Matches V1RelatedRequest (no defaults to make optional).
 */
export type RelatedInput = V1RelatedRequest;
```

#### 2. Add methods to client
**File**: `core/lightfast/src/client.ts`
**Changes**:
- Import new types: `GraphInput`, `RelatedInput`, `GraphResponse`, `RelatedResponse`
- Add `graph()` method after `findSimilar()` (after line 138)
- Add `related()` method after `graph()`

```typescript
  /**
   * Traverse the relationship graph from a starting observation
   *
   * @param request - Graph traversal parameters
   * @returns Graph nodes, edges, and metadata
   *
   * @example
   * ```typescript
   * const graph = await lightfast.graph({
   *   id: "obs_abc123",
   *   depth: 2,
   *   types: ["fixes", "deploys"],
   * });
   * ```
   */
  async graph(request: GraphInput): Promise<GraphResponse> {
    return this.request<GraphResponse>("/v1/graph", {
      id: request.id,
      depth: request.depth ?? 2,
      types: request.types,
    });
  }

  /**
   * Find observations directly connected via relationships
   *
   * @param request - Source observation ID
   * @returns Related observations grouped by source
   *
   * @example
   * ```typescript
   * const related = await lightfast.related({
   *   id: "obs_abc123",
   * });
   * ```
   */
  async related(request: RelatedInput): Promise<RelatedResponse> {
    return this.request<RelatedResponse>("/v1/related", {
      id: request.id,
    });
  }
```

#### 3. Update index.ts exports
**File**: `core/lightfast/src/index.ts`
**Changes**: Add new types to the export list.

Add to the types export block (after line 26):
```typescript
  GraphInput,
  RelatedInput,
```

Add to the V1 API types section (after line 42):
```typescript
  // Graph types
  V1GraphRequest,
  GraphResponse,
  GraphNode,
  GraphEdge,
  // Related types
  V1RelatedRequest,
  RelatedResponse,
  RelatedEvent,
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter lightfast build` succeeds
- [x] `pnpm typecheck` passes
- [x] Types are importable: `import { GraphInput, GraphResponse } from "lightfast"`

---

## Phase 4: Add MCP Tools

### Overview
Register `lightfast_graph` and `lightfast_related` tools in the MCP server.

### Changes Required:

#### 1. Add tool registrations to server.ts
**File**: `core/mcp/src/server.ts`
**Changes**:
- Import `V1GraphRequestSchema` and `V1RelatedRequestSchema` from `@repo/console-types/api`
- Register two new tools after the `lightfast_find_similar` tool (after line 74)

Add to imports (line 4-8):
```typescript
import {
  V1SearchRequestSchema,
  V1ContentsRequestSchema,
  V1FindSimilarRequestSchema,
  V1GraphRequestSchema,
  V1RelatedRequestSchema,
} from "@repo/console-types/api";
```

Add tool registrations after line 74:
```typescript
  // Register graph tool
  server.tool(
    "lightfast_graph",
    "Traverse the relationship graph from a starting observation. Returns connected observations with relationship edges. Supports depth control (1-3) and relationship type filtering.",
    V1GraphRequestSchema.shape,
    async (args) => {
      const results = await lightfast.graph(args);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // Register related tool
  server.tool(
    "lightfast_related",
    "Find observations directly connected to a given observation via relationships. Returns related events grouped by source system with relationship types and directions.",
    V1RelatedRequestSchema.shape,
    async (args) => {
      const results = await lightfast.related(args);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @lightfastai/mcp build` succeeds
- [x] `pnpm typecheck` passes

---

## Phase 5: Add SDK Tests

### Overview
Add tests for `graph()` and `related()` methods following the existing test patterns.

### Changes Required:

#### 1. Add test cases to client.test.ts
**File**: `core/lightfast/src/client.test.ts`
**Changes**: Add `describe("graph")` and `describe("related")` blocks following the pattern of existing tests.

Add after the `findSimilar` describe block (after line 157):

```typescript
  describe("graph", () => {
    it("should call /v1/graph with correct parameters", async () => {
      const mockResponse = {
        data: {
          root: { id: "obs_123", title: "Test", source: "github", type: "issue" },
          nodes: [],
          edges: [],
        },
        meta: { depth: 2, nodeCount: 1, edgeCount: 0, took: 50 },
        requestId: "req_123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      const result = await memory.graph({ id: "obs_123" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://lightfast.ai/v1/graph",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"id":"obs_123"'),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it("should apply default depth", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { root: {}, nodes: [], edges: [] } }),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      await memory.graph({ id: "obs_123" });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.depth).toBe(2);
    });

    it("should pass custom depth and types", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { root: {}, nodes: [], edges: [] } }),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      await memory.graph({ id: "obs_123", depth: 3, types: ["fixes", "deploys"] });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        id: "obs_123",
        depth: 3,
        types: ["fixes", "deploys"],
      });
    });
  });

  describe("related", () => {
    it("should call /v1/related with correct parameters", async () => {
      const mockResponse = {
        data: {
          source: { id: "obs_123", title: "Test", source: "github" },
          related: [],
          bySource: {},
        },
        meta: { total: 0, took: 30 },
        requestId: "req_123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      const result = await memory.related({ id: "obs_123" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://lightfast.ai/v1/related",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ id: "obs_123" }),
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter lightfast test` passes (all tests including new ones)

---

## Testing Strategy

### Unit Tests:
- Graph method calls correct endpoint with defaults
- Graph method passes custom depth and types
- Related method calls correct endpoint
- Error handling works for both methods (covered by existing error tests since they use same `request()` method)

### Manual Testing Steps:
1. Build SDK: `pnpm --filter lightfast build`
2. Build MCP: `pnpm --filter @lightfastai/mcp build`
3. Start dev server: `pnpm dev:console`
4. Test graph POST endpoint with curl
5. Test related POST endpoint with curl

## References

- Research: `thoughts/shared/research/2026-02-09-lightfast-api-sdk-mcp-release-readiness.md`
- SDK client: `core/lightfast/src/client.ts`
- MCP server: `core/mcp/src/server.ts`
- Graph types: `packages/console-types/src/api/v1/graph.ts`
- Graph API route: `apps/console/src/app/(api)/v1/graph/[id]/route.ts`
- Related API route: `apps/console/src/app/(api)/v1/related/[id]/route.ts`
