# @lightfast/codex-sidebar-demo

Electron test app that reproduces the Codex-style native macOS sidebar — a
translucent `NSVisualEffectView`-backed left pane with inset traffic lights.

## Run

```bash
pnpm -F @lightfast/codex-sidebar-demo dev
```

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

Releases are cut by pushing a tag matching `codex-sidebar-demo-v<version>`:

```bash
git tag codex-sidebar-demo-v0.1.0
git push origin codex-sidebar-demo-v0.1.0
```

The `Release codex-sidebar-demo` workflow then:

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
pnpm -F @lightfast/codex-sidebar-demo exec electron-forge package \
  --arch=arm64 --platform=darwin
```

Full sign/notarize/publish locally (requires the same env vars the workflow
sets):

```bash
APPLE_SIGNING_IDENTITY=... APPLE_TEAM_ID=... \
APPLE_API_KEY=$HOME/.private_keys/AuthKey_XXX.p8 \
APPLE_API_KEY_ID=... APPLE_API_ISSUER=... \
CODEX_SIDEBAR_DEMO_RELEASE_REPO=lightfastai/lightfast \
GITHUB_TOKEN=$(gh auth token) \
pnpm -F @lightfast/codex-sidebar-demo exec electron-forge publish \
  --arch=arm64 --platform=darwin
```
