# `pscale` — doctor playbook

The only CLI in the doctor's eight that is *expected* to require a fresh install on most developer machines as of 2026-05-14. Mandatory for the approved 2026-05-08 PlanetScale migration; the doctor installs it ahead of the cutover so devs are auth'd before the migration lands.

## What Lightfast uses it for

- Per-worktree PlanetScale branches (`pscale branch create lightfast wt-<hash> --from main`) per the approved migration plan.
- Per-branch password mints (`pscale password create lightfast wt-<hash>`) — the credentials that get injected into `apps/<app>/.vercel/.env.development.local`.
- Org-scoped operations land against the `lightfast` org (verify Phase 3 with `pscale org list` after first auth).

## Probe (read-only)

- **Installed**: `command -v pscale` → green when exit 0. **Currently red on the dev host as of 2026-05-14** (confirmed during research).
- **Version**: `pscale --version` → green when ≥ the version on first install. Record the version after the first successful install on this host and bump the recorded minimum here.
- **Authed**: `pscale auth check` → green when exit 0.
- **Org context**: `pscale org list` → green when stdout includes a row with `lightfast` and the `Current` column is `Yes` (the row is also marked with `*`). Verified live 2026-05-14: this host has exactly one org membership (`lightfast`), so the switch step below is a no-op today but is documented for future multi-org scenarios.

## Install (only when "installed" probe fails)

- macOS: `brew install planetscale/tap/pscale`
- Linux: see https://github.com/planetscale/cli#installation — official binaries via apt repo, GitHub Releases tarball, or `go install`.

After install, re-run the *installed* probe.

## Login (only when "authed" probe fails)

```
pscale auth login
```

Browser sign-in — prints a confirmation code, opens the browser, waits for the callback.

**Non-TTY gotcha (verified 2026-05-14)**: `pscale auth login` refuses to run via Claude Code's `!` shell prefix — it errors with `Error: the 'login' command requires an interactive shell`. pscale at v0.283.0 has no `--device-code` or analogous flag. The agent must instruct the user to:

> Open a separate terminal window (NOT Claude Code's `!` prefix) and run `pscale auth login`. Return when the CLI exits "Successfully logged in."

For headless automation only (CI), use `--service-token` / `--service-token-id` global flags or `--api-token` instead of `auth login` — but that's a CI flow, not a developer-onboarding flow.

After login, re-run the *authed* probe.

## Set org (when org probe shows the wrong current org)

```
pscale org switch lightfast
```

Verified syntax: `pscale org switch <organization>` is a positional arg, no flag. On this host the org is already current (single-org membership), so the switch is a no-op — but the command is documented for the future case where a dev joins additional pscale orgs and needs to flip lightfast back as default. Re-run the org probe.

## Upgrade (only when user requests upgrade)

- macOS: `brew upgrade pscale`
- Linux: package-manager equivalent.

## Known gotchas

- **Per-branch passwords are a migration concern, not a doctor concern.** `pscale password create <db> <branch>` happens during worktree setup, not during onboarding. The doctor only ensures the human is authed against the org so those subsequent commands work.
- **Local-dev latency is real.** The 2026-05-10 local-dev decision research records ~15–40 ms/query latency in dev compared to the previous Postgres setup. The doctor cannot fix this; it's the trade-off for shared-tenant consistency. See `thoughts/shared/research/2026-05-10-db-app-planetscale-local-dev-decision.md`.
- **`pscale auth login` REQUIRES a real TTY.** Verified 2026-05-14: invoking via Claude Code's `!` prefix errors with "the 'login' command requires an interactive shell." This is **stricter** than the other CLIs — pscale at v0.283.0 has no `--device-code`, `--token`, or `--non-interactive` flag for the login flow. The agent must direct the user to a separate terminal window.
- **`pscale org list` slug is lowercase `lightfast`.** Verified live 2026-05-14. Format: `NAME` column shows the slug, `*` and `Current=Yes` mark the active org. Only 1 org row present on this host.

## References

- 2026-05-08 PlanetScale migration plan: `thoughts/shared/plans/2026-05-08-db-app-rework-planetscale-mysql.md`
- 2026-05-10 local-dev decision: `thoughts/shared/research/2026-05-10-db-app-planetscale-local-dev-decision.md`
- Per-worktree branch shape rationale and ~15–40 ms/query latency tax: same research doc above.
