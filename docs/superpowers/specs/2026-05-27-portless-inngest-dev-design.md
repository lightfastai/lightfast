# Portless Inngest Dev Design

## Summary

Local Inngest should run behind Portless like the app, www, platform, and
microfrontends proxy. The dev server gets a stable named URL in the primary
checkout and a worktree-prefixed URL in secondary worktrees. App and platform
event sends use the same URL through the Inngest SDK's `INNGEST_DEV` setting.

This keeps `pnpm dev` free of manually pinned Inngest ports while preserving the
existing explicit app and platform serve URL sync model.

## Context

Root `pnpm dev` currently starts:

- `@lightfast/app` through `portless run`;
- `@lightfast/www` through `portless run`;
- `@lightfast/platform` through `portless run`;
- the aggregate microfrontends proxy through `portless run --name lightfast`;
- the Inngest dev server through `npx inngest-cli@latest dev`.

The Inngest process already receives explicit SDK serve URLs:

```text
$(portless get app.lightfast)/api/inngest
$(portless get platform.lightfast)/api/inngest
```

Those URLs are correct because they point directly at the app-owned and
platform-owned Next.js hosts instead of the aggregate microfrontends URL.

The remaining mismatch is that the Inngest dev server itself still uses the
default local address, usually `http://localhost:8288`. That default does not
match the repository's local-dev rule that named services get Portless URLs and
ports are derived per worktree.

## CLI Discovery

`npx inngest@latest` does not expose an executable CLI entrypoint. The runnable
package is `npx inngest-cli@latest`.

The latest CLI checked locally was:

```text
Inngest CLI v1.22.0-334411311
```

The `dev` command supports:

- `--host`;
- `--port`;
- repeated `--sdk-url` / `-u`;
- `--no-discovery`;
- advanced side ports for connect gateway and executor services.

It does not expose a branch, worktree, base URL, or public route flag. Branch
and worktree isolation must come from Portless naming, not Inngest CLI state.

## Goals

- Run the Inngest dev server at a stable Portless URL.
- Preserve per-worktree URL isolation without manually computing hostnames.
- Keep Inngest app sync pointed at concrete app and platform `/api/inngest`
  routes.
- Ensure `inngest.send()` uses the Portless Inngest URL instead of probing the
  default `localhost:8288` dev server.
- Avoid pinned local ports in root scripts.
- Keep production, preview, and cloud Inngest behavior unchanged.

## Non-Goals

- Do not introduce ngrok.
- Do not sync Inngest through `https://lightfast.localhost`.
- Do not pin Inngest to `8288`.
- Do not add branch-specific behavior to Inngest SDK configuration beyond
  Portless-provided URLs.
- Do not change Inngest function IDs, event names, signing keys, or cloud env
  handling.
- Do not redesign local app, platform, www, or microfrontends Portless names.

## Decision

Wrap the root `_inngest` task with Portless:

```text
portless run --name inngest.lightfast sh -c 'npx inngest-cli@latest dev --no-discovery --host "$HOST" --port "$PORT" -u "$(portless get app.lightfast)/api/inngest" -u "$(portless get platform.lightfast)/api/inngest"'
```

The Inngest process binds to the `HOST` and `PORT` injected by Portless. Portless
then serves the UI and API at:

```text
$(portless get inngest.lightfast)
```

App and platform dev processes set:

```text
INNGEST_DEV=$(portless get inngest.lightfast)
```

The Inngest JS SDK treats `INNGEST_DEV` as an explicit dev URL and routes event
sends to that base URL. This is required once the dev server no longer listens
on the default `localhost:8288` address.

## Target Behavior

In the primary checkout, the local services resolve as:

```text
https://app.lightfast.localhost
https://platform.lightfast.localhost
https://www.lightfast.localhost
https://lightfast.localhost
https://inngest.lightfast.localhost
```

In a secondary worktree, Portless adds the sanitized worktree prefix to each
registered name:

```text
https://<wt>.app.lightfast.localhost
https://<wt>.platform.lightfast.localhost
https://<wt>.www.lightfast.localhost
https://<wt>.lightfast.localhost
https://<wt>.inngest.lightfast.localhost
```

No script should construct those URLs manually. Scripts should continue to ask
Portless with `portless get <name>`.

## Environment Wiring

`INNGEST_DEV` must be present in the environment of Next.js dev processes that
send Inngest events.

The narrow required changes are:

- add `INNGEST_DEV=$(portless get inngest.lightfast)` to
  `apps/app/package.json` `with-related-projects`;
- add `INNGEST_DEV=$(portless get inngest.lightfast)` to
  `apps/platform/package.json` `with-related-projects`.

Adding the same variable to `apps/www/package.json` is optional. It improves
symmetry, but it is not required unless www sends events or imports event-sending
code during dev.

`INNGEST_DEV` should not be written into `.vercel/.env.development.local`.
Portless URLs are runtime-derived from the current checkout or worktree. Durable
env files should keep provider credentials, not local route state.

## Error Handling

If the Inngest Portless route is missing when app or platform starts,
`portless get inngest.lightfast` still prints the expected URL. That is
acceptable because Portless names are deterministic. Event sends fail until the
Inngest dev server is reachable, matching the existing behavior when the default
`localhost:8288` dev server is down.

If the Inngest CLI side ports conflict, the CLI can auto-shift connect gateway
and executor ports. A local smoke test showed two Portless-wrapped Inngest dev
servers starting concurrently with side ports reassigned automatically.

## Acceptance Criteria

- `pnpm dev` registers an active `inngest.lightfast` Portless route.
- `curl -k "$(portless get inngest.lightfast)/dev"` returns Inngest dev server
  JSON.
- The Inngest CLI logs include sync attempts for:
  - `$(portless get app.lightfast)/api/inngest`;
  - `$(portless get platform.lightfast)/api/inngest`.
- `inngest.send()` from app dev code targets `$(portless get inngest.lightfast)`
  through `INNGEST_DEV`.
- A secondary worktree gets a separate Inngest URL without manually configured
  ports.
- Production builds and production runtime env remain unchanged.

## Verification Plan

Run the CLI help check when updating the script:

```text
npx --yes inngest-cli@latest dev --help
```

Start the dev stack:

```text
pnpm dev
```

Check Portless registration:

```text
portless list
portless get inngest.lightfast
```

Check the Inngest dev endpoint:

```text
curl -k "$(portless get inngest.lightfast)/dev"
```

Confirm the SDK sees the configured dev URL from a package with `inngest`
available:

```text
INNGEST_DEV="$(portless get inngest.lightfast)" pnpm --filter @api/app exec node --input-type=module -e "const { Inngest } = await import('inngest'); const c = new Inngest({ id: 'lightfast-test' }); console.log(c.sendEventUrl.href)"
```

The printed URL should begin with:

```text
https://inngest.lightfast.localhost/e/
```

or the worktree-prefixed equivalent.

## Risks

The main risk is environment ordering. `INNGEST_DEV` must be evaluated in the
shell that launches `next dev`, not only in the `_inngest` process. Keeping it
inside each app's `with-related-projects` wrapper satisfies that requirement.

A second risk is accidental use of the aggregate microfrontends URL for Inngest
sync. The CLI should continue to sync concrete app and platform serve URLs
because those are the actual Next.js routes that expose `/api/inngest`.

## Implementation Notes

The implementation should be a small package-script change:

- update root `_inngest`;
- update app `with-related-projects`;
- update platform `with-related-projects`;
- optionally update www `with-related-projects` for symmetry.

No application code changes are expected.
