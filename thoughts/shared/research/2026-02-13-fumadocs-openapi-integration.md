---
date: 2026-02-13T02:31:05Z
researcher: Claude Code
git_commit: eff780375a405f6a74cc638ecb6de6cb2b668765
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "fumadocs-openapi integration: streamlining SDK and MCP documentation"
tags: [research, codebase, fumadocs-openapi, documentation, openapi, sdk, mcp]
status: complete
last_updated: 2026-02-13
last_updated_by: Claude Code
---

# Research: fumadocs-openapi Integration Analysis

**Date**: 2026-02-13T02:31:05Z
**Researcher**: Claude Code
**Git Commit**: eff780375a405f6a74cc638ecb6de6cb2b668765
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast-search-perf-improvements

## Research Question

How does fumadocs-openapi's `createAPIPage` and `generateCodeSamples` work, and how can it be integrated with existing TypeScript SDK (`apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx`) and MCP (`apps/docs/src/content/docs/integrate/mcp.mdx`) documentation to streamline and reduce the number of custom components?

## Summary

The codebase already has fumadocs-openapi infrastructure in place but uses custom `ParamTable` and `ResponseSchema` components for manually documenting SDK and MCP APIs. fumadocs-openapi provides built-in schema rendering, automatic API page generation, and a `generateCodeSamples` callback system that can replace most custom components. The current setup has:

1. **OpenAPI generation pipeline**: Zod schemas → OpenAPI spec → documentation
2. **Custom components**: `ParamTable` and `ResponseSchema` reading from OpenAPI spec
3. **fumadocs-openapi foundation**: `createOpenAPI`, `openapiSource`, and `createAPIPage` configured
4. **Manual MDX documentation**: TypeScript SDK and MCP docs written by hand with component usage

**Key opportunity**: Leverage fumadocs-openapi's automatic page generation and code sample injection to eliminate custom components and reduce manual documentation maintenance.

## Detailed Findings

### 1. Current fumadocs-openapi Setup

**OpenAPI Configuration** (`apps/docs/src/lib/openapi.ts:1-10`):
```typescript
import { createOpenAPI } from "fumadocs-openapi/server";
import spec from "@repo/console-openapi";

export const openapi = createOpenAPI({
  input: [spec as never],
});
```
- Uses generated OpenAPI spec from `@repo/console-openapi` package
- Single source of truth: `packages/console-openapi/openapi.json` (2270 lines)
- Generated from Zod schemas in `packages/console-types/src/api/v1/`

**Source Integration** (`apps/docs/src/lib/source.ts:1-19`):
```typescript
import { openapiSource } from "fumadocs-openapi/server";
import { openapi } from "./openapi";

export const source = loader(
  multiple({
    docs: docs.toFumadocsSource(),
    openapi: await openapiSource(openapi, {
      groupBy: "tag",
      baseDir: "openapi",
    }),
  }),
  {
    baseUrl: "/docs",
    plugins: [openapiPlugin()],
  }
);
```
- Virtual file generation at runtime
- Groups API pages by OpenAPI tags
- Integrates with fumadocs page tree via `openapiPlugin()`

**API Page Component** (`apps/docs/src/lib/api-page.tsx:9-61`):
```typescript
import { createAPIPage } from "fumadocs-openapi/ui";

export const APIPage = createAPIPage(openapi, {
  generateCodeSamples(endpoint) {
    // Currently returns empty array - no code samples
    return [];
  },
  schemaUI: {
    showExample: true,
  },
  playground: {
    enabled: true,
  },
});
```
- Core fumadocs-openapi component configured
- `generateCodeSamples` callback exists but unused
- Built-in playground enabled for API testing

### 2. Current Custom Components

**ParamTable Component** (`apps/docs/src/components/schema/param-table.tsx:14-66`):

**Props**:
- `schema: string` - OpenAPI schema name (e.g., "V1SearchRequest")
- `include?: string[]` - Whitelist specific fields
- `exclude?: string[]` - Blacklist specific fields
- `showDefaults?: boolean` - Show "Default" column (default: true)

**Implementation**:
- Calls `getSchemaFields(schema)` to fetch from OpenAPI spec
- Filters fields using include/exclude arrays
- Renders HTML `<table>` with Property, Type, Required, Default, Description columns
- Custom styling: `bg-card`, `border`, `rounded-xs`, `hover:bg-muted/30`

**ResponseSchema Component** (`apps/docs/src/components/schema/response-schema.tsx:13-27`):

**Props**:
- `schema: string` - OpenAPI schema name
- `name?: string` - Override interface name
- `depth?: number` - Max nesting depth (default: 2)

**Implementation**:
- Async component using `getSchemaFields(schema)`
- Generates TypeScript interface string via `renderInterface()`
- Renders with `SSRCodeBlock` component for syntax highlighting
- Supports one level of nested object expansion

**Schema Reader** (`apps/docs/src/lib/schema-reader.ts:42-53`):
```typescript
export function getSchemaFields(schemaName: string): SchemaField[] {
  const schemas = openApiSpec.components?.schemas;
  const schema = schemas?.[schemaName];

  if (!schema) {
    throw new Error(`Schema "${schemaName}" not found`);
  }

  return parseSchemaProperties(schema);
}
```
- Single source reading from `packages/console-openapi/openapi.json`
- Parses OpenAPI properties into simplified `SchemaField` format
- Handles primitives, enums, arrays, nested objects, unions, nullables
- Extracts constraints (min, max, length) and descriptions

**MDX Registration** (`apps/docs/mdx-components.tsx:418-420`):
```tsx
export const mdxComponents = {
  // ...
  ParamTable,
  ResponseSchema,
  EnumValues,
  // ...
};
```

### 3. Current Documentation Usage

**TypeScript SDK Docs** (`apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx`):

10 schemas documented across 5 methods:
- `search()`: ParamTable for `V1SearchRequest`, ResponseSchema for `V1SearchResponse`
- `contents()`: ParamTable for `V1ContentsRequest`, ResponseSchema for `V1ContentsResponse`
- `findSimilar()`: ParamTable for `V1FindSimilarRequest`, ResponseSchema for `V1FindSimilarResponse`
- `graph()`: ParamTable for `V1GraphRequest`, ResponseSchema for `GraphResponse`
- `related()`: ParamTable for `V1RelatedRequest`, ResponseSchema for `RelatedResponse`

**Pattern**:
```mdx
### search()

Search through workspace memory for relevant documents and observations.

```typescript
const response = await client.search(input: SearchInput): Promise<V1SearchResponse>
```

#### SearchInput

<ParamTable schema="V1SearchRequest" />

#### V1SearchResponse

<ResponseSchema schema="V1SearchResponse" />

#### Example

```typescript
const results = await client.search({
  query: "authentication implementation",
  limit: 10,
  mode: "balanced",
});
```
```

**MCP Server Docs** (`apps/docs/src/content/docs/integrate/mcp.mdx`):

3 tools documented:
- `lightfast_search`: ParamTable + ResponseSchema
- `lightfast_contents`: ParamTable + ResponseSchema
- `lightfast_find_similar`: ParamTable + ResponseSchema

**Pattern**:
```mdx
### lightfast_search

Search through workspace memory for relevant documents and observations.

**Parameters:**

<ParamTable schema="V1SearchRequest" />

**Example prompt:**
> "Search lightfast for how authentication works in our API"
```

**Issues with current approach**:
1. Manual duplication of schema documentation across SDK and MCP docs
2. Custom components reimplementing what fumadocs-openapi provides
3. No code samples showing SDK usage patterns
4. Manual maintenance when schemas change
5. Separate documentation for same underlying API operations

### 4. fumadocs-openapi Built-in Capabilities

**Schema Rendering** (`packages/openapi/src/ui/schema/index.tsx`):

Built-in `<Schema>` component provides:
- Recursive schema rendering (objects, arrays, unions)
- Type information display
- Required/optional indicators
- Read-only/write-only flags
- Nested property expansion
- Validation constraints (min/max, pattern, enum)
- Examples (if `schemaUI.showExample: true`)

**Replaces**: Custom `ParamTable` and `ResponseSchema` components

**Code Sample Generation** (`packages/openapi/src/ui/operation/usage-tabs/index.tsx`):

Three methods to add code samples:

**1. Via `generateCodeSamples` callback**:
```typescript
createAPIPage(openapi, {
  generateCodeSamples(endpoint) {
    const { operationId, path, method } = endpoint;

    return [
      {
        id: 'typescript-sdk',
        lang: 'typescript',
        label: 'TypeScript SDK',
        source: generateSDKSample(operationId),
      },
      {
        id: 'mcp',
        lang: 'json',
        label: 'MCP Server',
        source: generateMCPSample(operationId),
      },
    ];
  },
});
```

**2. Via OpenAPI schema (`x-codeSamples`)**:
```yaml
paths:
  /v1/search:
    post:
      operationId: search
      x-codeSamples:
        - lang: typescript
          label: TypeScript SDK
          source: |
            import { Lightfast } from 'lightfast';
            const client = new Lightfast({ apiKey: 'sk-lf-...' });
            const results = await client.search({ query: 'test' });
```

**3. Via dynamic client-side generator**:
```typescript
// Client-side function that generates code based on playground input
export const sdkGenerator: SampleGenerator = (url, data, ctx) => {
  const { method, body } = data;
  return `const result = await client.${operationId}(${JSON.stringify(body, null, 2)});`;
};
```

**Built-in Languages**:
- cURL (bash)
- JavaScript (fetch)
- Python (requests)
- Go (net/http)
- Java (HttpURLConnection)
- C# (HttpClient)

**Page Generation Modes** (`packages/openapi/src/utils/pages/preset-auto.ts`):

| Mode | Description | Output |
|------|-------------|--------|
| `operation` | One page per endpoint+method | `{operationId}.mdx` |
| `tag` | Group operations by OpenAPI tags | `{tag}.mdx` |
| `file` | All operations from one schema | `{filename}.mdx` |
| `custom` | Full control via `toPages(builder)` | User-defined |

**Current setup**: Uses `groupBy: "tag"` in `openapiSource()`

**Customization Points**:

1. **Layout Renderers** - Override page structure:
   - `renderPageLayout` - Entire page wrapper
   - `renderOperationLayout` - Single operation/endpoint
   - `renderAPIExampleLayout` - Code samples section
   - `renderRequestTabs` - Request examples
   - `renderResponseTabs` - Response examples

2. **Schema UI** - Custom schema rendering:
   ```typescript
   schemaUI: {
     render(options, ctx) {
       return <MyCustomSchema {...options} />;
     },
     showExample: true,
   }
   ```

3. **Media Adapters** - Custom request body formats:
   ```typescript
   mediaAdapters: {
     'application/custom': {
       encode(data) { return customSerialize(data.body); },
       generateExample(data, ctx) { return 'code example'; },
     },
   }
   ```

### 5. Schema Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ SOURCE OF TRUTH                                             │
│ packages/console-types/src/api/v1/*.ts                      │
│ - Zod schemas (V1SearchRequest, V1SearchResponse, etc.)    │
└──────────────────┬──────────────────────────────────────────┘
                   │
       ├───────────┼───────────┬───────────────┐
       │           │           │               │
       ▼           ▼           ▼               ▼
┌──────────┐ ┌─────────┐ ┌─────────┐   ┌────────────┐
│ OpenAPI  │ │ SDK     │ │ MCP     │   │ API Routes │
│ packages/│ │ core/   │ │ core/   │   │ apps/      │
│ console- │ │ lightf. │ │ mcp/    │   │ console/   │
│ openapi/ │ │         │ │         │   │ src/app/   │
└────┬─────┘ └─────────┘ └─────────┘   └────────────┘
     │
     │ generates openapi.json
     ▼
┌──────────────────────────────────────────────────┐
│ CURRENT: Manual MDX with Custom Components       │
│ - <ParamTable schema="..." />                    │
│ - <ResponseSchema schema="..." />                │
│ - Manual examples and descriptions               │
└──────────────────────────────────────────────────┘

     vs.

┌──────────────────────────────────────────────────┐
│ POTENTIAL: fumadocs-openapi Auto-Generation      │
│ - Automatic page generation from OpenAPI         │
│ - Built-in schema rendering                      │
│ - generateCodeSamples() injects SDK examples     │
│ - Interactive playground with all languages      │
└──────────────────────────────────────────────────┘
```

### 6. Integration Opportunities

**Opportunity 1: Replace Custom Components with Built-in Schema Rendering**

Current fumadocs-openapi provides built-in `<Schema>` component that replaces both `ParamTable` and `ResponseSchema`. The library automatically renders:
- Parameter tables with types, required flags, defaults
- Response schemas with nested object expansion
- Interactive examples
- Validation constraints

**Migration path**:
1. Use fumadocs-openapi's automatic API page generation instead of manual MDX
2. Remove custom `ParamTable` and `ResponseSchema` components
3. Leverage built-in schema rendering via `createAPIPage`

**Opportunity 2: Inject SDK Examples via generateCodeSamples**

Current `generateCodeSamples` callback returns empty array. Can inject TypeScript SDK examples:

```typescript
// apps/docs/src/lib/api-page.tsx
createAPIPage(openapi, {
  generateCodeSamples(endpoint) {
    const { operationId } = endpoint;

    // Map OpenAPI operation IDs to SDK methods
    const sdkExamples = {
      search: `import { Lightfast } from 'lightfast';

const client = new Lightfast({ apiKey: 'sk-lf-...' });

const results = await client.search({
  query: "authentication implementation",
  limit: 10,
  mode: "balanced",
});

console.log(results.data);`,

      contents: `import { Lightfast } from 'lightfast';

const client = new Lightfast({ apiKey: 'sk-lf-...' });

const contents = await client.contents({
  ids: ["obs_abc123", "doc_def456"],
});

console.log(contents.items);`,

      findSimilar: `import { Lightfast } from 'lightfast';

const client = new Lightfast({ apiKey: 'sk-lf-...' });

const similar = await client.findSimilar({
  url: "https://github.com/org/repo/pull/123",
  limit: 5,
});

console.log(similar.similar);`,

      graph: `import { Lightfast } from 'lightfast';

const client = new Lightfast({ apiKey: 'sk-lf-...' });

const graph = await client.graph({
  id: "obs_abc123",
  depth: 2,
});

console.log(graph.data.nodes);`,

      related: `import { Lightfast } from 'lightfast';

const client = new Lightfast({ apiKey: 'sk-lf-...' });

const related = await client.related({
  id: "obs_abc123",
});

console.log(related.data.related);`,
    };

    return [
      {
        id: 'typescript-sdk',
        lang: 'typescript',
        label: 'TypeScript SDK',
        source: sdkExamples[operationId] || `// SDK method: client.${operationId}()`,
      },
      {
        id: 'curl',
        lang: 'bash',
        // Keep default cURL generation
      },
    ];
  },
});
```

**Opportunity 3: Add MCP Examples via x-codeSamples**

Extend OpenAPI schema generation to include MCP examples:

```typescript
// packages/console-openapi/src/registry.ts
registry.registerPath({
  method: 'post',
  path: '/v1/search',
  request: {
    body: {
      content: {
        'application/json': {
          schema: V1SearchRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Search results',
      content: {
        'application/json': {
          schema: V1SearchResponseSchema,
        },
      },
    },
  },
  // Add MCP code samples
  'x-codeSamples': [
    {
      lang: 'json',
      label: 'MCP Tool Call',
      source: `{
  "name": "lightfast_search",
  "arguments": {
    "query": "how does authentication work",
    "limit": 5,
    "mode": "thorough"
  }
}`,
    },
  ],
});
```

**Opportunity 4: Consolidate SDK and MCP Docs**

Instead of separate SDK and MCP documentation pages, use fumadocs-openapi's auto-generated API reference with both SDK and MCP code samples. Single source of truth for each operation.

**Before**:
- `/docs/api/sdks-tools/typescript-sdk` - Manual MDX with SDK examples
- `/docs/integrate/mcp` - Manual MDX with MCP examples
- `/docs/api-reference/*` - fumadocs-openapi pages (currently empty)

**After**:
- `/docs/api-reference/search` - Auto-generated with SDK + MCP examples
- `/docs/api-reference/contents` - Auto-generated with SDK + MCP examples
- `/docs/api-reference/find-similar` - Auto-generated with SDK + MCP examples
- Keep SDK and MCP pages as high-level guides linking to API reference

**Opportunity 5: Dynamic Code Generation**

Use client-side generator for interactive code samples that update based on playground input:

```typescript
// apps/docs/src/lib/code-generators.ts
'use client';

export const sdkGenerator: SampleGenerator = (url, data, ctx) => {
  const { operationId } = ctx.endpoint;
  const body = data.body ? JSON.stringify(data.body, null, 2) : '{}';

  return `import { Lightfast } from 'lightfast';

const client = new Lightfast({ apiKey: 'sk-lf-...' });

const result = await client.${operationId}(${body});

console.log(result);`;
};
```

## Code References

### fumadocs-openapi Configuration
- `apps/docs/src/lib/openapi.ts:1-10` - OpenAPI server factory
- `apps/docs/src/lib/source.ts:1-19` - Source integration with openapiPlugin
- `apps/docs/src/lib/api-page.tsx:9-61` - createAPIPage component factory
- `apps/docs/src/lib/api-page-renderers.tsx:1-end` - Custom layout renderers

### Custom Components (Candidates for Removal)
- `apps/docs/src/components/schema/param-table.tsx:14-66` - ParamTable component
- `apps/docs/src/components/schema/response-schema.tsx:13-27` - ResponseSchema component
- `apps/docs/src/components/schema/enum-values.tsx:9-27` - EnumValues component
- `apps/docs/src/lib/schema-reader.ts:42-165` - Schema parsing utilities
- `apps/docs/mdx-components.tsx:418-420` - Component registration

### Manual Documentation (Candidates for Auto-Generation)
- `apps/docs/src/content/api/sdks-tools/typescript-sdk.mdx:1-261` - TypeScript SDK reference
- `apps/docs/src/content/api/sdks-tools/mcp-server.mdx:1-230` - MCP server reference

### OpenAPI Source
- `packages/console-openapi/openapi.json:1-2270` - Generated OpenAPI specification
- `packages/console-openapi/src/registry.ts:1-249` - OpenAPI registry with endpoint definitions
- `packages/console-types/src/api/v1/search.ts:1-250` - Zod schema definitions

### API Reference Pages
- `apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx:1-end` - Dynamic OpenAPI page route

## Architecture Documentation

### Current Setup

1. **Zod schemas** in `packages/console-types/src/api/v1/`
2. **OpenAPI generation** via `@asteasolutions/zod-to-openapi` in `packages/console-openapi`
3. **fumadocs-openapi infrastructure** configured but underutilized
4. **Custom components** reimplementing fumadocs-openapi functionality
5. **Manual MDX documentation** duplicating schema information

### Recommended Architecture

1. **Single source**: Zod schemas generate OpenAPI spec
2. **Automatic pages**: fumadocs-openapi generates API reference from OpenAPI
3. **Code injection**: `generateCodeSamples` adds SDK and MCP examples
4. **No custom components**: Use built-in schema rendering
5. **Consolidated docs**: API reference pages serve as canonical documentation

### Migration Strategy

**Phase 1: Enable SDK Code Samples**
- Implement `generateCodeSamples` callback with TypeScript SDK examples
- Test on existing auto-generated API reference pages
- Verify code samples appear in tabs

**Phase 2: Add MCP Examples**
- Add `x-codeSamples` to OpenAPI registry
- Include MCP tool call JSON examples
- Regenerate OpenAPI spec

**Phase 3: Validate Auto-Generated Pages**
- Review `/docs/api-reference/*` pages
- Ensure schema rendering matches custom components
- Verify all operations have correct examples

**Phase 4: Update SDK Documentation**
- Convert `typescript-sdk.mdx` to high-level guide
- Link to API reference for detailed schemas
- Remove `<ParamTable>` and `<ResponseSchema>` usage

**Phase 5: Update MCP Documentation**
- Convert `mcp.mdx` to integration guide
- Link to API reference for tool parameters
- Remove duplicate schema documentation

**Phase 6: Remove Custom Components**
- Delete `apps/docs/src/components/schema/` directory
- Remove from `mdx-components.tsx` registration
- Delete `apps/docs/src/lib/schema-reader.ts`

## Historical Context

No prior research documents found on fumadocs-openapi integration or documentation architecture.

## Related Research

None found in `thoughts/shared/research/`.

## Open Questions

1. **Page organization**: Should SDK and MCP docs remain separate guides, or merge into API reference?
2. **Code sample storage**: Store SDK examples in code vs. in OpenAPI schema (`x-codeSamples`)?
3. **Interactive playground**: Should MCP examples be interactive or static JSON?
4. **Migration timing**: Migrate all at once or incrementally per endpoint?
5. **Custom styling**: Are custom component styles (borders, colors) required or can use fumadocs defaults?
6. **Backward compatibility**: Are there external links to current SDK/MCP doc pages?

## Recommendations Summary

1. **Use fumadocs-openapi for everything** - Eliminate custom ParamTable/ResponseSchema components
2. **Inject SDK examples** - Implement `generateCodeSamples` callback with TypeScript SDK code
3. **Add MCP examples** - Use `x-codeSamples` in OpenAPI registry for MCP tool calls
4. **Consolidate documentation** - Make API reference canonical, link from SDK/MCP guides
5. **Leverage auto-generation** - Reduce manual maintenance, single source of truth

This approach reduces:
- Custom component count (from 3 to 0)
- Lines of MDX documentation (from ~500 to ~100)
- Maintenance burden (OpenAPI changes auto-reflect in docs)
- Documentation duplication (same API documented once)
