---
date: 2026-04-19T09:41:32Z
researcher: claude
git_commit: ec5dcf5efb06b8511e7af205bacfaf8d97f69833
branch: chore/core-packages-upgrade-phase-d
topic: "Is vendor/lib/src/errors.ts being used anywhere?"
tags: [research, codebase, vendor-lib, dead-code, domain-error]
status: complete
last_updated: 2026-04-19
---

# Research: Is `vendor/lib/src/errors.ts` being used anywhere?

**Date**: 2026-04-19T09:41:32Z
**Git Commit**: ec5dcf5efb06b8511e7af205bacfaf8d97f69833
**Branch**: chore/core-packages-upgrade-phase-d

## Research Question

Consider `@vendor/lib/src/errors.ts` — is this being used anywhere? I don't understand why it's here.

## Summary

`vendor/lib/src/errors.ts` defines a generic `DomainError` base class (plus `DomainErrorOptions` type and `isDomainError` type guard), and is re-exported from the package root at `vendor/lib/src/index.ts:2-3`. **No source file in the repo imports any of these three symbols.** Every consumer of `@vendor/lib` (16 import sites across apps, api, db, packages, and vendor) imports only `nanoid`. The file is a latent export surface carried forward from the old `@repo/lib` grab-bag package; a phase-D cleanup plan already sitting on this branch (`thoughts/shared/plans/2026-04-19-fix-ci-turbo-boundaries-vendor-lib.md`) documents it as zero-consumer dead code at the import boundary.

## Detailed Findings

### The file itself

`vendor/lib/src/errors.ts` (64 lines) exports three symbols:

- `DomainErrorOptions` interface (`vendor/lib/src/errors.ts:4-17`) — options bag with `cause`, `code`, `message`, `metadata`, `requestId`, `status`.
- `DomainError` class (`vendor/lib/src/errors.ts:28-56`) — extends `Error`, sets `name` from `this.constructor.name`, preserves prototype chain via `Object.setPrototypeOf`, provides a `toJSON()` serializer.
- `isDomainError` type guard (`vendor/lib/src/errors.ts:61-63`) — `instanceof DomainError` check.

The module has zero internal dependencies — it only extends the built-in `Error`.

### Package wiring

- `vendor/lib/package.json:7-28` declares the root export `.` pointing at `src/index.ts`, plus four subpath exports (`./pretty-project-name`, `./datetime`, `./uuid`, `./nanoid`). There is **no** `./errors` subpath export — the error symbols reach consumers only through the root barrel.
- `vendor/lib/src/index.ts:2-3` re-exports from `./errors`:
  ```ts
  export type { DomainErrorOptions } from "./errors";
  export { DomainError, isDomainError } from "./errors";
  ```
- No test file exists for `errors.ts` (glob `vendor/lib/src/**/*.test.ts` returns nothing).

### Consumers of the exported symbols

A repo-wide grep for `DomainError`, `isDomainError`, `DomainErrorOptions` returns matches only inside:

- `vendor/lib/src/errors.ts` (the definitions themselves)
- `vendor/lib/src/index.ts` (the re-export)
- `thoughts/shared/plans/2026-04-19-fix-ci-turbo-boundaries-vendor-lib.md` (planning doc)

No `.ts` / `.tsx` source file under `apps/`, `api/`, `db/`, `packages/`, or elsewhere in `vendor/` references `DomainError`, `isDomainError`, or `DomainErrorOptions`.

### Consumers of `@vendor/lib` (for contrast)

All 16 import sites of `@vendor/lib` across the main tree pull in `nanoid` only — none touch the error surface:

- `api/platform/src/lib/oauth/authorize.ts:9`
- `api/platform/src/inngest/functions/health-check.ts:17`
- `vendor/observability/src/trpc.ts:13`
- `packages/app-test-data/src/cli/seed-integrations.ts:16`
- `packages/app-api-key/src/crypto.ts:11`
- `db/app/src/schema/tables/gateway-tokens.ts:1`
- `db/app/src/schema/tables/org-repo-indexes.ts:1`
- `db/app/src/schema/tables/org-integrations.ts:3`
- `db/app/src/schema/tables/org-events.ts:2`
- `db/app/src/schema/tables/gateway-webhook-deliveries.ts:1`
- `db/app/src/schema/tables/gateway-backfill-runs.ts:1`
- `db/app/src/schema/tables/org-entities.ts:2`
- `db/app/src/schema/tables/gateway-installations.ts:4`
- `db/app/src/schema/tables/gateway-lifecycle-log.ts:1`
- `db/app/src/schema/tables/org-entity-edges.ts:1`
- `db/app/src/schema/tables/org-api-keys.ts:1`

Legacy `from "@repo/lib"` import lines (which previously might have pulled the error surface) now only appear inside `thoughts/shared/plans/2026-04-19-fix-ci-turbo-boundaries-vendor-lib.md`; there are no such imports in source files.

## Code References

- `vendor/lib/src/errors.ts:4-17` — `DomainErrorOptions` interface definition.
- `vendor/lib/src/errors.ts:28-56` — `DomainError` class body with constructor and `toJSON`.
- `vendor/lib/src/errors.ts:61-63` — `isDomainError` type guard.
- `vendor/lib/src/index.ts:2-3` — re-export of the three symbols from the package root.
- `vendor/lib/package.json:7-28` — export map (no `./errors` subpath; root barrel only).

## Architecture Documentation

`@vendor/lib` is a vendor-tagged utility package holding small helpers that don't belong to a specific domain:

- `datetime/` (`formatMySqlDateTime`)
- `errors.ts` (`DomainError`, `isDomainError`, `DomainErrorOptions`)
- `nanoid.ts` (`nanoid`)
- `uuid.ts` (`uuidv4`)
- `pretty-project-name.ts` (subpath-only)

The root barrel (`src/index.ts`) re-exports four of these five modules, exposing `formatMySqlDateTime`, `DomainError`/`isDomainError`/`DomainErrorOptions`, `nanoid`, and `uuidv4`. `pretty-project-name` is reachable only via the `./pretty-project-name` subpath export. In practice, actual consumers import `nanoid` exclusively; the remaining exports (`formatMySqlDateTime`, `uuidv4`, the `DomainError` trio, `pretty-project-name`) currently have zero import sites in source files.

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-04-19-fix-ci-turbo-boundaries-vendor-lib.md:27` — documents the full export inventory of `packages/lib/src/index.ts` (the predecessor of `vendor/lib`): 7 logical surfaces including `DomainError`/`isDomainError`/`DomainErrorOptions` under the "errors" grouping.
- `thoughts/shared/plans/2026-04-19-fix-ci-turbo-boundaries-vendor-lib.md:31` — import-site census explicitly flags `DomainError`/`isDomainError` (alongside `uuidv4`, `formatMySqlDateTime`, `friendly-words`, `pretty-project-name`) as having **zero external import sites — dead code at the import boundary**.
- `thoughts/shared/plans/2026-04-19-fix-ci-turbo-boundaries-vendor-lib.md:33` — notes `packages/lib/src/errors.ts` is "fully self-contained (generic `DomainError` base class, 64 lines)" and that it ships to `@vendor/lib` alongside the rest.
- `thoughts/shared/plans/2026-04-19-fix-ci-turbo-boundaries-vendor-lib.md:45` — rejected-alternatives section describes `@repo/lib` as "a grab-bag (`@repo/lib` with crypto + id-gen + errors + datetime sharing a single import surface and package tag)" — i.e., `errors.ts` was one of several unrelated modules bundled under a single utility package.
- `thoughts/shared/plans/2026-04-19-fix-ci-turbo-boundaries-vendor-lib.md:422` — confirms the zero-consumer count: "0 for the other 5 exports (`uuidv4`, `DomainError`, `formatMySqlDateTime`, `friendly-words`, `pretty-project-name` have zero external consumers — latent dead code)."

The file is on disk because `@vendor/lib` is the renamed successor of the former `@repo/lib` grab-bag, and the error surface was carried forward verbatim when the package was re-homed under `vendor/` during the Turbo-boundaries cleanup. Encryption helpers (formerly in the same grab-bag) were split out to `@repo/app-encryption` (plan lines 167-171); the `DomainError` surface was retained in `@vendor/lib` but never re-homed to a consumer package.

## Related Research

- `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-d.md` — phase D plan on the current branch.
- `thoughts/shared/plans/2026-04-19-fix-ci-turbo-boundaries-vendor-lib.md` — full history of the `@repo/lib` → `@vendor/lib` migration and the dead-code inventory.

## Open Questions

None — the question was a direct usage query, fully answered by the grep evidence above.
