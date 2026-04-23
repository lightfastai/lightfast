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
