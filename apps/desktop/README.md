# @lightfast/desktop

Lightfast desktop app (Electron). Native-looking macOS sidebar via
`NSVisualEffectView`, Mica on Windows 11, signed + notarized releases.

## Install (beta)

The desktop app is currently distributed as ad-hoc-signed pre-release builds
while Apple Developer enrollment is in flight. macOS will show an "Apple cannot
verify Lightfast is free of malware" dialog on first launch — this is expected.

1. Download `Lightfast.dmg` from the latest [Pre-release](https://github.com/lightfastai/lightfast/releases?q=prerelease%3Atrue).
   Use `arm64` for Apple Silicon, `x64` for Intel.
2. Drag `Lightfast.app` to `/Applications`.
3. Double-click the app. Click **Done** on the dialog.
4. Open **System Settings → Privacy & Security**. Scroll to the Security
   section and click **Open Anyway** next to Lightfast (visible for ~1 hour
   after the blocked launch).
5. Confirm with Touch ID or your login password.

If the dialog instead reports "damaged and can't be opened", run
`xattr -cr /Applications/Lightfast.app` and try again. (This shouldn't happen
with ad-hoc builds, but is the recovery path if it does.)

When the signed v0.1.0 release ships, beta users **must reinstall manually** —
auto-update is disabled on ad-hoc builds because Squirrel.Mac requires the
new build to match the running app's designated requirement, and ad-hoc DRs
are content-bound (they change with every build).

### Linux

Download the artifact for your distribution and architecture from the latest
[Pre-release](https://github.com/lightfastai/lightfast/releases?q=prerelease%3Atrue):

- **Debian / Ubuntu**: `lightfast_<version>_amd64.deb` (Intel/AMD) or
  `lightfast_<version>_arm64.deb` (ARM)
- **Fedora / RHEL / openSUSE**: `lightfast-<version>.x86_64.rpm` (Intel/AMD) or
  `lightfast-<version>.aarch64.rpm` (ARM)

Install via your package manager:

```bash
# Debian/Ubuntu
sudo apt install ./lightfast_<version>_amd64.deb

# Fedora/RHEL
sudo dnf install ./lightfast-<version>.x86_64.rpm
```

Linux auto-update is not yet wired — re-download manually for new versions.

## Run

```bash
pnpm -F @lightfast/desktop dev
```

## Native module ABI rebuilds

`better-sqlite3` is a native module. Its `.node` binding must match the host's
ABI:

All commands below run from the repo root:

- After `pnpm install` you have a Node-ABI prebuilt —
  `pnpm -F @lightfast/desktop test` works.
- `pnpm -F @lightfast/desktop dev` (electron-forge start) rebuilds in-tree to
  Electron's ABI — `pnpm -F @lightfast/desktop test` will then fail with
  `NODE_MODULE_VERSION` mismatch.
- Run `pnpm -F @lightfast/desktop rebuild:sqlite:node` to flip back to Node ABI
  before testing, `pnpm -F @lightfast/desktop rebuild:sqlite` to flip back to
  Electron ABI before dev/package.

CI runs `pnpm test` before `pnpm package`, so the ordering is already correct
in `desktop-ci.yml`.

If `app.db_v1` ever ends up corrupted between boots, `initDb()` logs and
falls back to defaults; settings are not persisted until the file is removed.
Schema upgrades flow through `PRAGMA user_version` migrations in-place, so
the filename only bumps for ground-up rewrites — routine schema evolution
preserves existing data.

## Local development

The desktop app is a Clerk-authenticated tRPC client for the `apps/app` API.
Signed-in requests go through the portless microfrontends proxy, not directly
to `apps/app`'s internal Next.js port. In the main worktree this is usually
`https://lightfast.localhost`; run `node scripts/with-desktop-env.mjs --print`
from the repo root to see the exact URL for the current worktree.

### Environment

Desktop has no required env vars for normal local development. The `apps/app`
dev server still needs its own `.vercel/.env.development.local`; desktop only
opens the browser bridge served by `apps/app`.

To set operational desktop-only values such as Sentry or remote debugging,
create `apps/desktop/.vercel/.env.development.local` (gitignored) by copying
`apps/desktop/.env.example`. Local dev injects `LIGHTFAST_APP_ORIGIN` through
`scripts/with-desktop-env.mjs`; preview/prod use `https://lightfast.ai`.

```bash
cp apps/desktop/.env.example apps/desktop/.vercel/.env.development.local
```

The `with-env` script (invoked by `pnpm --filter @lightfast/desktop dev`) loads
this file via `dotenv-cli`. Normal desktop dev does not require the file. Set
`LIGHTFAST_APP_ORIGIN` only when you need to override the local app origin
manually.

### Sign-in flow (OAuth + loopback callback)

1. User clicks **Sign in with Lightfast** in the desktop app
2. Main process creates PKCE values, starts an ephemeral HTTP listener on
   `127.0.0.1:<random-port>`, and opens `/oauth/desktop/start`
3. Browser completes Clerk sign-in and the Lightfast web app prompts for the
   organization to bind to the desktop session
4. Clerk redirects to the loopback callback with an authorization code; the main
   process exchanges it at Clerk, finalizes the org binding through
   `/api/oauth/finalize`, and stores the full native session with
   `safeStorage`
5. Main process broadcasts the new auth snapshot to the renderer; UI flips to
   signed-in

No Lightfast API keys or Clerk JWT templates are created for desktop login.

### Run the stack (two terminals)

```bash
# Terminal 1 — app + www + portless microfrontends origin
pnpm dev

# Terminal 2 — Electron app
pnpm --filter @lightfast/desktop dev
```

`pnpm dev` boots `apps/app`, `apps/www`, and the portless-backed
microfrontends origin. The desktop package dev script passes that origin to
Electron as `LIGHTFAST_APP_ORIGIN` through `scripts/with-desktop-env.mjs`;
`node scripts/with-desktop-env.mjs --print` is the developer-visible source of
truth. `pnpm dev` is the root local stack, including platform services.

### Inspect the encrypted session store

The main process persists the Clerk OAuth token set, user metadata, and selected
organization via `safeStorage` into a keychain-backed file:

```bash
# macOS dev build
ls ~/Library/Application\ Support/Lightfast\ Dev/auth.bin

# macOS packaged build
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

Releases are cut by pushing a tag matching `@lightfast/desktop@<version>`:

```bash
git tag @lightfast/desktop@0.1.0
git push origin @lightfast/desktop@0.1.0
```

The `Release desktop` workflow then:

1. Creates a draft GitHub Release for the tag.
2. Builds signed+notarized ZIP and DMG artifacts for both `arm64` and `x64`
   via `electron-forge publish` on `macos-14`.
3. Builds `.deb` and `.rpm` artifacts for both `arm64` and `x64` via
   `electron-forge publish` on `ubuntu-22.04` / `ubuntu-22.04-arm`.
4. Generates `latest-mac-<arch>.json` (Squirrel.Mac feed). Linux auto-update
   is deferred, so no Linux feed is emitted yet — Linux users re-download
   manually for new versions.
5. Undrafts the release.

We ship per-arch artifacts (no universal-binary merge on macOS) — users pick
the matching arch. Rationale: the merge doubles download size, Linux has no
universal concept, and the per-arch `.deb`/`.rpm` packages already encode the
right architecture for `apt`/`dnf`.

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
