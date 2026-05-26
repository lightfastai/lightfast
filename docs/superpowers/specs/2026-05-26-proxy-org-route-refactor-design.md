# Proxy Org Route Refactor Design

## Context

`apps/app/src/proxy.ts` protects app routes, applies security headers, runs
microfrontend routing, and handles several auth-specific redirects.

The proxy became more complex after the org binding status gate moved into the
proxy. That gate needs to redirect unbound organizations away from product
routes and into `/:slug/tasks/bind`.

To avoid redirecting app-owned routes such as `/account/settings` and the native
OAuth browser handoff route, the proxy added a local reserved route segment list
and then reused that list to build a complex Clerk organization slug pattern.

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
`/oauth/desktop/start`. The matcher is not wrong; it is just too broad to
prove that a request is an organization product route by itself.

## Goals

- Remove proxy-local reserved organization route segments.
- Restore simple Clerk organization route patterns.
- Keep top-level organization URLs such as `/acme` and `/acme/settings`.
- Keep unbound organizations redirected from product routes to
  `/:slug/tasks/bind`.
- Keep settings and bind routes reachable for unbound organizations.
- Keep pending-session OAuth browser handoff routes reachable.
- Rename the native client auth public route surface from `/native-auth` to
  `/oauth`.
- Colocate the OAuth browser page and API route handlers under an
  `(app)/(oauth)` feature boundary.
- Move route-name reservation back to organization slug validation, where it
  belongs.
- Add tests that protect the app-owned route cases that originally motivated
  the reserved-list workaround.

## Non-Goals

- Do not namespace organization URLs under `/org/:slug` or `/teams/:slug`.
- Do not remove Clerk `organizationSyncOptions`.
- Do not redesign the OAuth, PKCE, loopback, or session-finalization semantics.
- Do not move the entire proxy into a new routing framework.
- Do not change unrelated public app URLs.
- Do not rename internal native auth packages or modules unless the
  implementation needs a mechanical cleanup.

## Design

### OAuth Route Naming

The native client auth public route surface should use OAuth vocabulary instead
of exposing the internal `native-auth` name. `native-auth` is still a reasonable
internal package/module name because it describes the client class, but the
browser and API URLs are OAuth handoff URLs.

Use an OAuth feature boundary under the app route group:

```text
apps/app/src/app/(app)/(oauth)/oauth/[client]/start/page.tsx
apps/app/src/app/(app)/(oauth)/oauth/[client]/start/actions.ts
apps/app/src/app/(app)/(oauth)/api/oauth/[client]/config/route.ts
apps/app/src/app/(app)/(oauth)/api/oauth/finalize/route.ts
apps/app/src/app/(app)/(oauth)/api/oauth/_server/...
```

This yields the public route surface:

```text
/oauth/:client/start
/api/oauth/:client/config
/api/oauth/finalize
```

The `(app)` and `(oauth)` folders are organizational only and do not appear in
the URL. Keeping both browser routes and route handlers under `(app)/(oauth)`
makes the OAuth feature boundary visible in the file tree without changing the
route shape.

The OAuth start page is reached after a user is signed in, or after `/sign-in`
redirects back to the handoff URL, so it belongs under the app route group
rather than a standalone public route group. Do not place it under the current
`(app)/(pending-allowed)` group unless that group is first split into separate
auth-admission and UI-shell boundaries. Today `(pending-allowed)/layout.tsx`
adds the authenticated user shell; the OAuth org picker should stay a focused
handoff page instead of inheriting account/org app chrome by accident.

Route handlers under `(app)/(oauth)/api/oauth` do not participate in React
layouts, so the public `/api/oauth/:client/config` endpoint can be colocated
with the browser handoff page without inheriting app UI.

Avoid `/device/*` because this flow is OAuth authorization-code + PKCE with a
native loopback callback, not OAuth Device Authorization Grant. Also avoid
claiming canonical OAuth server routes such as `/oauth/authorize` or
`/oauth/token`; Clerk owns the real OAuth provider endpoints, while this app
owns the handoff and finalization facade.

Proxy matchers should use the real URL paths:

- Public route matcher: `/api/oauth/(.*)`.
- Pending-session browser allowlist: `/oauth(.*)`.
- Native OAuth continuation from auth routes remains based on Clerk's
  `redirect_url` target, not on a proxy-local route-name list.

### Org Route Detection

The proxy should keep its current `createRouteMatcher` gate-chain style instead
of introducing a separate route classification abstraction.

App-owned gates should run before the binding-status gate:

- app-owned API bypasses,
- auth routes,
- public routes,
- pending-session allowed browser routes such as `/account/*` and `/oauth/*`,
- root post-auth routing.

After those gates, the broad `/:slug` and `/:slug/(.*)` matcher can be treated
as the org-product candidate gate. The binding gate should not need a
proxy-local reserved-name list because app-owned routes have already been
handled by their own matchers.

The binding gate should only run when all of these are true:

- Clerk reports an active organization id.
- Clerk reports an active organization slug.
- The request path is for the active organization slug.
- The request matches the broad org product route shape.
- The request is not an org settings route.
- The request is not the org bind task route.
- The session claim says the organization is not bound.

That changes the proxy from reserved-name exclusion to positive proof of active
org context.

Conceptually:

```ts
const isAppOwnedSignedInRoute = createRouteMatcher([
  "/account/(.*)",
  "/oauth(.*)",
]);

function isActiveOrgPath(req: NextRequest, orgSlug: string) {
  const prefix = `/${orgSlug}`;
  return (
    req.nextUrl.pathname === prefix ||
    req.nextUrl.pathname.startsWith(`${prefix}/`)
  );
}

if (
  !isAppOwnedSignedInRoute(req) &&
  orgId &&
  orgSlug &&
  isActiveOrgPath(req, orgSlug) &&
  isOrgProductRoute(req) &&
  !isOrgSettingsRoute(req) &&
  !isOrgBindTaskRoute(req) &&
  bindingStatus !== "bound"
) {
  return NextResponse.redirect(
    new URL(`/${orgSlug}/tasks/bind`, req.url)
  );
}
```

`/account/settings` may still match `/:slug/(.*)`, but it should be handled by
the app-owned signed-in route gate before the binding gate. Organization slug
validation still prevents future app-owned top-level routes from becoming
valid organization slugs.

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

The proxy binding gate will not act on those app-owned routes because they are
handled by explicit app-owned route matchers before the org-product gate.

### Last Active Organization

Last-active-org persistence should use the same active-org path proof as the
binding gate and should not run for app-owned signed-in routes such as
`/account/*` or `/oauth/*`.

### Reserved Names

Route-name reservation belongs in organization slug validation, not proxy
control flow.

The shared package `@repo/app-reserved-names` should include app-owned
top-level route names that must never become organization slugs, including the
OAuth handoff route name introduced by the native OAuth work.

At minimum, align validation with actual app-owned top-level route names:

- `ingest`
- `oauth`

This keeps the product invariant explicit: users cannot create organizations
whose slug collides with app-owned top-level routes.

Do not add `cli` or `desktop` solely because they are native client ids. Under
the new route surface, they are second-level segments in `/oauth/:client/start`,
not top-level app-owned routes.

## Expected Proxy Shape

After the refactor, `proxy.ts` should still own:

- security header application,
- microfrontend middleware before Clerk,
- app-owned API bypasses for routes that own their own auth and CORS,
- auth route redirects,
- pending-session redirects,
- OAuth continuation from signed-in auth routes,
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
- `/oauth/desktop/start` does not redirect for an unbound active org,
- `/api/oauth/finalize` remains public and does not force Clerk browser auth,
- `/docs` or `/docs/get-started` does not redirect for an unbound active org,
- last-active-org persistence still runs for `/acme` when `orgSlug` is `acme`,
- last-active-org persistence does not run for `/different-team` when
  `orgSlug` is `acme`,
- Clerk middleware is configured with simple organization patterns.

Reserved-name package tests should cover:

- `organization.check("oauth")` returns true,
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
2. Add failing route tests for `/oauth/:client/start` and `/api/oauth/*`.
3. Add failing reserved-name tests for missing OAuth top-level route names.
4. Move `native-auth` route files into the `(app)/(oauth)` group and rename
   public paths to `/oauth/*` and `/api/oauth/*`.
5. Update CLI and desktop clients to call the new OAuth route surface.
6. Add an app-owned signed-in route matcher for `/account/*` and `/oauth/*`.
7. Remove proxy-local reserved segment constants and regex construction.
8. Gate binding redirects on the org-product matcher plus active `orgSlug`
   path proof.
9. Restore simple Clerk `organizationPatterns`.
10. Add missing reserved names to `@repo/app-reserved-names`.
11. Run focused app proxy tests and reserved-name/app-validation typechecks.

## Success Criteria

- The proxy has no reserved organization route segment list.
- The Clerk organization pattern is readable and simple.
- The native client auth public route surface is `/oauth/*` and `/api/oauth/*`.
- OAuth browser routes and API route handlers are colocated under
  `(app)/(oauth)`.
- App-owned top-level routes do not trigger org binding redirects.
- Real org routes still trigger binding redirects when unbound.
- Organization slug validation prevents future app-route collisions.
