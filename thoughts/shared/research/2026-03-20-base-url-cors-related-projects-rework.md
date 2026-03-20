---
date: 2026-03-20T00:00:00+00:00
researcher: claude
git_commit: 1624e4222c8acdff8018084f70edc4bd24f96887
branch: feat/memory-service-consolidation
repository: lightfast
topic: "Drop base-url.ts files, simplify CORS via related-projects, 3-project constraint"
tags: [research, codebase, cors, trpc, related-projects, microfrontends, base-url]
status: complete
last_updated: 2026-03-20
---

# Research: Drop base-url.ts, Simplify CORS via Related Projects

**Date**: 2026-03-20
**Git Commit**: `1624e4222c8acdff8018084f70edc4bd24f96887`
**Branch**: `feat/memory-service-consolidation`

## Research Question

Can we drop `apps/www/src/lib/base-url.ts` and `apps/app/src/lib/base-url.ts` in favour of `apps/app/src/lib/related-projects.ts`? Can we simplify the CORS logic in the tRPC routes using `withRelatedProject`? What is the Vercel 3-project constraint and how does the current setup sit against it?

---

## Summary

Both `base-url.ts` files are confirmed dead code — never imported anywhere, already flagged in `knip.json`. They can be deleted with zero risk.

`withRelatedProject` returns a plain `string` (the origin, no trailing slash). The two exports in `related-projects.ts` — `wwwUrl` and `platformUrl` — are also currently unused within `apps/app`, though they are the correct replacement for the hardcoded origin constants inside the tRPC CORS helper.

The current tRPC CORS helper duplicates the same `getAllowedOrigins` function in both `org/[trpc]/route.ts` and `user/[trpc]/route.ts`. It contains three hardcoded `localhost:` ports plus env-var–derived origins for production and preview. All three dev-port origins can be derived from the existing `related-projects.ts` constants plus the app's own dev port.

The Vercel related-projects setup currently ties together 3 Vercel projects: `lightfast-app` (host), `lightfast-www` (microfrontend), and `lightfast-platform` (standalone service). The 3-project maximum is already saturated. There is no room for a fourth.

---

## Detailed Findings

### 1. `base-url.ts` — Dead Code, Safe to Delete

**`apps/www/src/lib/base-url.ts`**
- Exports `createBaseUrl(): string`
- Uses `window.location.origin` client-side; falls back to `NEXT_PUBLIC_VERCEL_ENV`/`NEXT_PUBLIC_VERCEL_URL`/`PORT` on server
- **Zero import sites** anywhere in `apps/www`

**`apps/app/src/lib/base-url.ts`**
- Exports `createBaseUrl(): string` via `createEnvironmentUrl(suffix = "")`
- Uses `env.NODE_ENV === "production"` → `lightfast.ai`; then `env.VERCEL_URL`; then `localhost:${PORT ?? 4107}`
- **Zero import sites** anywhere in `apps/app`

**`knip.json`** (root) explicitly lists both as ignored-exports, confirming they are known-unused:
```json
// knip.json lines 106-107
"apps/www/src/lib/base-url.ts",
"apps/app/src/lib/base-url.ts"
```

### 2. `withRelatedProject` — Return Type and Resolution

Package: `@vercel/related-projects@1.0.1` (catalog-pinned `^1.0.1`).

**Signature** (`dist/with-related-project.d.ts:1`):
```ts
export declare function withRelatedProject(
  { projectName, defaultHost }: { projectName: string; defaultHost: string }
): string;
```

**Resolution logic** (evaluated once at module load):
1. Reads `VERCEL_RELATED_PROJECTS` env var (Vercel injects this at build/runtime)
2. If empty (local dev), returns `defaultHost` immediately
3. For `"production"` env: `https://${project.production.alias ?? project.production.url}` or `defaultHost`
4. For `"preview"` env: `https://${project.preview.customEnvironment ?? project.preview.branch}` or `defaultHost`
5. Anything else (development): returns `defaultHost`

Return is always a bare origin string — e.g. `"https://lightfast.ai"` or `"http://localhost:4101"`. No trailing slash, no path.

### 3. `related-projects.ts` — Current Exports and Values

`apps/app/src/lib/related-projects.ts`

| Export | projectName | Dev defaultHost | Prod/preview value |
|---|---|---|---|
| `wwwUrl` | `lightfast-www` | `http://localhost:4101` | `https://lightfast.ai` |
| `platformUrl` | `lightfast-platform` | `http://localhost:4112` | `https://platform.lightfast.ai` |

`isDevelopment` = `env.NEXT_PUBLIC_VERCEL_ENV !== "production" && !== "preview"`.

Neither `wwwUrl` nor `platformUrl` is imported anywhere in `apps/app/src` — both are currently unused despite being defined.

### 4. `microfrontends.json` — Current Application Set

`apps/app/microfrontends.json` registers exactly **2 applications**:

| App key | packageName | Dev port | Notes |
|---|---|---|---|
| `lightfast-app` | `@lightfast/app` | 4107 | Catch-all default; no routing block |
| `lightfast-www` | `@lightfast/www` | 4101 | 27 marketing paths in `"marketing"` group |

`lightfast-platform` is **not** in `microfrontends.json`. It is a fully standalone Next.js app running at `platform.lightfast.ai` (port 4112 in dev).

### 5. The 3-Project Vercel Constraint

`VERCEL_RELATED_PROJECTS` is populated by Vercel for projects that have been linked via the dashboard. Currently the `apps/app` service links to:
- `lightfast-www` — microfrontend partner (in `microfrontends.json`)
- `lightfast-platform` — standalone service (in `related-projects.ts`)

Total Vercel projects in this group: **3** (app + www + platform). The maximum supported is 3. The ceiling is already reached.

### 6. Current tRPC CORS Logic — Duplication and Hardcodes

Both route files contain an identical `getAllowedOrigins(): Set<string>` function:

- `apps/app/src/app/(trpc)/api/trpc/org/[trpc]/route.ts` lines 21–42
- `apps/app/src/app/(trpc)/api/trpc/user/[trpc]/route.ts` lines 21–42

The logic is:
```ts
const getAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();
  if (env.VERCEL_ENV === "production")  origins.add("https://lightfast.ai");
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) origins.add(`https://${env.VERCEL_URL}`);
  if (env.NODE_ENV === "development") {
    origins.add("http://localhost:4107"); // Console app
    origins.add("http://localhost:3024"); // Microfrontends proxy
    origins.add("http://localhost:4101"); // WWW app
  }
  return origins;
};
```

The dev ports map directly to known constants:
- `4107` = `lightfast-app` dev port (the app itself; defined in `microfrontends.json:8`)
- `4101` = `lightfast-www` dev port (= `wwwUrl` defaultHost from `related-projects.ts`)
- `3024` = microfrontends proxy port (hardcoded only here; not in any config file)

In production/preview, both the app and www are served from the same domain (`lightfast.ai` / the app's preview URL) via the microfrontends mesh, making cross-origin requests same-origin in those environments — CORS headers are functionally only needed in development.

The `setCorsHeaders` helper function is also duplicated identically in both route files (lines 44–67 in each).

---

## Code References

| File | Lines | What |
|---|---|---|
| `apps/app/src/lib/base-url.ts` | 1–61 | Dead-code createBaseUrl — safe to delete |
| `apps/www/src/lib/base-url.ts` | 1–41 | Dead-code createBaseUrl — safe to delete |
| `apps/app/src/lib/related-projects.ts` | 1–21 | wwwUrl + platformUrl via withRelatedProject |
| `apps/app/microfrontends.json` | 1–51 | 2-app microfrontend config (app + www) |
| `apps/app/src/app/(trpc)/api/trpc/org/[trpc]/route.ts` | 21–67 | Duplicated getAllowedOrigins + setCorsHeaders |
| `apps/app/src/app/(trpc)/api/trpc/user/[trpc]/route.ts` | 21–67 | Identical duplicate of above |
| `knip.json` | ~106–107 | base-url.ts files listed as known-unused exports |
| `node_modules/@vercel/related-projects/dist/with-related-project.d.ts` | 1 | Return type: string |

---

## Architecture Documentation

### Microfrontends in Production vs Development

In production (`lightfast.ai`):
- All `lightfast-www` routing paths are proxied from `lightfast.ai` → www service
- All other paths are handled by `lightfast-app` directly
- Both apps share the same origin → tRPC calls from www are **same-origin**, CORS not triggered

In preview:
- The entire site is served under the app's Vercel preview URL
- www is proxied through the same URL
- Same-origin for tRPC calls

In development:
- Two separate dev servers (4107 and 4101)
- Microfrontends proxy at 3024 (when running `pnpm dev:full`)
- tRPC calls from www at 4101 go cross-origin to app at 4107 → CORS required

### `VERCEL_RELATED_PROJECTS` Env Var

This is injected automatically by Vercel's build system for linked projects. It is a JSON array. The `withRelatedProject` function reads it at module-load time — both `wwwUrl` and `platformUrl` are resolved once on first import.

For local development (no Vercel env), `withRelatedProject` always returns `defaultHost`, so `wwwUrl = "http://localhost:4101"` and `platformUrl = "http://localhost:4112"`.

---

## Open Questions

1. **The microfrontends proxy port `3024`** is hardcoded only in the CORS helper — no config file defines it. If it must remain in the allowed list, it needs a named constant somewhere.
2. **Preview CORS**: `withRelatedProject` for `lightfast-www` in preview returns the www service's own preview branch URL, which differs from the app's preview URL (`env.VERCEL_URL`). In practice, microfrontend requests in preview go through the app's preview URL (same-origin), so this might not matter.
3. **`apps/docs`**: Has its own `related-projects.ts` that does NOT use `@vercel/related-projects` — plain ternary. It exports `wwwUrl` and `consoleUrl` and is used in 3 files. This is out-of-scope for this rework but is an inconsistency.
