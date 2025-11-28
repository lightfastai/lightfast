# @repo/console-reserved-names

> Reserved workspace and organization names for Lightfast Console to prevent URL routing conflicts

## Overview

This package provides lists of reserved names and **O(1) validation** utilities to prevent workspace and organization names from conflicting with application routes.

**URL Pattern:** `/{orgSlug}/{workspaceName}`

Reserved names prevent conflicts with routes like:
- `/{orgSlug}/settings`
- `/{orgSlug}/api`
- `/{orgSlug}/new`

## Installation

```bash
pnpm add @repo/console-reserved-names
```

## Usage

### Workspace Names

```typescript
import { workspace } from '@repo/console-reserved-names';

// Check if a name is reserved (O(1) lookup)
workspace.check('settings'); // => true
workspace.check('my-project'); // => false

// Case-insensitive check
workspace.check('Settings'); // => true
workspace.check('SETTINGS'); // => true

// Most names are allowed
workspace.check('my-project'); // => false
workspace.check('gist'); // => false
workspace.check('404'); // => false

// Get all reserved names (258 total)
workspace.all;
// => ['300', '301', '302', ... 'wiki', 'wikis', 'workspace', 'workspaces', 'www']
```

### Organization Names

```typescript
import { organization } from '@repo/console-reserved-names';

// Check if an org slug is reserved (O(1) lookup)
organization.check('admin'); // => true
organization.check('my-company'); // => false

// Get all reserved organization names (225 total)
organization.all;
// => ['300', '301', '302', ... 'wiki', 'wikis', 'workspace', 'workspaces', 'www']
```

### Main Export (All Types)

```typescript
import reservedNames from '@repo/console-reserved-names';

reservedNames.workspace.check('settings'); // => true
reservedNames.organization.check('admin'); // => true
```

## API

### `workspace.check(name: string): boolean`

Returns `true` if the workspace name is reserved (case-insensitive).

**Time Complexity:** O(1) - Uses Set-based lookup for optimal performance.

### `workspace.all: ReadonlyArray<string>`

Array of all reserved workspace names (sorted alphabetically).

### `organization.check(slug: string): boolean`

Returns `true` if the organization slug is reserved (case-insensitive).

**Time Complexity:** O(1) - Uses Set-based lookup for optimal performance.

### `organization.all: ReadonlyArray<string>`

Array of all reserved organization slugs (sorted alphabetically).

## Reserved Names

### Organization Names (225 total)

Reserved to prevent conflicts with top-level routes (`/{orgSlug}`):

**Categories:**

- **HTTP status codes** (47): All standard codes (300-511) for error pages and redirects
  - **Critical**: `404`, `500`, `401`, `403` prevent org names like `app.com/404`
- **Protocol reserved**: `.well-known` (SSL, ACME, OpenID)
- **Framework internals**: `_next`, `_vercel`, `middleware`, `instrumentation`, `proxy`
- **Metadata files**: `robots.txt`, `sitemap.xml`, `sitemap`, `manifest.json`, `manifest`, `favicon.ico`, `icon`, `opengraph-image`
- **Authentication**: `auth`, `authorization`, `login`, `logout`, `sign-in`, `sign-up`, `signin`, `signout`, `signup`, `oauth`, `sso`, `sso-callback`, `callback`, `sessions`, `register`
- **API routes**: `api`, `trpc`, `webhooks`, `health`, `inngest`, `github`, `functions`, `serverless`, `edge`, `services`
- **User management**: `account`, `user`, `users`, `username`, `staff`, `onboarding`, `profile`, `identity`, `anonymous`, `suspended`
- **Organization**: `organizations`, `orgs`, `teams`, `workspace`, `workspaces`, `members`, `network`
- **Dashboard & UI**: `dashboard`, `settings`, `notifications`, `inbox`, `feed`
- **Marketing**: `about`, `blog`, `changelog`, `features`, `pricing`, `use-cases`, `early-access`, `company`, `community`, `customers`, `partners`, `press`, `careers`
- **Documentation**: `docs`, `documentation`, `help`, `support`, `developer`, `developers`, `guides`, `guide`, `learn`, `education`, `training`, `readme`
- **Legal**: `legal`, `privacy`, `terms`, `tos`
- **Admin**: `admin`, `new`, `system`
- **Payments**: `billing`, `checkout`, `upgrade`, `subscribe`
- **Content & Discovery**: `search`, `explore`, `discover`, `news`, `events`, `feedback`, `trending`, `featured`, `popular`, `topics`, `timeline`
- **Version Control**: `branches`, `commits`, `commit`, `diff`, `pulls`, `issues`, `wiki`, `wikis`, `repositories`, `compare`
- **Community**: `discussions`, `comments`, `contributing`, `sponsors`, `stars`, `starred`, `pages`
- **Infrastructure**: `static`, `public`, `cdn`, `cache`, `storage`, `assets`, `images`, `files`, `raw`, `blob`, `data`
- **Status & Errors**: `status`, `health`, `error`, `not-found`, `preview`, `monitoring`, `analytics`
- **Apps**: `console`, `chat`, `cloud`, `www`, `marketplace`, `integrations`, `jobs`, `share`, `shop`, `code`, `app`, `apps`
- **Actions**: `deploy`, `deployment`, `deployments`, `releases`, `compare`
- **Downloads**: `download`, `downloads`, `attachments`
- **Versioning**: `v` (for API versioning like `/v1`, `/v2`)
- **Security**: `security`, `abuse`
- **Miscellaneous**: `home`, `info`, `join`, `logs`, `toolbar`, `eval`, `projects`, `resources`, `updates`, `none`, `undefined`

**Philosophy:** Maximum prevention. Reserve all routes that:
1. Currently exist in your microfrontends configuration
2. Are standard across platforms (GitHub, Vercel, Stripe, AWS Console)
3. Are Next.js 15 framework internals and conventions
4. Are Vercel platform-specific (toolbar, preview, analytics)
5. Are common SaaS patterns likely to be added
6. Are protocol-level reserved (`.well-known`, metadata files)

### Workspace Names (258 total)

Reserved to prevent conflicts with organization-level routes under `/{orgSlug}/{workspaceName}`:

**Categories:**

- **HTTP status codes** (47): All standard codes (300-511) for error pages and redirects
- **Protocol reserved**: `.well-known` (SSL, ACME, OpenID)
- **Framework internals**: `_next`, `_vercel`, `middleware`, `instrumentation`, `proxy`
- **Metadata files**: `robots.txt`, `sitemap.xml`, `sitemap`, `manifest.json`, `manifest`, `favicon.ico`, `icon`, `opengraph-image`
- **Settings & management**: `settings`, `general`, `config`, `configuration`, `admin`, `overview`, `dashboard`
- **Team management**: `members`, `people`, `team`, `teams`, `users`, `contributors`, `collaborators`, `permissions`
- **Security & access**: `security`, `audit`, `api-keys`, `tokens`, `secrets`, `variables`, `authorization`
- **Development**: `api`, `api-reference`, `trpc`, `webhooks`, `environments`, `deployments`, `functions`, `serverless`, `edge`
- **Code hosting** (GitHub-style): `blob`, `raw`, `branches`, `commits`, `compare`, `pull`, `pulls`, `releases`, `issues`, `wiki`, `code`, `repos`, `repositories`
- **GitHub integration**: `github`, `install-app`, `user-authorized`, `connected`
- **Integrations**: `integrations`, `apps`, `inngest`, `sources`
- **Monitoring**: `logs`, `metrics`, `monitoring`, `analytics`, `reports`, `status`, `health`, `eval`
- **Financial**: `billing`, `checkout`, `cancelled`, `success`, `upgrade`, `pricing`, `subscribe`
- **Content**: `docs`, `documentation`, `blog`, `changelog`, `search`, `files`, `library`, `archive`, `feed`
- **Communication**: `chat`, `comments`, `discussions`, `notifications`, `inbox`, `feedback`
- **Actions**: `new`, `upload`, `share`, `join`, `actions`, `deploy`, `deployment`
- **Infrastructure**: `static`, `public`, `cdn`, `cache`, `storage`, `assets`, `images`, `data`
- **Auth**: `auth`, `login`, `logout`, `sign-in`, `sign-up`, `signin`, `signout`, `signup`, `oauth`, `sso`, `sso-callback`, `callback`, `sessions`, `register`
- **Navigation**: `home`, `about`, `contact`, `help`, `support`, `events`, `explore`, `info`
- **User management**: `account`, `user`, `staff`, `onboarding`
- **Organization**: `organizations`, `orgs`, `workspace`, `workspaces`
- **Legal**: `legal`, `privacy`, `terms`, `tos`
- **Special pages**: `error`, `not-found`, `jobs`, `marketplace`, `projects`, `hooks`, `lib`, `toolbar`, `preview`, `history`
- **Versioning**: `v` (for API versioning)
- **Security**: `abuse`, `enterprise`
- **Development tools**: `developer`, `developers`, `company`, `community`, `early-access`

**Philosophy:** Comprehensive protection. Reserve all routes that:
1. Exist in current console app structure (`/{orgSlug}/{workspaceName}/...`)
2. Match GitHub integration routes (`install-app`, `user-authorized`, `connected`)
3. Are standard in developer platforms (GitHub, GitLab, Bitbucket)
4. Are HTTP status codes (prevent confusing URLs)
5. Are Next.js 15 and Vercel platform conventions
6. Are common SaaS patterns (billing, settings, teams, monitoring)
7. Are protocol-level reserved (`.well-known`, metadata files)
8. Are likely future features based on console product roadmap

### Adding More Reserved Names

As your app grows and you add new routes, simply add them to the JSON files (keep alphabetically sorted):

```bash
# packages/console-reserved-names/data/organization-names.json
["_next", "_vercel", "about", "account", "admin", ..., "www"]

# packages/console-reserved-names/data/workspace-names.json
["300", "301", ..., "wiki", "www"]
```

Then rebuild:
```bash
pnpm --filter @repo/console-reserved-names build
```

**When to add:**
- Adding a new top-level route like `/foo` → add `foo` to organization-names.json
- Adding a new org-level route like `/{orgSlug}/bar` → add `bar` to workspace-names.json

## Performance

This package uses **Set-based O(1) lookups** for optimal performance:

```typescript
// 100,000 lookups in ~3ms
for (let i = 0; i < 100000; i++) {
  workspace.check('settings');
}
```

**Why Sets?**
- O(1) lookups vs O(n) array includes
- Case-insensitive via lowercase normalization
- Minimal memory overhead (<1KB)

## Why?

### Microfrontends Routing Protection

**Critical**: With Vercel microfrontends, certain paths are handled by specific apps:

```json
// From apps/console/microfrontends.json
{
  "lightfast-www": {
    "paths": ["/", "/pricing", "/features", "/blog", "/changelog", ...]
  },
  "lightfast-auth": {
    "paths": ["/sign-in", "/sign-up"]
  },
  "lightfast-console": {
    "fallback": "app.lightfast.ai"  // Handles all other routes including /{orgSlug}
  }
}
```

**Without organization name protection:**
```
❌ User creates org named "pricing"
❌ app.com/pricing → routes to org dashboard (WRONG!)
❌ Should route to: www app's pricing page
```

**With organization name protection:**
```
✅ "pricing" is reserved
✅ app.com/pricing → www app's pricing page (CORRECT!)
✅ app.com/my-org → console app (org allowed)
```

### Workspace Name Protection

Without reserved names, users could create workspaces that conflict with org-level routes:

```
# Without reserved names (CONFLICT!)
/{orgSlug}/settings  <- User's workspace named "settings"
/{orgSlug}/settings  <- App's settings page

# With reserved names (SAFE)
/{orgSlug}/my-settings  <- User's workspace (allowed)
/{orgSlug}/settings     <- App's settings page (reserved)
```

## Design Decisions

### Why So Aggressive?

Based on research of GitHub's approach (400+ reserved names) and Vercel's patterns, we chose an aggressive strategy:

1. **Prevent future conflicts**: Reserve routes we're likely to add (billing, teams, etc.)
2. **Standard patterns**: Match what users expect from GitHub, Vercel, GitLab
3. **HTTP codes**: Prevent edge cases where users might name workspaces "404"
4. **Framework internals**: Protect Next.js reserved routes (`_next`, etc.)

### Why Include HTTP Status Codes in BOTH Organization and Workspace Names?

**Organization Names**: Prevents `app.com/404` from routing to an org instead of your 404 error page.

Without this protection:
```
❌ User creates org named "404"
❌ app.com/404 → routes to org "404" dashboard
❌ Actual 404 errors can't be displayed at /404
```

With protection:
```
✅ "404" is reserved
✅ app.com/404 → your 404 error page
✅ Users must choose names like "error-404" or "not-found"
```

**Workspace Names**: Prevents `app.com/myorg/500` from routing to workspace instead of error handling.

Both levels need protection because:
- **Top-level** (`/404`): Org names conflict with global error pages
- **Nested** (`/myorg/404`): Workspace names conflict with org-level error pages
- **Consistency**: Users expect `/404` and `/myorg/404` to behave similarly
- **SEO**: Search engines flag numeric paths as error codes
- **Support**: Prevents confusing tickets like "Why can't I access my '500' workspace?"

### Comparison to Other Platforms

| Platform | Organization Names | Workspace/Project Names |
|----------|-------------------|------------------------|
| **GitHub** | ~400+ | ~400+ |
| **Vercel** | ~50-100 (estimated) | ~50-100 (estimated) |
| **Lightfast** | 225 | 258 |

We're more aggressive than Vercel but more focused than GitHub.

## Related

- `@repo/console-validation` - Zod schemas that use these reserved names
- [github-reserved-names](https://github.com/Mottie/github-reserved-names) - Inspiration and reference
- [GitHub Reserved Usernames Docs](https://docs.github.com/en/enterprise-server/admin/managing-accounts-and-repositories/managing-users-in-your-enterprise/about-reserved-usernames-for-github-enterprise-server)

## License

MIT
