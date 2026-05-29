# GitHub Emulator

Local development harness for the GitHub org binding slice. This package is
dev-only; production runtime code must not import it.

## Run

From the repository root, `pnpm dev` starts the emulator through Portless
alongside app, www, platform, Inngest, QStash, and the MFE proxy:

```bash
pnpm dev
```

The emulator is routed at:

```text
https://github.lightfast.localhost
```

Linked worktrees receive the usual Portless branch prefix, for example:

```text
https://feature-x.github.lightfast.localhost
```

The app dev process receives the deterministic `GITHUB_*` values at runtime
from `@lightfast/app`'s `with-related-projects` wrapper. Do not copy
worktree-specific emulator URLs into `.vercel/.env.development.local`.

To run only the emulator:

```bash
pnpm --filter @repo/github-emulator dev
```

This runs the raw server process. The root `pnpm dev` flow is responsible for
wrapping it in `portless run --name github.lightfast`, matching the Inngest and
QStash dev service pattern. The printed `GITHUB_INSTALL_URL_OVERRIDE` points at
the app dev install shim and includes the deterministic emulator origin,
installation id, and provider account login.

## Configuration

Optional environment variables:

```bash
PORT=4567
HOST=127.0.0.1
LIGHTFAST_APP_ORIGIN=https://lightfast.localhost
GITHUB_EMULATOR_ORIGIN=https://github.lightfast.localhost
```

The deterministic seed creates:

- GitHub user `lightfast-dev`
- GitHub org `lightfast-emulated`
- Private repo `lightfast-emulated/workspace`
- OAuth app `Iv1.lightfastlocal`
- GitHub App `lightfast-local`
- Org installation `1001`

## Test

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
pnpm --filter @repo/github-emulator typecheck
```
