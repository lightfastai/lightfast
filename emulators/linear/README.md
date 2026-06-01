# Linear Emulator

Local development harness for the Linear connector slice. This package is
dev-only; production runtime code must not import it.

## Run

From the repository root, `pnpm dev` starts the emulator through Portless
alongside app, www, platform, Inngest, QStash, GitHub, and the MFE proxy:

```bash
pnpm dev
```

The emulator is routed at:

```text
https://linear.lightfast.localhost
```

The app dev process receives deterministic `LINEAR_*` values from
`@lightfast/app`'s `with-related-projects` wrapper. Do not copy
worktree-specific emulator URLs into `.vercel/.env.development.local`.

To run only the emulator:

```bash
pnpm --filter @repo/linear-emulator dev
```

## Endpoints

- `GET /oauth/authorize`
- `POST /oauth/token`
- `POST /oauth/revoke`
- `GET /viewer`
- `POST /graphql`
- `POST /mcp`
- `POST /failures`
- `POST /reset`

`POST /failures` accepts JSON booleans for `accessTokenExpired`, `refresh`, and
`mcpListTools`. `POST /reset` clears all failure switches.

## Configuration

Optional environment variables:

```bash
PORT=4568
HOST=127.0.0.1
LIGHTFAST_APP_ORIGIN=https://lightfast.localhost
LINEAR_EMULATOR_ORIGIN=https://linear.lightfast.localhost
```

## Test

```bash
pnpm --filter @repo/linear-emulator test -- src/__tests__/server.test.ts
pnpm --filter @repo/linear-emulator typecheck
```
