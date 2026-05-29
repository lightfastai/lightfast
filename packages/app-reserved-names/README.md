# @repo/app-reserved-names

> Reserved organization names for Lightfast Console to prevent URL routing conflicts

## Overview

This package provides reserved organization/team slug names and **O(1) validation** utilities. The current app uses `/:slug` for the Clerk organization/team slug; `workspace-names.json` is legacy data and is not wired into runtime validation.

Reserved organization names prevent conflicts with top-level routes owned by `apps/app`, `apps/www`, and the Vercel Microfrontends config, such as:

- `/api`
- `/sign-in`
- `/pricing`
- `/docs`
- `/pitch-deck`
- `/llms.txt`

## Usage

```typescript
import { organization } from "@repo/app-reserved-names";

organization.check("admin"); // => true
organization.check("pricing"); // => true
organization.check("my-company"); // => false
organization.check("Admin"); // => true
```

The default export exposes the same organization utilities:

```typescript
import reservedNames from "@repo/app-reserved-names";

reservedNames.organization.check("settings"); // => true
```

## API

### `organization.check(slug: string): boolean`

Returns `true` if the organization slug is reserved. Checks are case-insensitive.

### `organization.all: ReadonlyArray<string>`

Array of all reserved organization slugs.

## Reserved Names

### Organization Names (300 total)

Reserved to prevent conflicts with top-level routes (`/{orgSlug}`).

Categories include:

- HTTP status codes
- Protocol paths such as `.well-known`
- Next.js and Vercel internals
- Metadata files such as `robots.txt`, `sitemap.xml`, `manifest.json`, `manifest.webmanifest`, `llms.txt`, and favicon/touch-icon assets
- Auth paths such as `sign-in`, `sign-up`, `oauth`, `sso`, and `callback`
- API paths such as `api`, `api-keys`, `trpc`, `inngest`, and `webhooks`
- App and marketing routes from `apps/app`, `apps/www`, and `apps/app/microfrontends.json`
- Stable docs, legal, content, and blog category slugs from `apps/www/src/content` and `apps/www/src/config/blog-categories.ts`
- Lightfast product surfaces such as `agent`, `automations`, `signals`, `tasks`, `sources`, `runs`, `workflow`, `mcp`, `sdk`, `memory`, and `knowledge-graph`
- Common SaaS and developer-platform names likely to become top-level routes

## Coverage

The package tests scan current route and content sources so new app-owned names are not missed:

- `apps/app/src/app`
- `apps/www/src/app`
- `apps/app/microfrontends.json`
- `apps/www/src/content/{api,docs,legal}`
- `apps/www/src/config/blog-categories.ts`

If a new static route or stable content namespace is added, either add it to `data/organization-names.json` or update the coverage test with an intentional exclusion.

## Current Runtime Usage

`@repo/app-validation` imports `organization.check()` for `clerkOrgSlugSchema`, which is used by team/org creation and rename flows.

No production code currently imports a workspace reserved-name API.
