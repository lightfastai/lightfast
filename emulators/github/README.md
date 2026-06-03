# GitHub Emulator

Local development harness for the GitHub org binding slice. This package is
dev-only; production runtime code must not import it.

Production packages may import `@repo/github-app-contract` and
`@repo/github-app-node`; they must not import `@repo/github-emulator` or files
under `emulators/github`. The emulator is local infrastructure for the same
GitHub-compatible endpoints used by the production-shaped setup flow.

## Run

From the repository root, `pnpm dev` starts the emulator through Portless
alongside app, www, platform, Inngest, QStash, and the MFE proxy:

```bash
pnpm dev
```

The emulator is routed at:

```text
https://github.emulator.localhost
```

Linked worktrees receive the usual Portless branch prefix, for example:

```text
https://feature-x.github.emulator.localhost
```

The consuming app process receives deterministic `GITHUB_*` values at runtime
from its local-dev wrapper. Do not copy worktree-specific emulator URLs into
checked-in env files.

To run only the emulator:

```bash
pnpm --filter @repo/github-emulator dev
```

This runs the raw server process. The root `pnpm dev` flow is responsible for
wrapping it in `portless run --name github.emulator`, matching the Inngest and
QStash dev service pattern.

The app and API receive `GITHUB_APP_ENDPOINT_ORIGIN` from
`pnpm --filter @repo/github-emulator env:sh`. Local setup starts at:

```text
https://github.emulator.localhost/apps/github-emulator/installations/new
```

The emulator redirects to `/api/github/setup`, completes OAuth through
`/login/oauth/authorize` and `/login/oauth/access_token`, and returns
user-accessible installations from `/user/installations`.

## Configuration

Optional environment variables:

```bash
PORT=4567
HOST=127.0.0.1
CALLBACK_URL=https://app.example.test/api/github/setup
PUBLIC_ORIGIN=https://github.emulator.localhost
```

The deterministic seed creates:

- GitHub user `emulator-dev`
- GitHub org `emulator-org`
- Private repo `emulator-org/workspace`
- OAuth app `Iv1.githubemulator`
- GitHub App `github-emulator`
- Org installation `1001`

## Test

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
pnpm --filter @repo/github-emulator typecheck
```
