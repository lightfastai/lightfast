---
date: 2025-12-21T17:45:00+08:00
researcher: Claude
git_commit: 9462a334a52890801a2ee2ba77ee5ef99bb4f27f
branch: main
repository: lightfast
topic: "API Reference Sidebar Structure and Content Organization"
tags: [research, codebase, docs, api-reference, sidebar, fumadocs]
status: complete
last_updated: 2025-12-21
last_updated_by: Claude
---

# Research: API Reference Sidebar Structure and Content Organization

**Date**: 2025-12-21T17:45:00+08:00
**Researcher**: Claude
**Git Commit**: 9462a334a52890801a2ee2ba77ee5ef99bb4f27f
**Branch**: main
**Repository**: lightfast

## Research Question

The API reference page at `/docs/api-reference/overview` doesn't have a sidebar. How should the sidebar be structured, and how should the API reference content be organized considering the existing SDK and MCP documentation?

## Summary

The API reference sidebar doesn't appear due to a structural mismatch between the flat content organization in `content/api/` and the sidebar component's rendering logic, which only handles folder-type items. The decision is to restructure the API reference content into logical groupings while maintaining the existing SDK/MCP documentation in the main docs integrate section.

## Detailed Findings

### Root Cause: Sidebar Rendering Logic

The `DocsMarketingSidebar` component at `apps/docs/src/components/docs-marketing-sidebar.tsx:66-117` only renders `folder` and `separator` types:

```tsx
{tree?.children.map((item, index) => {
  if (item.type === "separator") { ... }
  if (item.type === "folder") { ... }
  return null;  // Top-level pages are ignored!
})}
```

### Current Content Structures

**Regular docs** (sidebar works - has nested folders):
```
apps/docs/src/content/docs/
├── meta.json              → { "pages": ["get-started", "integrate", "features"] }
├── get-started/
│   ├── meta.json          → { "title": "Getting Started", "pages": [...] }
│   └── *.mdx
├── integrate/
│   ├── meta.json          → { "title": "Integrate", "pages": ["index", "sdk", "mcp"] }
│   ├── index.mdx
│   ├── sdk.mdx
│   └── mcp.mdx
└── features/
    ├── meta.json          → { "title": "Features", "pages": [...] }
    └── *.mdx
```

**API reference** (sidebar doesn't work - flat structure):
```
apps/docs/src/content/api/
├── meta.json              → { "pages": ["overview", "authentication", ...] }
├── overview.mdx
├── authentication.mdx
├── search.mdx
├── contents.mdx
├── findsimilar.mdx
├── errors.mdx
└── sdks.mdx
```

### Source Configuration

The fumadocs source configuration at `apps/docs/source.config.ts` defines two separate doc sources:

```typescript
export const { docs, meta } = defineDocs({
  dir: "src/content/docs",
});

export const { docs: apiDocs, meta: apiMeta } = defineDocs({
  dir: "src/content/api",
});
```

### Layout Integration

The layout at `apps/docs/src/app/(docs)/layout.tsx` passes both page trees:

```typescript
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsSidebarWrapper pageTree={pageTree} apiPageTree={apiPageTree}>
      {children}
    </DocsSidebarWrapper>
  );
}
```

The wrapper at `apps/docs/src/components/docs-sidebar-wrapper.tsx` switches between trees based on path:

```typescript
const isApiDocs = pathname.includes("/api-reference");
const tree = isApiDocs ? apiPageTree : pageTree;
```

## Code References

- `apps/docs/src/components/docs-marketing-sidebar.tsx:66-117` - Sidebar rendering logic (only handles folders)
- `apps/docs/src/components/docs-sidebar-wrapper.tsx:14-25` - Tree switching logic
- `apps/docs/src/app/(docs)/layout.tsx:6-11` - Layout passing both trees
- `apps/docs/source.config.ts:1-17` - Fumadocs source configuration
- `apps/docs/src/lib/source.ts:1-26` - Source loader exports
- `apps/docs/src/content/api/meta.json` - Current flat API structure
- `apps/docs/src/content/docs/integrate/meta.json` - Current integrate section

## Decision: Option B with Maintained Integrate Section

### Approved Structure

Reorganize API reference content into logical groupings:

```
apps/docs/src/content/api/
├── meta.json                    → { "pages": ["getting-started", "endpoints", "sdks-tools"] }
│
├── getting-started/
│   ├── meta.json                → { "title": "Getting Started", "pages": ["overview", "authentication", "errors"] }
│   ├── overview.mdx
│   ├── authentication.mdx
│   └── errors.mdx
│
├── endpoints/
│   ├── meta.json                → { "title": "Endpoints", "pages": ["search", "contents", "findsimilar"] }
│   ├── search.mdx
│   ├── contents.mdx
│   └── findsimilar.mdx
│
└── sdks-tools/
    ├── meta.json                → { "title": "SDKs & Tools", "pages": ["typescript-sdk", "mcp-server"] }
    ├── typescript-sdk.mdx       → (new file, API-focused SDK reference)
    └── mcp-server.mdx           → (new file, API-focused MCP reference)
```

### Maintain Existing Integrate Section

Keep the existing integrate section in main docs:

```
apps/docs/src/content/docs/integrate/
├── meta.json                    → { "title": "Integrate", "pages": ["index", "sdk", "mcp"] }
├── index.mdx
├── sdk.mdx                      → Tutorial/getting-started focused
└── mcp.mdx                      → Tutorial/getting-started focused
```

### Rationale

1. **API Reference** (`/docs/api-reference/sdks-tools/`): Technical reference documentation with complete API details
2. **Integrate Section** (`/docs/integrate/`): Tutorial-style guides for getting started with SDK/MCP

This follows the documentation pattern of separating:
- **Tutorials** (how to get started) - in main docs
- **Reference** (complete API details) - in API reference

### Cross-Linking Strategy

- API Reference overview should link to Integrate section for "getting started" tutorials
- Integrate section should link to API Reference for complete method/parameter details

## Implementation Tasks

1. Create folder structure in `apps/docs/src/content/api/`:
   - `getting-started/` with meta.json
   - `endpoints/` with meta.json
   - `sdks-tools/` with meta.json

2. Move existing files:
   - `overview.mdx` → `getting-started/overview.mdx`
   - `authentication.mdx` → `getting-started/authentication.mdx`
   - `errors.mdx` → `getting-started/errors.mdx`
   - `search.mdx` → `endpoints/search.mdx`
   - `contents.mdx` → `endpoints/contents.mdx`
   - `findsimilar.mdx` → `endpoints/findsimilar.mdx`

3. Create new SDK/MCP reference files in `sdks-tools/`:
   - `typescript-sdk.mdx` - API reference style
   - `mcp-server.mdx` - API reference style

4. Update root `meta.json` to reference folders

5. Update internal links in all moved files

6. Remove `sdks.mdx` from root (consolidated into sdks-tools folder)

## Open Questions

1. Should the `sdks-tools/` files duplicate content from `integrate/` or be distinct API reference docs?
2. Should we add a "Resources" or "Examples" section to the API reference?
3. Should error codes be in `getting-started/` or have their own section?

## Related Research

None currently in thoughts/shared/research/ related to docs structure.
