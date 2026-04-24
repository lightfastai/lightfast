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

### Required env var

Create `apps/desktop/.env.development` (gitignored):

```
VITE_LIGHTFAST_API_URL=http://localhost:3024
```

Vite injects this into the renderer as `import.meta.env.VITE_LIGHTFAST_API_URL`
and `DesktopTRPCProvider` uses it to build the tRPC client.

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
pnpm dev:full

# Terminal 2 — Electron app
pnpm dev:desktop
```

`pnpm dev:full` boots all three Next.js apps (4107/4101/4112) and the
microfrontends proxy at 3024 — Turbo 2.9's built-in microfrontends
integration auto-injects the proxy task alongside `@lightfast/app#dev`.

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

## Release

Releases are cut by pushing a tag matching `desktop-v<version>`:

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

The `Release desktop` workflow then:

1. Creates a draft GitHub Release for the tag.
2. Builds signed+notarized ZIP and DMG artifacts for both `arm64` and `x64`
   via `electron-forge publish` on `macos-14`.
3. Generates `latest-mac-<arch>.json` (Squirrel.Mac feed format) and uploads
   them to the release. The app's updater points at
   `releases/latest/download/latest-mac-${arch}.json`.
4. Undrafts the release.

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
LIGHTFAST_DESKTOP_RELEASE_REPO=lightfastai/lightfast \
GITHUB_TOKEN=$(gh auth token) \
pnpm -F @lightfast/desktop exec electron-forge publish \
  --arch=arm64 --platform=darwin
```
