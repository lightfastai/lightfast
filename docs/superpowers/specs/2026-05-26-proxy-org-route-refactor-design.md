# Proxy Org Route Refactor Design

## Context

`apps/app/src/proxy.ts` protects app routes, applies security headers, runs
microfrontend routing, and handles several auth-specific redirects.

The proxy became more complex after the org binding status gate moved into the
proxy. That gate needs to redirect unbound organizations away from product
routes and into `/:slug/tasks/bind`.

To avoid redirecting app-owned routes such as `/account/settings` and
`/native-auth/desktop/start`, the proxy added a local reserved route segment
list and then reused that list to build a complex Clerk organization slug
pattern.

## Problem

The current implementation has two sources of complexity:

1. Proxy route side effects identify org routes by parsing the first URL
   segment and subtracting a local reserved-name list.
2. Clerk `organizationSyncOptions` uses a generated negative-lookahead pattern
   instead of the simpler `/:slug` and `/:slug/(.*)` patterns.

The reserved list is also not the same as the shared reserved-name package used
by organization slug validation. That creates drift between "names users cannot
create" and "names the proxy refuses to treat as organization routes".

The important clarification is that `createRouteMatcher` does not know the
Next.js route tree. A matcher like `/:slug/(.*)` matches any top-level path
with a second segment, including `/account/settings` and
`/native-auth/desktop/start`. The matcher is not wrong; it is just too broad to
prove that a request is an organization product route by itself.

## Goals

- Remove proxy-local reserved organization route segments.
- Restore simple Clerk organization route patterns.
- Keep top-level organization URLs such as `/acme` and `/acme/settings`.
- Keep unbound organizations redirected from product routes to
  `/:slug/tasks/bind`.
- Keep settings and bind routes reachable for unbound organizations.
- Keep pending-session native auth browser routes reachable.
- Move route-name reservation back to organization slug validation, where it
  belongs.
- Add tests that protect the app-owned route cases that originally motivated
  the reserved-list workaround.

## Non-Goals

- Do not namespace organization URLs under `/org/:slug` or `/teams/:slug`.
- Do not remove Clerk `organizationSyncOptions`.
- Do not redesign native auth.
- Do not move the entire proxy into a new routing framework.
- Do not change public app URLs.

## Design

### Org Route Detection

The proxy should stop asking "is this first segment not reserved?" and instead
ask "does this first segment equal Clerk's active organization slug?"

The binding gate should only run when all of these are true:

- Clerk reports an active organization id.
- Clerk reports an active organization slug.
- The request has a first path segment.
- The first path segment equals the active organization slug.
- The request matches the broad org product route shape.
- The request is not an org settings route.
- The request is not the org bind task route.
- The session claim says the organization is not bound.

That changes the proxy from reserved-name exclusion to positive proof of active
org context.

Conceptually:

```ts
const firstSegment = getFirstPathSegment(req);
const isActiveOrgRoute =
  Boolean(orgId && orgSlug && firstSegment && orgSlug === firstSegment);

if (
  isActiveOrgRoute &&
  isOrgProductRoute(req) &&
  !isOrgSettingsRoute(req) &&
  !isOrgBindTaskRoute(req) &&
  bindingStatus !== "bound"
) {
  return NextResponse.redirect(
    new URL(`/${firstSegment}/tasks/bind`, req.url)
  );
}
```

`/account/settings` may still match `/:slug/(.*)`, but it will not pass
`orgSlug === "account"` unless the active Clerk org slug is actually `account`.
Organization slug validation must prevent that from being possible.

### Clerk Organization Patterns

Clerk organization sync should return to the simple form:

```ts
organizationSyncOptions: {
  organizationPatterns: ["/:slug", "/:slug/(.*)"],
}
```

This keeps Clerk's URL-based active organization sync behavior for top-level
org URLs without keeping a proxy-local regex.

If a request path is app-owned, Clerk may attempt organization sync and fail to
activate an organization. Clerk documents this as non-terminal: if activation
cannot be performed, the previous active organization remains unchanged and the
page remains responsible for validating access.

The proxy binding gate will not act on those app-owned routes unless the first
segment matches the active org slug.

### Last Active Organization

Last-active-org persistence should use the same positive proof rule.

The current implementation already only persists when the first segment equals
the active org slug. The refactor should preserve that behavior while removing
reserved-name filtering from the helper.

### Reserved Names

Route-name reservation belongs in organization slug validation, not proxy
control flow.

The shared package `@repo/app-reserved-names` should include app-owned top-level
route names that must never become organization slugs, including native auth
route names introduced by the native OAuth work.

At minimum, align validation with the app-owned segments that the proxy was
previously reserving:

- `cli`
- `desktop`
- `ingest`
- `native-auth`

This keeps the product invariant explicit: users cannot create organizations
whose slug collides with app-owned top-level routes.

## Expected Proxy Shape

After the refactor, `proxy.ts` should still own:

- security header application,
- microfrontend middleware before Clerk,
- app-owned API bypasses for routes that own their own auth and CORS,
- auth route redirects,
- pending-session redirects,
- native OAuth continuation from signed-in auth routes,
- root post-auth redirect,
- active-org-only binding redirects.

It should no longer own:

- a proxy-local reserved organization route segment list,
- a generated organization slug negative-lookahead regex,
- reserved-name decisions that duplicate slug validation.

## Testing

Proxy tests should cover:

- unbound active org `/acme` redirects to `/acme/tasks/bind`,
- unbound active org `/acme/workspace` redirects to `/acme/tasks/bind`,
- unbound active org `/acme/settings` does not redirect,
- unbound active org `/acme/tasks/bind` does not redirect,
- `/account/settings` does not redirect for an unbound active org,
- `/native-auth/desktop/start` does not redirect for an unbound active org,
- `/docs` or `/docs/get-started` does not redirect for an unbound active org,
- last-active-org persistence still runs for `/acme` when `orgSlug` is `acme`,
- last-active-org persistence does not run for `/different-team` when
  `orgSlug` is `acme`,
- Clerk middleware is configured with simple organization patterns.

Reserved-name package tests should cover:

- `organization.check("native-auth")` returns true,
- `organization.check("cli")` returns true,
- `organization.check("desktop")` returns true,
- `organization.check("ingest")` returns true,
- `clerkOrgSlugSchema` rejects those slugs.

## Risks

The main risk is assuming all product surfaces can rely on Clerk active org
state after restoring simple organization patterns. The proxy gate itself will
be safe because it checks active-org equality. Any page or tRPC procedure that
uses `ctx.auth.identity.orgId` still depends on Clerk organization sync working
for real org URLs.

The `[slug]/layout.tsx` access check remains important. It verifies membership
by slug and prevents rendering a route for a slug the user cannot access.

## Rollout

1. Add failing proxy tests for app-owned top-level routes under an unbound org.
2. Add failing reserved-name tests for missing native route names.
3. Replace `getOrgRouteSlug` with `getFirstPathSegment`.
4. Remove proxy-local reserved segment constants and regex construction.
5. Gate binding redirects on `orgSlug === firstSegment`.
6. Restore simple Clerk `organizationPatterns`.
7. Add missing reserved names to `@repo/app-reserved-names`.
8. Run focused app proxy tests and reserved-name/app-validation typechecks.

## Success Criteria

- The proxy has no reserved organization route segment list.
- The Clerk organization pattern is readable and simple.
- App-owned top-level routes do not trigger org binding redirects.
- Real org routes still trigger binding redirects when unbound.
- Organization slug validation prevents future app-route collisions.
