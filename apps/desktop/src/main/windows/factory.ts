import { join } from "node:path";
import {
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  type WebContents,
} from "electron";
import type { WindowKind } from "../../shared/ipc";
import { loadWindowState, trackWindowState } from "../window-state";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Vite emits the main bundle as CJS and Rollup does not polyfill
// `import.meta` — both `.url` and `.dirname` get stripped to `{}.<prop>` =
// undefined, which crashes downstream `fileURLToPath(undefined)`. `__dirname`
// is CJS-native and the only reliable way to get the bundle directory inside
// the asar at runtime.
// biome-ignore lint/correctness/noGlobalDirnameFilename: Vite CJS output strips import.meta.*; __dirname is the only working option here.
const factoryDir = __dirname;
const RENDERER_DIST = join(factoryDir, `../renderer/${MAIN_WINDOW_VITE_NAME}`);

function preloadFileFor(kind: WindowKind): string {
  switch (kind) {
    case "settings":
      return "settings.js";
    case "hud":
      return "hud.js";
    default:
      return "primary.js";
  }
}

function titleBarOverlayColors(): Electron.TitleBarOverlayOptions {
  return {
    color: "transparent",
    height: 46,
  };
}

function baseWindowOptions(): BrowserWindowConstructorOptions {
  const isMac = process.platform === "darwin";
  const isWindows = process.platform === "win32";
  return {
    show: false,
    backgroundColor: "transparent",
    vibrancy: "menu",
    visualEffectState: "active",
    backgroundMaterial: "mica",
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    ...(isWindows && { titleBarOverlay: titleBarOverlayColors() }),
  };
}

function preloadOptions(kind: WindowKind): BrowserWindowConstructorOptions {
  return {
    webPreferences: {
      preload: join(factoryDir, preloadFileFor(kind)),
      sandbox: true,
      contextIsolation: true,
    },
  };
}

function primaryOptions(): BrowserWindowConstructorOptions {
  const isMac = process.platform === "darwin";
  return {
    ...baseWindowOptions(),
    width: 1024,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    ...(isMac && { trafficLightPosition: { x: 16, y: 16 } }),
  };
}

function settingsOptions(): BrowserWindowConstructorOptions {
  const isMac = process.platform === "darwin";
  return {
    ...baseWindowOptions(),
    width: 720,
    height: 640,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    minimizable: true,
    ...(isMac && { trafficLightPosition: { x: 16, y: 16 } }),
  };
}

function hudOptions(): BrowserWindowConstructorOptions {
  const isMac = process.platform === "darwin";
  return {
    ...baseWindowOptions(),
    width: 440,
    height: 320,
    minWidth: 320,
    minHeight: 240,
    alwaysOnTop: true,
    ...(isMac && { trafficLightPosition: { x: 10, y: 10 } }),
  };
}

function optionsForKind(kind: WindowKind): BrowserWindowConstructorOptions {
  switch (kind) {
    case "settings":
      return settingsOptions();
    case "hud":
      return hudOptions();
    default:
      return primaryOptions();
  }
}

function loadRenderer(contents: WebContents, kind: WindowKind): void {
  const hash = kind === "primary" ? "" : `#${kind}`;
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void contents.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}${hash}`);
  } else {
    void contents.loadFile(join(RENDERER_DIST, "index.html"), {
      hash: hash.replace(/^#/, ""),
    });
  }
}

export interface CreateWindowOptions {
  harden?: (contents: WebContents) => void;
  kind: WindowKind;
}

export async function createWindow({
  kind,
  harden,
}: CreateWindowOptions): Promise<BrowserWindow> {
  const savedBounds = await loadWindowState(kind);
  const options: BrowserWindowConstructorOptions = {
    ...optionsForKind(kind),
    ...preloadOptions(kind),
    ...(savedBounds.width && savedBounds.height
      ? {
          width: savedBounds.width,
          height: savedBounds.height,
          ...(typeof savedBounds.x === "number" && { x: savedBounds.x }),
          ...(typeof savedBounds.y === "number" && { y: savedBounds.y }),
        }
      : {}),
  };
  const win = new BrowserWindow(options);
  if (savedBounds.isMaximized) {
    win.maximize();
  }
  trackWindowState(kind, win);
  win.once("ready-to-show", () => win.show());
  harden?.(win.webContents);
  loadRenderer(win.webContents, kind);
  return win;
}

export function applyTitleBarOverlayTheme(win: BrowserWindow): void {
  if (process.platform !== "win32") {
    return;
  }
  win.setTitleBarOverlay(titleBarOverlayColors());
}
