# `@vendor/aeo` — AEO Package Implementation Plan

## Overview

Extract the hand-rolled `llms.txt` logic from `apps/www/src/app/(seo)/llms.txt/route.ts` into a
reusable `@vendor/aeo` package. The package generates `/llms.txt` from a single normalized
`PageEntry[]` array, using a three-layer pipeline: static HTML discovery → provider merge → format
output. Placed in `vendor/aeo/` alongside `@vendor/seo`, its direct sibling (SEO is for search
engines; AEO is for AI agents).

## Current State Analysis

- `apps/www/src/app/(seo)/llms.txt/route.ts` — 296 lines, fully functional, no external abstractions
- `apps/www/src/app/sitemap.ts` — independent duplicate of the same three CMS fetches
  (`blog.getPosts()`, `changelog.getEntries()`, `legal.getPosts()`) with identical base URL
- No `proxy.ts` exists in `apps/www` (out of scope for this plan)

### Key Discoveries

- `route.ts:19` — `BASE_URL = "https://lightfast.ai"` hardcoded; also hardcoded in `sitemap.ts:97`
- `route.ts:102-119` — `sectionOf(url)` is www-specific URL classification logic
- `route.ts:72` — title stripping regex (` | Lightfast`) is app-specific
- `route.ts:31-41` — `SKIP_URL` mixes framework-level patterns (robots, sitemap, feeds) with
  app-specific ones (`/pitch-deck`, `/search`)
- `route.ts:214-219` — `HOME` entry hardcoded in GET handler with a richer title/description than
  what `extractMeta` would extract from the built HTML
- No URL deduplication: if `index.html` exists in `.next/server/app/`, the homepage appears twice
  (once as the hardcoded HOME entry, once from `collectStaticPages`)

## Desired End State

After this plan:
- `vendor/aeo/` package with `@vendor/aeo` name, pure-TypeScript, no build step
- `apps/www/src/app/(seo)/llms.txt/route.ts` reduced to ~50 lines of provider + config
- No logic duplication — all discovery, formatting, and handler logic lives in `@vendor/aeo`

### Verification

```bash
# Type checking
pnpm --filter @vendor/aeo typecheck
pnpm --filter @lightfast/www typecheck

# Lint
pnpm check

# Smoke test (requires built www)
curl https://lightfast.ai/llms.txt | head -20
```

## What We're NOT Doing

- Extracting CMS fetch logic from `sitemap.ts` — separate PR
- Adding a `/llms.json` route — not needed
- Adding `@markdown-for-agents/nextjs` / `proxy.ts` — different concern, separate PR
- Publishing `@vendor/aeo` to npm — stays `"private": true`
- Building a `llms-full.txt` concatenated variant — future work

---

## Phase 1: Package Scaffold

### Overview

Create `vendor/aeo/` with the three config files that every vendor package requires, matching the
`@vendor/seo` pattern exactly.

### Changes Required

#### 1. `vendor/aeo/package.json`

```json
{
  "name": "@vendor/aeo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./index.ts"
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "typecheck": "tsc --noEmit --emitDeclarationOnly false"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

No `build` script — source-transparent exports, consuming apps bundle `.ts` directly (same as
`vendor/seo`). No runtime dependencies — all APIs used are Node.js built-ins (`node:fs`,
`node:path`).

#### 2. `vendor/aeo/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}
```

Extends `internal-package.json` (not `react-library.json`) — no React/JSX, pure Node.js.

#### 3. `vendor/aeo/turbo.json`

```json
{
  "extends": ["//"],
  "tags": ["vendor"],
  "tasks": {}
}
```

Empty tasks — no build step, Turbo skips this package during `build` pipeline.

### Success Criteria

#### Automated Verification
- [x] Directory `vendor/aeo/` exists with all three files
- [x] `pnpm install` completes without errors (pnpm resolves the new workspace member)

---

## Phase 2: Types

### Overview

Define all shared TypeScript types in `vendor/aeo/types.ts`. No logic, no imports beyond
TypeScript built-ins.

### Changes Required

#### 1. `vendor/aeo/types.ts`

```typescript
/** A single discoverable page — the universal unit of data in aeo. */
export interface PageEntry {
  /** Canonical absolute URL of the page. */
  url: string
  /** Human-readable title. */
  title: string
  /** Optional short description (1–2 sentences). */
  description?: string
  /** ISO 8601 date of last modification, if known. */
  lastModified?: string
  /**
   * llms.txt section name this page belongs to.
   * Maps to an H2 heading in the output.
   * Pages without a section use `LlmsTxtOptions.defaultSection`.
   */
  section?: string
  /**
   * When true, this entry goes into the `## Optional` section
   * (spec-reserved: tools may skip these for brevity).
   */
  optional?: boolean
}

/** A function that returns additional dynamic pages (CMS, DB, etc.). */
export type PageProvider = () => Promise<PageEntry[]>

/** Options for the HTML discovery layer. */
export interface DiscoveryOptions {
  /**
   * Absolute path to the Next.js build output.
   * Default: `process.cwd()/.next/server/app`
   */
  buildOutputDir?: string
  /**
   * Additional file-level patterns to skip before reading HTML.
   * Merged with built-in defaults (not-found, global-error, opengraph-image, twitter-image).
   */
  skipFile?: RegExp[]
  /**
   * Additional URL patterns to exclude from the output.
   * Merged with built-in defaults (llms, sitemap, robots, feeds, unresolved segments).
   */
  skipUrl?: RegExp[]
  /**
   * Strip this suffix from extracted page titles.
   * E.g. `"Lightfast"` strips ` | Lightfast` from titles like `"Pricing | Lightfast"`.
   */
  stripTitleSuffix?: string
}

/** Options for the llms.txt formatter. */
export interface LlmsTxtOptions {
  /** Site title — appears as the H1. Required by spec. */
  title: string
  /** Tagline or summary — appears as the `>` blockquote. */
  description?: string
  /** Optional body prose between the blockquote and first H2. */
  details?: string
  /** Base URL used to resolve relative URLs and pin the homepage first in its section. */
  baseUrl: string
  /** Lines appended verbatim after all sections (e.g. contact info block). */
  footer?: string[]
  /** Section ordering. Sections not in this list are appended in discovery order. */
  sectionOrder?: string[]
  /** Default section name for pages without an explicit `PageEntry.section`. */
  defaultSection?: string
  /**
   * Maps a URL to its section name for static pages (which have no section set by a provider).
   * Return `undefined` to fall back to `defaultSection`.
   */
  sectionResolver?: (url: string) => string | undefined
}

/** Options for the route handler (HTTP-level concerns, separate from formatter options). */
export interface HandlerOptions {
  /**
   * Value for the `Cache-Control` response header.
   * Required — consumers must set this explicitly (no silent default in the package).
   * E.g. `"public, max-age=86400, s-maxage=86400"` for a 24-hour CDN cache.
   */
  cacheControl: string
}
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @vendor/aeo typecheck` passes (types file compiles clean)

---

## Phase 3: Pure Formatter

### Overview

Implement `toLlmsTxt` as a pure function — no I/O, no Next.js imports. Extracted and generalized
from the grouping/formatting logic in `route.ts:228-295`.

### Changes Required

#### 1. `vendor/aeo/format.ts`

```typescript
import type { LlmsTxtOptions, PageEntry } from "./types"

/**
 * Format a PageEntry[] as a spec-compliant llms.txt string.
 * Pure function — no I/O.
 */
export function toLlmsTxt(pages: PageEntry[], opts: LlmsTxtOptions): string {
  const {
    title,
    description,
    details,
    baseUrl,
    footer,
    sectionOrder = [],
    defaultSection = "General",
    sectionResolver,
  } = opts

  // Resolve section for each page
  const resolved = pages.map((page) => ({
    ...page,
    section:
      page.section ??
      (sectionResolver ? (sectionResolver(page.url) ?? defaultSection) : defaultSection),
  }))

  // Build ordered section map (insertion order = display order)
  const groups = new Map<string, PageEntry[]>(sectionOrder.map((k) => [k, []]))

  for (const page of resolved) {
    const key = page.optional ? "Optional" : page.section
    const bucket = groups.get(key) ?? []
    bucket.push(page)
    if (!groups.has(key)) {
      groups.set(key, bucket)
    }
  }

  // Sort within groups: baseUrl entry pinned first, then lexicographic
  for (const items of groups.values()) {
    items.sort((a, b) => {
      if (a.url === baseUrl) return -1
      if (b.url === baseUrl) return 1
      return a.url.localeCompare(b.url)
    })
  }

  const lines: string[] = [`# ${title}`, ""]

  if (description) {
    lines.push(`> ${description}`, "")
  }
  if (details) {
    lines.push(details, "")
  }

  for (const [label, items] of groups) {
    if (!items.length) continue
    lines.push(`## ${label}`, "")
    for (const { url, title: pageTitle, description: pageDesc } of items) {
      lines.push(`- [${pageTitle}](${url})${pageDesc ? `: ${pageDesc}` : ""}`)
    }
    lines.push("")
  }

  if (footer?.length) {
    lines.push(...footer, "")
  }

  return lines.join("\n")
}
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @vendor/aeo typecheck` passes

---

## Phase 4: Discovery and Collection

### Overview

Implement the HTML discovery layer and provider merge. Code is extracted and generalized from
`route.ts:23-146`. Key changes from the original:

- `walkHtml` → `walkBuildOutput` (generic name)
- `SKIP_FILE` / `SKIP_URL` constants become defaults merged with `DiscoveryOptions` overrides
- Title stripping regex parameterized via `DiscoveryOptions.stripTitleSuffix`
- URL deduplication in `collectAllPages` (providers win over static discovery for the same URL)

### Changes Required

#### 1. `vendor/aeo/collect.ts`

```typescript
import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import type { DiscoveryOptions, PageEntry, PageProvider } from "./types"

/** Framework-level file patterns always skipped before reading HTML. */
export const DEFAULT_SKIP_FILE: RegExp[] = [
  /_not-found/,
  /_global-error/,
  /opengraph-image/,
  /twitter-image/,
]

/** Framework-level URL patterns always excluded from the output. */
export const DEFAULT_SKIP_URL: RegExp[] = [
  /\/llms/,
  /\/sitemap/,
  /\/robots/,
  /\/rss\.xml/,
  /\/atom\.xml/,
  /\/feed\.xml/,
  /\[/, // unresolved dynamic segments
]

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x60;/g, "`")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
}

function extractMeta(
  html: string,
  stripTitleSuffix?: string
): { title?: string; description?: string; canonical?: string } {
  const rawTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  let title = rawTitle ? decodeHtmlEntities(rawTitle).trim() : undefined
  if (title && stripTitleSuffix) {
    // String-based — avoids regex injection if suffix contains special chars (e.g. "lightfast.ai")
    const suffix = ` | ${stripTitleSuffix}`
    const idx = title.lastIndexOf(suffix)
    if (idx !== -1) title = title.slice(0, idx).trim()
  }

  const rawDesc =
    html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta\s+content="([^"]+)"\s+name="description"/i)?.[1]
  const description = rawDesc ? decodeHtmlEntities(rawDesc) : undefined

  const canonical =
    html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ??
    html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i)?.[1]

  return { title, description, canonical }
}

async function* walkBuildOutput(dir: string): AsyncGenerator<string> {
  if (!existsSync(dir)) return
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walkBuildOutput(full)
    } else if (entry.name.endsWith(".html")) {
      yield full
    }
  }
}

/** Discover and normalize static pages from the Next.js build output. */
export async function collectStaticPages(opts: DiscoveryOptions = {}): Promise<PageEntry[]> {
  const {
    buildOutputDir = join(process.cwd(), ".next", "server", "app"),
    skipFile = [],
    skipUrl = [],
    stripTitleSuffix,
  } = opts

  const skipFilePatterns = [...DEFAULT_SKIP_FILE, ...skipFile]
  const skipUrlPatterns = [...DEFAULT_SKIP_URL, ...skipUrl]

  const pages: PageEntry[] = []

  for await (const filePath of walkBuildOutput(buildOutputDir)) {
    const rel = relative(buildOutputDir, filePath)
    if (skipFilePatterns.some((p) => p.test(rel))) continue

    try {
      const html = await readFile(filePath, "utf8")
      const { title, description, canonical } = extractMeta(html, stripTitleSuffix)
      if (!(canonical && title)) continue
      if (skipUrlPatterns.some((p) => p.test(canonical))) continue
      pages.push({ url: canonical, title, description: description ?? undefined })
    } catch {
      // skip unreadable files
    }
  }

  return pages
}

/** Merge results from multiple dynamic providers. */
export async function collectDynamicPages(providers: PageProvider[]): Promise<PageEntry[]> {
  const results = await Promise.all(providers.map((p) => p().catch(() => [])))
  return results.flat()
}

/**
 * Collect all pages: static discovery + dynamic providers combined.
 * Deduplicates by URL — provider entries override static discovery entries
 * for the same URL (last-writer wins in provider order).
 */
export async function collectAllPages(
  providers: PageProvider[] = [],
  opts: DiscoveryOptions = {}
): Promise<PageEntry[]> {
  const [staticPages, dynamicPages] = await Promise.all([
    collectStaticPages(opts),
    collectDynamicPages(providers),
  ])

  // Deduplicate: static first, then providers override by URL
  const byUrl = new Map<string, PageEntry>()
  for (const page of staticPages) byUrl.set(page.url, page)
  for (const page of dynamicPages) byUrl.set(page.url, page)

  return [...byUrl.values()]
}
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @vendor/aeo typecheck` passes

---

## Phase 5: Handler Factory

### Overview

Implement `createLlmsTxtHandler` — the Next.js App Router route handler factory. Uses only the
Web-standard `Response` API, no Next.js imports.

### Changes Required

#### 1. `vendor/aeo/handlers.ts`

```typescript
import { collectAllPages } from "./collect"
import { toLlmsTxt } from "./format"
import type { DiscoveryOptions, HandlerOptions, LlmsTxtOptions, PageProvider } from "./types"

/**
 * Next.js App Router handler factory for /llms.txt.
 * Usage: export const { GET } = createLlmsTxtHandler(providers, opts, handlerOpts)
 */
export function createLlmsTxtHandler(
  providers: PageProvider[],
  opts: LlmsTxtOptions,
  handlerOpts: HandlerOptions,
  discoveryOpts?: DiscoveryOptions
): { GET: () => Promise<Response> } {
  return {
    async GET() {
      const pages = await collectAllPages(providers, discoveryOpts)
      const body = toLlmsTxt(pages, opts)
      return new Response(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": handlerOpts.cacheControl,
        },
      })
    },
  }
}
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @vendor/aeo typecheck` passes

---

## Phase 6: Barrel Export

### Overview

Single `index.ts` re-exporting the full public surface.

### Changes Required

#### 1. `vendor/aeo/index.ts`

```typescript
export type {
  DiscoveryOptions,
  HandlerOptions,
  LlmsTxtOptions,
  PageEntry,
  PageProvider,
} from "./types"

export {
  DEFAULT_SKIP_FILE,
  DEFAULT_SKIP_URL,
  collectAllPages,
  collectDynamicPages,
  collectStaticPages,
} from "./collect"

export { toLlmsTxt } from "./format"

export { createLlmsTxtHandler } from "./handlers"
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @vendor/aeo typecheck` passes (full package type-checks clean)
- [x] `pnpm install` resolves `@vendor/aeo` correctly as a workspace dep

---

## Phase 7: Migrate `apps/www`

### Overview

Replace the hand-rolled `llms.txt/route.ts` with `@vendor/aeo`. The provider lambdas preserve the
exact same CMS field access as the current implementation — no behavioral change, just structure.

### Changes Required

#### 1. `apps/www/package.json` — add dependency

In `"dependencies"`, add after `"@vendor/analytics"`:
```json
"@vendor/aeo": "workspace:*",
```

#### 2. `apps/www/src/app/(seo)/llms.txt/route.ts` — replace entirely

```typescript
import { type PageEntry, createLlmsTxtHandler } from "@vendor/aeo"
import { blog, changelog, legal } from "@vendor/cms"

export const revalidate = false

const BASE_URL = "https://lightfast.ai"

const providers: Array<() => Promise<PageEntry[]>> = [
  // Home page override — richer title/description than what extractMeta gets from HTML
  () =>
    Promise.resolve([
      {
        url: BASE_URL,
        title: "The Operating Layer for Agents and Apps",
        description:
          "Lightfast is the operating layer between your agents and apps. Observe what's happening across your tools, remember what happened, and give agents and people a single system to reason and act through.",
        section: "Marketing",
      },
    ]),

  // Blog listing + posts
  () =>
    blog.getPosts().then((posts) => {
      const entries: PageEntry[] = [
        {
          url: `${BASE_URL}/blog`,
          title: "Blog",
          description: "Insights, guides, and product updates from the Lightfast team.",
          section: "Blog",
        },
      ]
      for (const post of posts) {
        const slug = post.slug ?? post._slug
        if (!slug) continue
        entries.push({
          url: `${BASE_URL}/blog/${slug}`,
          title: post._title ?? slug,
          description: post.description ?? undefined,
          section: "Blog",
        })
      }
      return entries
    }),

  // Changelog listing + entries
  () =>
    changelog.getEntries().then((entries) => {
      const pages: PageEntry[] = [
        {
          url: `${BASE_URL}/changelog`,
          title: "Changelog",
          description: "What's new in Lightfast — product updates and improvements.",
          section: "Changelog",
        },
      ]
      for (const entry of entries) {
        const slug = entry.slug ?? entry._slug
        if (!slug) continue
        pages.push({
          url: `${BASE_URL}/changelog/${slug}`,
          title: entry._title ?? slug,
          section: "Changelog",
        })
      }
      return pages
    }),

  // Legal pages
  () =>
    legal.getPosts().then((pages) =>
      pages
        .filter((p) => !!p._slug)
        .map((p) => ({
          url: `${BASE_URL}/legal/${p._slug}`,
          title: p._title ?? p._slug!,
          description: p.description ?? undefined,
          section: "Legal",
          optional: true as const,
        }))
    ),
]

export const { GET } = createLlmsTxtHandler(
  providers,
  {
    title: "Lightfast",
    description:
      "The operating layer for AI agents and engineering teams. Agents and developers use Lightfast to observe events, build semantic memory, and act across their entire tool stack — giving AI systems persistent, source-cited knowledge of everything that happens across code, deployments, incidents, and decisions.",
    baseUrl: BASE_URL,
    sectionOrder: ["Marketing", "Use Cases", "Docs", "API Reference", "Blog", "Changelog", "Legal"],
    sectionResolver: (url) => {
      if (url === BASE_URL || /\/(pricing)($|\/)/.test(url)) return "Marketing"
      if (url.includes("/use-cases/")) return "Use Cases"
      if (url.includes("/docs/api-reference")) return "API Reference"
      if (url.includes("/docs")) return "Docs"
      return undefined // fall through to defaultSection
    },
    defaultSection: "Marketing",
    footer: [
      "## Contact & Support",
      "",
      "- Email: hello@lightfast.ai",
      "- Founder: Jeevan Pillay — jp@lightfast.ai — https://twitter.com/jeevanpillay",
      "- Support: support@lightfast.ai",
      "- Twitter: https://twitter.com/lightfastai",
      "- Discord: https://discord.gg/YqPDfcar2C",
      "- GitHub (org): https://github.com/lightfastai",
      "- GitHub (SDK + MCP): https://github.com/lightfastai/lightfast",
      "- npm (SDK): https://www.npmjs.com/package/lightfast",
      "- npm (MCP server): https://www.npmjs.com/package/@lightfastai/mcp",
    ],
  },
  { cacheControl: "public, max-age=86400, s-maxage=86400" },
  {
    skipUrl: [/\/search(\b|\/)/, /\/pitch-deck/],
    stripTitleSuffix: "Lightfast",
  }
)
```

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @lightfast/www typecheck` passes
- [x] `pnpm check` passes (no lint errors)
- [ ] `pnpm --filter @lightfast/www build` completes without errors

#### Manual Verification
- [ ] `GET /llms.txt` returns `text/plain; charset=utf-8`, begins with `# Lightfast`
- [ ] Sections appear in order: Marketing → Use Cases → Docs → API Reference → Blog → Changelog → Legal → Contact & Support
- [ ] Home entry ("The Operating Layer for Agents and Apps") appears first in Marketing, not duplicated
- [ ] Blog posts, changelog entries, and legal pages appear
- [ ] Static pages (`/pricing`, `/use-cases/*`, `/docs/*`) appear in correct sections
- [ ] `/pitch-deck` and `/search` do not appear
- [ ] Output is identical to pre-migration `/llms.txt`

---

## References

- Research: `thoughts/shared/research/2026-03-21-aeo-package-design.md`
- Source to migrate: `apps/www/src/app/(seo)/llms.txt/route.ts`
- Closest analog: `vendor/seo/` (`@vendor/seo`)
- CMS provider shapes: `vendor/cms/index.ts` (`PostMeta`, `ChangelogEntry`, `LegalPost`)
