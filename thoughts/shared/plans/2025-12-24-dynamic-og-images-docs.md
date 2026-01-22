# Dynamic OG Image Generation for Docs - Implementation Plan

## Overview

Implement dynamic Open Graph image generation for documentation pages using `next/og` ImageResponse. OG images will be served from `apps/www` at `/api/og/docs/[...slug]` and display the Lightfast logo and page title in a dark, minimal Vercel-style design.

## Current State Analysis

### What Exists Now
- Static OG image at `/og.jpg` used across all pages
- Docs frontmatter supports `ogImage` field but expects static paths
- No dynamic OG generation infrastructure
- `microfrontends.json` routes `/api/og/search-demo` to www (unused)

### Key Discoveries
- Lightfast logo SVG defined at `packages/ui/src/components/ui/icons.tsx:4-13`
- Reference implementation at `tmp/next-forge/docs/app/og/[...slug]/route.tsx`
- Geist fonts available via Google Fonts API
- Docs pages use `generateMetadata()` at `apps/docs/src/app/(docs)/docs/[[...slug]]/page.tsx:203`

## Desired End State

- Dynamic OG images generated on-demand for each docs page
- Design: Dark background, Lightfast logo top-left, large title
- Font: Geist Sans from Google Fonts
- Served from `https://lightfast.ai/api/og/docs/[slug]`
- Docs pages automatically use dynamic OG URLs

### Verification
- Visit `https://lightfast.ai/api/og/docs/get-started/overview` returns PNG image
- Share docs URL on Twitter/LinkedIn shows dynamic OG image with page title
- OG debugger tools (Facebook, Twitter) validate image correctly

## What We're NOT Doing

- Versioned docs support
- i18n/hreflang support
- Blog/changelog OG images (separate effort)
- Custom per-page OG image overrides (frontmatter `ogImage` field becomes secondary)
- Background gradient/noise effect (keeping it simple initially)

## Implementation Approach

1. Create OG route in `apps/www` that accepts slug and renders ImageResponse
2. Route fetches page metadata from docs API or uses query params
3. Update microfrontends.json to route `/api/og/docs/*` to www
4. Modify docs generateMetadata to point to dynamic OG URL

---

## Phase 1: Create Dynamic OG Route

### Overview
Create the ImageResponse route handler in apps/www that generates OG images.

### Changes Required

#### 1. Create OG Route Handler
**File**: `apps/www/src/app/(app)/api/og/docs/[...slug]/route.tsx`

```tsx
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

// Load Geist font from Google Fonts
const loadGoogleFont = async (font: string, text: string, weight: string) => {
  const url = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const resource = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/
  );

  if (resource) {
    const response = await fetch(resource[1]);
    if (response.status === 200) {
      return await response.arrayBuffer();
    }
  }

  throw new Error("Failed to load font data");
};

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const url = new URL(request.url);

  // Get title from query param or generate from slug
  const title = url.searchParams.get("title")
    || slug.map(s => s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")).join(" – ");

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          padding: "60px",
        }}
      >
        {/* Logo top-left */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="white"
        >
          <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
        </svg>

        {/* Title - Large, bottom left */}
        <h1
          style={{
            color: "white",
            fontSize: title.length > 40 ? "56px" : "72px",
            fontFamily: "Geist",
            fontWeight: 500,
            lineHeight: 1.1,
            margin: 0,
            maxWidth: "90%",
          }}
        >
          {title}
        </h1>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Geist",
          data: await loadGoogleFont("Geist", title, "500"),
          style: "normal",
          weight: 500,
        },
      ],
    }
  );
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `pnpm --filter @lightfast/www typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/www lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification
- [ ] Visit `http://localhost:4101/api/og/docs/get-started/overview?title=Getting%20Started` returns valid PNG
- [ ] Image displays correctly with logo, title
- [ ] Font renders properly

**Implementation Note**: After completing this phase, pause for manual verification before proceeding.

---

## Phase 2: Update Microfrontends Routing

### Overview
Add routing rule to serve `/api/og/docs/*` from apps/www through the microfrontends proxy.

### Changes Required

#### 1. Update Microfrontends Config
**File**: `apps/console/microfrontends.json`

Add `/api/og/docs/:path*` to the www routing paths:

```json
{
  "routing": [
    {
      "group": "marketing",
      "paths": [
        "/",
        "/api/og/docs/:path*",
        "/api/og/search-demo",
        // ... rest of existing paths
      ]
    }
  ]
}
```

### Success Criteria

#### Automated Verification
- [x] JSON is valid: `node -e "require('./apps/console/microfrontends.json')"`
- [ ] Dev server starts: `pnpm dev:app`

#### Manual Verification
- [ ] Visit `http://localhost:3024/api/og/docs/test?title=Test` returns OG image
- [ ] Route proxies correctly through microfrontends

**Implementation Note**: After completing this phase, pause for manual verification before proceeding.

---

## Phase 3: Integrate with Docs Metadata

### Overview
Update docs pages to generate dynamic OG image URLs instead of using static fallback.

### Changes Required

#### 1. Add OG URL Generator Utility
**File**: `apps/docs/src/lib/og-url.ts`

```typescript
/**
 * Generate dynamic OG image URL for docs pages
 */
export function generateDocsOgUrl(options: {
  slug: string[];
  title: string;
}): string {
  const { slug, title } = options;
  const baseUrl = "https://lightfast.ai/api/og/docs";
  const path = slug.join("/");

  const params = new URLSearchParams();
  params.set("title", title);

  return `${baseUrl}/${path}?${params.toString()}`;
}
```

#### 2. Update Docs Page generateMetadata
**File**: `apps/docs/src/app/(docs)/docs/[[...slug]]/page.tsx`

Import and use the OG URL generator:

```typescript
// Add import at top
import { generateDocsOgUrl } from "@/lib/og-url";

// In generateMetadata function, replace ogImage logic (around line 294-296):
// OLD:
// const ogImage = frontmatter.ogImage
//   ? `https://lightfast.ai${frontmatter.ogImage}`
//   : siteConfig.ogImage;

// NEW:
const ogImage = frontmatter.ogImage
  ? `https://lightfast.ai${frontmatter.ogImage}`
  : generateDocsOgUrl({
      slug,
      title: frontmatter.title || title,
    });
```

#### 3. Update API Reference Page
**File**: `apps/docs/src/app/(docs)/docs/api-reference/[[...slug]]/page.tsx`

Add dynamic OG URL generation to API reference pages:

```typescript
// Add import at top
import { generateDocsOgUrl } from "@/lib/og-url";

// In generateMetadata function, replace static ogImage with dynamic:
// OLD (around line 233):
// image: siteConfig.ogImage,

// NEW:
const ogImage = generateDocsOgUrl({
  slug: ["api-reference", ...slug],
  title: page.data.title || title,
});

// Then use ogImage in createMetadata and openGraph.images
```

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `pnpm --filter @lightfast/docs typecheck`
- [ ] Lint passes: `pnpm --filter @lightfast/docs lint`
- [ ] Build succeeds: `pnpm build:docs`

#### Manual Verification
- [ ] View page source of docs page shows dynamic OG URL
- [ ] OG URL returns valid image with correct title
- [ ] Facebook Sharing Debugger validates the OG tags correctly

**Implementation Note**: After completing this phase, pause for manual verification before proceeding.

---

## Phase 4: Testing and Polish

### Overview
Comprehensive testing across different scenarios and edge cases.

### Test Cases

#### 1. Title Length Variations
- Short title: "Overview"
- Medium title: "Getting Started with Lightfast"
- Long title: "How to Configure Advanced Search Parameters for Semantic Memory"

#### 2. Special Characters
- Title with ampersand: "Search & Filter"
- Title with quotes: "Using the 'query' Parameter"

#### 3. Edge Cases
- Empty slug (root docs page)
- Very deep nesting: `/docs/a/b/c/d/e`
- Non-ASCII characters in title

### Success Criteria

#### Automated Verification
- [ ] All docs pages build successfully: `pnpm build:docs`
- [ ] No console errors in dev server

#### Manual Verification
- [ ] Test 5 different docs pages with varying title lengths
- [ ] Share a docs URL on Twitter/LinkedIn preview
- [ ] Verify OG image in Facebook Sharing Debugger
- [ ] Verify OG image in Twitter Card Validator

---

## Testing Strategy

### Unit Tests
- OG URL generator produces correct URLs
- Font loading handles failures gracefully

### Integration Tests
- OG route returns 200 with valid PNG headers
- Content-Type is `image/png`
- Image dimensions are 1200x630

### Manual Testing Steps
1. Start dev servers: `pnpm dev:app`
2. Visit `/api/og/docs/get-started/overview?title=Overview`
3. Verify image renders correctly
4. Copy a docs page URL, paste into Twitter composer, verify preview
5. Run Facebook Sharing Debugger on a docs URL

## Performance Considerations

- **Edge Runtime**: OG route uses edge runtime for low latency
- **Font Caching**: Google Fonts CDN handles caching; consider caching font ArrayBuffer if needed
- **Image Caching**: Vercel edge caches ImageResponse by default
- **Cache Headers**: Consider adding `Cache-Control: public, max-age=86400` for production

## Migration Notes

- Existing static `og.jpg` remains as ultimate fallback
- Pages with explicit `ogImage` frontmatter still use their custom image
- No database changes required
- Rollback: Revert generateMetadata changes to use `siteConfig.ogImage`

## References

- Research: `thoughts/shared/research/2025-12-24-docs-metadata-end-to-end-flow.md`
- Reference implementation: `tmp/next-forge/docs/app/og/[...slug]/route.tsx`
- Lightfast logo: `packages/ui/src/components/ui/icons.tsx:4-13`
- Docs metadata: `apps/docs/src/app/(docs)/docs/[[...slug]]/page.tsx:203-363`
- Microfrontends config: `apps/console/microfrontends.json`
