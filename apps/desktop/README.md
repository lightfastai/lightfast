# @lightfast/desktop

Lightfast desktop app (Electron). Native-looking macOS sidebar via
`NSVisualEffectView`, Mica on Windows 11, signed + notarized releases.

## Run

```bash
pnpm -F @lightfast/desktop dev
```

## Local development

The desktop app is a Clerk-authenticated tRPC client for the `apps/app` API.
Signed-in requests go through the microfrontends proxy at
`http://localhost:3024`, not directly to `apps/app` (4107) — the tRPC route's
CORS only whitelists the 3024 origin in dev.

### Required env vars

Create `apps/desktop/.env.development` (gitignored) by copying
`apps/desktop/.env.example`. The only required var in dev is
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (used by the main process to compute the
Clerk CSP origin); everything else has sensible defaults documented in the
example file.

### Clerk JWT template (one-time, per Clerk environment)

In the Clerk Dashboard, create a JWT template named exactly `lightfast-desktop`:

- **Name**: `lightfast-desktop`
- **Expiry**: `86400` seconds (24 hours) — users re-sign-in daily. There is no
  silent refresh; when the token expires the renderer's 401 handler clears
  local state and the user clicks "Sign in" again.
- **Claims**: include `org_id: {{org.id}}` so `orgRouter` procedures work
- **Signing**: default (symmetric — the server verifies via `CLERK_SECRET_KEY`)

This must be done once in each Clerk environment (dev and prod). The web
bridge page (`apps/app/src/app/(app)/(user)/(pending-not-allowed)/desktop/auth/page.tsx`)
calls `getToken({ template: "lightfast-desktop" })` — without the template,
sign-in will fail with a 400 from Clerk.

### Sign-in flow (OS browser + loopback callback)

1. User clicks **Sign in with Lightfast** in the desktop app
2. Main process starts an ephemeral HTTP listener on
   `127.0.0.1:<random-port>` and calls `shell.openExternal(...)` to open the
   user's default browser at
   `http://localhost:3024/desktop/auth?state=<hex>&callback=http://127.0.0.1:<port>/callback`
3. Browser completes Clerk sign-in (instant if already signed in to
   lightfast.ai). The bridge page calls `getToken({ template: "lightfast-desktop" })`,
   then redirects the tab to the loopback callback with `?token=…&state=…`
4. The loopback server validates `state`, persists the token via `safeStorage`,
   responds with a "You can close this tab" HTML page, and shuts down
5. Main process broadcasts the new auth snapshot to the renderer; UI flips to
   signed-in

The bridge page only honours `callback` values of the form
`http://127.0.0.1:<port>/callback` or `http://localhost:<port>/callback` —
anything else is rejected.

### Run the stack (two terminals)

```bash
# Terminal 1 — app + www + platform + microfrontends proxy at 3024
pnpm dev:desktop-api

# Terminal 2 — Electron app
pnpm dev:desktop
```

`pnpm dev:full` alone is **not** sufficient — it only boots the Next.js apps
at 4107/4101/4112. The microfrontends proxy at 3024 is a separate process
launched by `dev:desktop-api` via `concurrently`.

### Inspect the encrypted token store

The main process persists the Clerk JWT + refresh cookie via `safeStorage`
into a keychain-backed file:

```bash
# macOS
ls ~/Library/Application\ Support/Lightfast/auth.bin
```

Delete this file to force a fresh sign-in.

## The recipe

Main process (`src/main/index.ts`):

- `vibrancy: "menu"` — macOS `NSVisualEffectView` material
- `visualEffectState: "active"` — stay vibrant when unfocused
- `titleBarStyle: "hiddenInset"` + `trafficLightPosition: { x: 16, y: 16 }`
- `backgroundMaterial: "mica"` — Windows 11 equivalent
- `backgroundColor: "#00000000"` — don't paint an opaque background

Renderer (`src/renderer/src/styles.css`):

- `html, body, #app { background: transparent; }`
- Sidebar container: `background: transparent;`
- `.titlebar-drag { -webkit-app-region: drag; }` on the top strip;
  `-webkit-app-region: no-drag` on buttons.

## Cutting a release

1. Confirm `main` is green.
2. Tag and push:

   ```bash
   git tag '@lightfast/desktop@0.1.0'
   git push origin '@lightfast/desktop@0.1.0'
   ```

3. The `desktop-release.yml` workflow creates a draft release, builds arm64
   + x64 on `macos-14`, notarizes, uploads source maps to Sentry with
   `--url-prefix "app:///"`, generates Squirrel.Mac feed JSON
   (`latest-mac-<arch>.json`), and publishes release assets via
   `electron-forge publish`.
4. The draft is auto-undrafted by the `finalize` job once all assets are
   present.

Tag format is `@lightfast/desktop@<semver>` to match the repo's existing
changesets-style convention (`lightfast@x.y.z`, `@lightfastai/mcp@x.y.z`).

### Required GitHub secrets

| Secret | Contents |
| --- | --- |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Lightfast, Inc. (TEAMID)` |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_CERT_BASE64` | `base64 -i cert.p12 \| pbcopy` of the Developer ID `.p12` |
| `APPLE_CERT_PASSWORD` | Password used to export the `.p12` |
| `KEYCHAIN_PASSWORD` | Any string — used for the ephemeral CI keychain |
| `APPLE_API_KEY_CONTENT` | Full contents of the App Store Connect `.p8` file |
| `APPLE_API_KEY_ID` | 10-char key ID for the above `.p8` |
| `APPLE_API_ISSUER` | App Store Connect issuer UUID |

`GITHUB_TOKEN` is provided automatically — no secret needed.

### Local dry-run

Run the packager locally without publishing:

```bash
pnpm -F @lightfast/desktop exec electron-forge package \
  --arch=arm64 --platform=darwin
```

Full sign/notarize/publish locally (requires the same env vars the workflow
sets):

```bash
APPLE_SIGNING_IDENTITY=... APPLE_TEAM_ID=... \
APPLE_API_KEY=$HOME/.private_keys/AuthKey_XXX.p8 \
APPLE_API_KEY_ID=... APPLE_API_ISSUER=... \
GITHUB_TOKEN=$(gh auth token) \
pnpm -F @lightfast/desktop exec electron-forge publish \
  --arch=arm64 --platform=darwin
```

## Environment

Required/optional env vars are documented in `apps/desktop/.env.example`.
Copy it to `.env.development` and fill in what you need; missing required
vars cause `pnpm dev` / `pnpm package` to fail at startup with a readable
t3-env validation error (see `src/env/main.ts` and `src/env/renderer.ts`).
