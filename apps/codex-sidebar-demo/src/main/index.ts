import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  session,
  shell,
} from "electron";
import contextMenu from "electron-context-menu";
import { IpcChannels, type SystemThemeVariant } from "../shared/ipc";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const __dirname = dirname(fileURLToPath(import.meta.url));

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function currentThemeVariant(): SystemThemeVariant {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function buildContentSecurityPolicy(): string {
  const devServer = MAIN_WINDOW_VITE_DEV_SERVER_URL;
  if (devServer) {
    const origin = new URL(devServer).origin;
    const wsOrigin = origin.replace(/^http/, "ws");
    return [
      `default-src 'self' ${origin}`,
      `script-src 'self' 'unsafe-inline' ${origin}`,
      `style-src 'self' 'unsafe-inline' ${origin}`,
      `connect-src 'self' ${origin} ${wsOrigin}`,
      `img-src 'self' data: blob: ${origin}`,
      `font-src 'self' data: ${origin}`,
    ].join("; ");
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
  ].join("; ");
}

function applyContentSecurityPolicy(): void {
  const csp = buildContentSecurityPolicy();
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });
}

function hardenContents(contents: Electron.WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
        void shell.openExternal(url);
      }
    } catch {
      // ignore malformed urls
    }
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    const rendererOrigin = MAIN_WINDOW_VITE_DEV_SERVER_URL
      ? new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin
      : null;
    try {
      const target = new URL(url);
      if (rendererOrigin && target.origin === rendererOrigin) {
        return;
      }
      if (target.protocol === "file:") {
        return;
      }
      event.preventDefault();
      if (ALLOWED_EXTERNAL_PROTOCOLS.has(target.protocol)) {
        void shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });
}

function createWindow(): BrowserWindow {
  const isMac = process.platform === "darwin";
  const isWindows = process.platform === "win32";

  const win = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    show: false,
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    ...(isMac && { trafficLightPosition: { x: 16, y: 16 } }),
    ...(isWindows && {
      titleBarOverlay: {
        color: "#00000000",
        symbolColor: "#ffffff",
        height: 46,
      },
    }),
    vibrancy: "menu",
    visualEffectState: "active",
    backgroundMaterial: "mica",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      sandbox: true,
      contextIsolation: true,
      additionalArguments: ["--window-kind=primary"],
    },
  });

  win.once("ready-to-show", () => win.show());
  hardenContents(win.webContents);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(
      join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  return win;
}

function registerIpcHandlers(): void {
  ipcMain.handle(
    IpcChannels.getSystemThemeVariant,
    (): SystemThemeVariant => currentThemeVariant()
  );

  ipcMain.handle(IpcChannels.openExternal, async (_event, url: unknown) => {
    if (typeof url !== "string") {
      return;
    }
    try {
      const parsed = new URL(url);
      if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
        await shell.openExternal(url);
      }
    } catch {
      // ignore malformed urls
    }
  });
}

function broadcastThemeUpdates(): void {
  nativeTheme.on("updated", () => {
    const variant = currentThemeVariant();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.systemThemeVariantUpdated, variant);
    }
  });
}

contextMenu({
  showInspectElement: !app.isPackaged,
  showSaveImageAs: true,
  showCopyImage: true,
  showSelectAll: true,
});

app.whenReady().then(() => {
  applyContentSecurityPolicy();
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => {
      callback(false);
    }
  );

  registerIpcHandlers();
  broadcastThemeUpdates();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("web-contents-created", (_event, contents) => {
  hardenContents(contents);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
