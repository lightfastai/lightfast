---
date: 2026-05-06
researcher: claude
git_commit: bf1699fa5
branch: fix/coderabbit-pr614-followup
topic: Desktop /api/desktop/auth/exchange POST fails TLS verification against portless dev mesh
tags: [desktop, auth, portless, tls, dev-experience]
status: open
related_pr: 627
related_plans:
  - thoughts/shared/plans/2026-05-06-pr627-merge-readiness.md
---

# Desktop exchange POST + portless TLS — DX follow-up

Surfaced during PR 627 post-merge live verification on 2026-05-06.

## Symptom

`pnpm dev:desktop` (agent mode or interactive) signs the user in via the browser, dispatches `lightfast-dev://auth/callback?code=...&state=...`, the desktop receives it, then emits `auth_signin_failed{reason:"exchange_failed"}`. The `/api/desktop/auth/exchange` POST never reaches the dev:app server.

## Cause

Electron main's global `fetch` is Node's undici. It uses Node's bundled CA list, which does not include the portless local root at `~/.portless/ca.pem`. Direct repro:

```
node -e 'fetch("https://lightfast.localhost/api/desktop/auth/exchange",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}).then(r=>console.log(r.status)).catch(e=>console.error(e.code,e.cause?.code))'
# → undefined SELF_SIGNED_CERT_IN_CHAIN
```

`curl` and Chromium succeed because they trust the macOS keychain (where portless installs the root). Node does not.

## Why it bit PR 627

Commit `ad7d1641e` (PR 627) migrated `exchangeCode` from the legacy `http://localhost:3024` (no TLS) to `createAppUrl("/api/desktop/auth/exchange")` → `https://lightfast.localhost/...`. Sign-in URL composition (`createAppUrl(...)`) was already on portless but goes through Chromium (browser dispatch), not Node.

The previous "Re-verified end-to-end with no LIGHTFAST_API_URL set" claim in `ad7d1641e` must have run with `NODE_EXTRA_CA_CERTS` exported in the shell. Without that env var, the exchange POST silently fails on every fresh dev shell.

## Workaround (today)

```sh
NODE_EXTRA_CA_CERTS="$HOME/.portless/ca.pem" pnpm dev:desktop
```

Verified end-to-end on `bf1699fa5`: `auth_signed_in` event, token persisted to `auth.bin` (851 bytes).

## Durable fixes (pick one)

1. **`scripts/with-desktop-env.mjs` auto-injection.** When `LIGHTFAST_APP_ORIGIN` resolves to a `*.localhost` host AND `~/.portless/ca.pem` exists, set `NODE_EXTRA_CA_CERTS` on the spawned env. Easiest, narrowest blast radius. Doesn't touch desktop source. Does not help if a future Node-fetch call uses a different cert path.
2. **Switch `auth-flow.ts:248` to Electron's `net.fetch`.** `net.fetch` from `electron`'s `net` module routes through Chromium's networking, which honors the macOS keychain — same trust path the bridge already uses. Architecturally correct (Electron-native), but slightly more invasive: changes return-type semantics in subtle ways and may need test adjustments.

Recommendation: option 2 longer-term, option 1 as immediate unblock if option 2 proves disruptive in tests.

## Out of scope

Production builds use real public certs (Let's Encrypt or platform CA), so this is a dev-only path. Packaged Electron releases are unaffected.
