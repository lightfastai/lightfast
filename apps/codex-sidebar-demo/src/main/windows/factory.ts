import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  nativeTheme,
  type WebContents,
} from "electron";
import type { WindowKind } from "../../shared/ipc";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const factoryDir = dirname(fileURLToPath(import.meta.url));
const PRELOAD_PATH = join(factoryDir, "preload.js");
const RENDERER_DIST = join(factoryDir, `../renderer/${MAIN_WINDOW_VITE_NAME}`);

function titleBarOverlayColors(): Electron.TitleBarOverlayOptions {
  const isDark = nativeTheme.shouldUseDarkColors;
  return {
    color: "#00000000",
    symbolColor: isDark ? "#ffffff" : "#000000",
    height: 46,
  };
}

function baseWindowOptions(): BrowserWindowConstructorOptions {
  const isMac = process.platform === "darwin";
  const isWindows = process.platform === "win32";
  return {
    show: false,
    backgroundColor: "#00000000",
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
      preload: PRELOAD_PATH,
      sandbox: true,
      contextIsolation: true,
      additionalArguments: [`--window-kind=${kind}`],
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

function secondaryOptions(): BrowserWindowConstructorOptions {
  const isMac = process.platform === "darwin";
  return {
    ...baseWindowOptions(),
    width: 720,
    height: 540,
    minWidth: 480,
    minHeight: 360,
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
    case "secondary":
      return secondaryOptions();
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

export function createWindow({
  kind,
  harden,
}: CreateWindowOptions): BrowserWindow {
  const options: BrowserWindowConstructorOptions = {
    ...optionsForKind(kind),
    ...preloadOptions(kind),
  };
  const win = new BrowserWindow(options);
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
