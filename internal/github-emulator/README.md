# GitHub Emulator

Local development harness for the GitHub org binding slice. This package is
dev-only; production runtime code must not import it.

## Run

Start the emulator:

```bash
pnpm --filter @repo/github-emulator dev
```

The server listens on `http://127.0.0.1:4567` by default and prints the
environment values consumed by the app and API packages.

Copy the printed `GITHUB_*` values into:

```text
apps/app/.vercel/.env.development.local
```

Then start the full local stack from the repository root:

```bash
pnpm dev
```

The printed `GITHUB_INSTALL_URL_OVERRIDE` points at the app dev install shim and
includes the deterministic emulator origin, installation id, and provider
account login.

## Configuration

Optional environment variables:

```bash
PORT=4567
LIGHTFAST_APP_ORIGIN=https://app.lightfast.localhost
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
