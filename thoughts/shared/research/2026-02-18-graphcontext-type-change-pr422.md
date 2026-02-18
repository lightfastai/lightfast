---
date: 2026-02-18T00:18:04+0000
researcher: claude
git_commit: 26c11b1a688c26802acaea34d5c73ccd663b7177
branch: main
repository: lightfast-search-perf-improvements
topic: "GraphContext type change in PR #422 — correctness of removing 'https://schema.org' literal"
tags: [research, codebase, seo, json-ld, typescript, vendor-seo, schema-dts]
status: complete
last_updated: 2026-02-18
last_updated_by: claude
---

# Research: GraphContext Type Change in PR #422

**Date**: 2026-02-18T00:18:04+0000
**Researcher**: claude
**Git Commit**: 26c11b1a688c26802acaea34d5c73ccd663b7177
**Branch**: main
**Repository**: lightfast-search-perf-improvements

## Research Question

Investigate the change from:
```typescript
type GraphContext = {
  "@context": "https://schema.org" | string | Record<string, unknown> | Array<string | Record<string, unknown>>;
  "@graph": Array<Thing>;
};
```
to:
```typescript
interface GraphContext {
  "@context": string | Record<string, unknown> | (string | Record<string, unknown>)[];
  "@graph": Thing[];
}
```

Made in PR #422 (`fix(lint): resolve ESLint errors in vendor-seo`). Concern: did removing `"https://schema.org"` as a literal lose type precision?

## Summary

**The change is semantically correct and non-regressive.** The removal of `"https://schema.org"` from the union did not lose any type safety. In TypeScript, a string literal unioned with `string` (`"https://schema.org" | string`) is always widened to `string` by the type system — the literal is subsumed and has no effect. The original and new types are functionally identical. Every callsite in the codebase assigns `"@context": "https://schema.org"` as a plain string, which the current `string` union accepts without issue.

## Detailed Findings

### TypeScript Union Widening — Why the Literal Was Redundant

In TypeScript, string literals are subtypes of `string`. When a literal is unioned with its parent type, the literal is absorbed:

```typescript
"https://schema.org" | string   // TypeScript reduces this to: string
```

This is a fundamental TypeScript behavior (structural subtyping). So the original:
```typescript
"https://schema.org" | string | Record<string, unknown> | Array<string | Record<string, unknown>>
```
was already equivalent to:
```typescript
string | Record<string, unknown> | Array<string | Record<string, unknown>>
```

The `"https://schema.org"` literal was **purely decorative/documentary** in the original type — it carried zero type-checking effect. The PR's new version is semantically identical.

### What schema-dts Defines for `WithContext`

From `node_modules/.pnpm/schema-dts@1.1.5/node_modules/schema-dts/dist/schema.d.ts:2-6`:
```typescript
export type WithContext<T extends Thing> = T & {
    "@context": "https://schema.org";
```

The library's own `WithContext` uses **just the strict literal** — no `| string`. This is exactly because when you want to restrict to only that URL, you use the literal alone (not `| string`).

`GraphContext` is a separate custom type for `@graph`-style JSON-LD documents (multiple entities in one block), which is why it exists alongside `WithContext<Thing>` in the `JsonLdData` union:

```typescript
// vendor/seo/json-ld.tsx:10
type JsonLdData = WithContext<Thing> | GraphContext;
```

- `WithContext<Thing>` → strict literal `"https://schema.org"`, single entity
- `GraphContext` → loose `string | ...`, `@graph` multi-entity documents

### JSON-LD Spec Alignment

The JSON-LD specification allows `@context` to be:
1. A URI string (e.g. `"https://schema.org"`)
2. An inline context object
3. An array of the above

The current `GraphContext["@context"]` type — `string | Record<string, unknown> | (string | Record<string, unknown>)[]` — correctly models all three forms of the spec. It is more spec-accurate than artificially restricting to `"https://schema.org"` only.

### Callsite Evidence — All Usages Pass `"https://schema.org"`

Every callsite in the codebase that assigns to a `GraphContext` typed variable passes the string `"https://schema.org"`, which the current `string` union type accepts:

| File | Line | Usage |
|------|------|-------|
| `apps/docs/src/app/(docs)/docs/(general)/[[...slug]]/page.tsx` | 151-152 | `const structuredData: GraphContext = { "@context": "https://schema.org"` |
| `apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx` | 117-118 | `const structuredData: GraphContext = { "@context": "https://schema.org"` |
| `apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx` | 218-219 | `const structuredData: GraphContext = { "@context": "https://schema.org"` |
| `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/topic/[category]/page.tsx` | 179-180 | `const structuredData: GraphContext = { "@context": "https://schema.org"` |
| `apps/www/src/app/(app)/(marketing)/(content)/blog/(listing)/page.tsx` | 68-69 | `const structuredData: GraphContext = { "@context": "https://schema.org"` |
| `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx` | 184-185 | `const structuredData: GraphContext = { "@context": "https://schema.org"` |

No callsite relies on the literal for type narrowing. All pass the same string value.

## Code References

- `vendor/seo/json-ld.tsx:4-7` — Current `GraphContext` interface definition
- `vendor/seo/json-ld.tsx:10` — `JsonLdData = WithContext<Thing> | GraphContext` union
- `vendor/seo/json-ld.tsx:35` — `GraphContext` exported as named type
- `node_modules/.pnpm/schema-dts@1.1.5/node_modules/schema-dts/dist/schema.d.ts:2-6` — `WithContext` uses strict `"https://schema.org"` literal

## Architecture Documentation

`vendor/seo/json-ld.tsx` exports two complementary paths for structured data:

1. **`WithContext<Thing>`** (from schema-dts): strict `"@context": "https://schema.org"`, for single-entity JSON-LD blocks
2. **`GraphContext`** (custom): loose `"@context": string | ...`, for `@graph` multi-entity blocks

The `JsonLdData = WithContext<Thing> | GraphContext` union is what the `<JsonLd>` component accepts, covering both patterns.

## If You Wanted to Truly Restrict to `"https://schema.org"` Only

If the intent were to restrict `@context` to only the schema.org URL in `GraphContext` (e.g. to prevent other contexts from being used), the type would need to be:
```typescript
interface GraphContext {
  "@context": "https://schema.org";  // literal ALONE, no | string
  "@graph": Thing[];
}
```

That would be a stricter, narrower type that would reject any other string. The current `string` union is intentionally permissive, consistent with the JSON-LD spec.

## Open Questions

None — the change is confirmed safe. The `"https://schema.org"` literal in the original type was TypeScript-redundant due to union widening.
