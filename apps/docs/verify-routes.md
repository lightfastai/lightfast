# Documentation Restructure Verification

## Changes Made

### 1. Content Structure
- ✅ Created new API content source at `/src/content/api/`
- ✅ Moved all API reference content from `/src/content/docs/api-reference/` to `/src/content/api/`
- ✅ Updated `source.config.ts` to define both `docs` and `apiDocs` sources
- ✅ Updated `src/lib/source.ts` to export both `docsSource` and `apiSource`

### 2. App Routes
- ✅ Created `/app/api-reference/` route structure for API docs
- ✅ Added `/app/api-reference/layout.tsx` using `apiPageTree`
- ✅ Added `/app/api-reference/[[...slug]]/page.tsx` for API pages
- ✅ Created `/app/api-reference/search/route.ts` for API search

### 3. URL Rewrites
- ✅ Added rewrite in `next.config.ts`: `/api/*` → `/api-reference/*`
- This allows URLs like `/api/overview` to be served from the `/api-reference/` route

### 4. Updated Links
- ✅ Updated all links in `/src/content/api/overview.mdx` from `/api-reference/` to `/api/`
- ✅ Updated redirect in `/app/docs/api/page.tsx` to point to `/api-reference/overview`
- ✅ Updated `generate-api-docs.ts` script to output to `/src/content/api`

### 5. Navigation
- ✅ Removed `api-reference` from `/src/content/docs/meta.json`
- ✅ API has its own `meta.json` at `/src/content/api/meta.json`

## URL Structure

### Documentation URLs
- `/docs` → redirects to `/docs/get-started/overview`
- `/docs/get-started/overview` → Get Started page
- `/docs/core-concepts` → Core concepts documentation
- `/docs/agent-development` → Agent development guides

### API Reference URLs (with rewrites)
- `/api` → redirects to `/api/overview`
- `/api/overview` → API Overview page
- `/api/authentication` → Authentication guide
- `/api/memory/searchMemories` → Search endpoint documentation
- `/api/memory/addMemory` → Add memory endpoint documentation
- `/api/errors` → Error handling documentation
- `/api/sdks` → SDK documentation

## File Structure

```
apps/docs/
├── src/
│   ├── app/
│   │   ├── docs/           # Documentation pages
│   │   │   ├── [[...slug]]/
│   │   │   │   └── page.tsx
│   │   │   ├── api/
│   │   │   │   └── page.tsx (redirect to /api/overview)
│   │   │   └── layout.tsx
│   │   ├── api-reference/  # API reference pages (served as /api via rewrite)
│   │   │   ├── [[...slug]]/
│   │   │   │   └── page.tsx
│   │   │   ├── search/
│   │   │   │   └── route.ts
│   │   │   └── layout.tsx
│   │   └── api/            # Next.js API routes
│   │       └── search/
│   │           └── route.ts
│   ├── content/
│   │   ├── docs/           # Documentation content
│   │   │   ├── get-started/
│   │   │   ├── index.mdx
│   │   │   └── meta.json
│   │   └── api/            # API reference content
│   │       ├── overview.mdx
│   │       ├── authentication.mdx
│   │       ├── memory/
│   │       │   ├── searchMemories.mdx
│   │       │   ├── addMemory.mdx
│   │       │   └── ...
│   │       ├── errors.mdx
│   │       ├── sdks.mdx
│   │       └── meta.json
│   └── lib/
│       └── source.ts       # Exports docsSource and apiSource
├── source.config.ts        # Defines docs and apiDocs sources
└── next.config.ts          # Contains /api/* → /api-reference/* rewrite
```

## Testing Commands

To verify the structure works:

1. **Build the docs app:**
   ```bash
   cd apps/docs
   pnpm build
   ```

2. **Start the dev server:**
   ```bash
   pnpm dev
   ```

3. **Test URLs:**
   - Visit `http://localhost:3000/docs` → Should show documentation
   - Visit `http://localhost:3000/api` → Should show API reference
   - Visit `http://localhost:3000/api/memory/searchMemories` → Should show search endpoint docs

4. **Run the test script:**
   ```bash
   cd apps/docs
   npx tsx test-api-structure.ts
   ```

## Notes

- The `/api` URL path works through Next.js rewrites, not by having an actual `/app/api` folder
- This avoids conflicts with Next.js API routes which traditionally live in `/api`
- Both documentation and API reference have separate search endpoints
- The structure maintains clean separation between docs and API reference content