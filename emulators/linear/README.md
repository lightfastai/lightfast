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
https://linear.example.test
```

The consuming app process receives deterministic `LINEAR_*` values from its
local-dev wrapper. Do not copy worktree-specific emulator URLs into checked-in
env files.

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
PUBLIC_ORIGIN=https://linear.example.test
```

## Test

```bash
pnpm --filter @repo/linear-emulator test -- src/__tests__/server.test.ts
pnpm --filter @repo/linear-emulator typecheck
```
