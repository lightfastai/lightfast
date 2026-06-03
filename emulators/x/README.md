# X Emulator

Local development harness for the X (Twitter) connector slice. This package is
dev-only; production runtime code must not import it.

Built on `@emulators/core` (vercel-labs/emulate) via the shared
`@repo/emulator-kit`. Scoped to an OAuth 2.0 PKCE auth-only slice.

## Run

From the repository root, `pnpm dev` starts the emulator through Portless
alongside app, www, platform, Inngest, QStash, GitHub, Linear, and the MFE
proxy:

```bash
pnpm dev
```

The emulator is routed at:

```text
https://x.example.test
```

The consuming app process receives deterministic `X_*` values from its
local-dev wrapper. Do not copy worktree-specific emulator URLs into checked-in
env files.

To run only the emulator:

```bash
pnpm --filter @repo/x-emulator dev
```

## Endpoints

- `GET /oauth2/authorize` (OAuth 2.0 PKCE, `S256`)
- `POST /oauth2/token` (`authorization_code` + `refresh_token` grants)
- `POST /oauth2/revoke`
- `GET /2/users/me`
- `POST /failures`
- `POST /reset`

`POST /failures` accepts JSON booleans for `accessTokenExpired`, `refresh`, and
`usersMe`. `POST /reset` clears all failure switches.

## Configuration

Optional environment variables:

```bash
PORT=4569
HOST=127.0.0.1
CALLBACK_URL=https://app.example.test/api/connectors/x/mcp
PUBLIC_ORIGIN=https://x.example.test
```

## Test

```bash
pnpm --filter @repo/x-emulator test -- src/__tests__/server.test.ts
pnpm --filter @repo/x-emulator typecheck
```
