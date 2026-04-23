import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  session,
  shell,
} from "electron";
import contextMenu from "electron-context-menu";
import { IpcChannels, type SystemThemeVariant } from "../shared/ipc";
import { getBuildInfo } from "./build-info";
import { buildApplicationMenu } from "./menu";
import { getSentryInitOptions, initSentry } from "./sentry";
import { applyTitleBarOverlayTheme, createWindow } from "./windows/factory";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;

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

function registerIpcHandlers(): void {
  ipcMain.on(IpcChannels.getBuildInfoSync, (event) => {
    event.returnValue = getBuildInfo();
  });

  ipcMain.on(IpcChannels.getSentryInitOptionsSync, (event) => {
    event.returnValue = getSentryInitOptions();
  });

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

  ipcMain.handle(IpcChannels.openWindow, async (_event, kind: unknown) => {
    if (kind === "secondary") {
      await openSecondaryWindow();
    } else if (kind === "hud") {
      await openHudWindow();
    } else if (kind === "primary") {
      await openPrimaryWindow();
    }
  });
}

function broadcastThemeUpdates(): void {
  nativeTheme.on("updated", () => {
    const variant = currentThemeVariant();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.systemThemeVariantUpdated, variant);
      applyTitleBarOverlayTheme(win);
    }
  });
}

export function openPrimaryWindow(): Promise<BrowserWindow> {
  return createWindow({ kind: "primary", harden: hardenContents });
}

export function openSecondaryWindow(): Promise<BrowserWindow> {
  return createWindow({ kind: "secondary", harden: hardenContents });
}

export function openHudWindow(): Promise<BrowserWindow> {
  return createWindow({ kind: "hud", harden: hardenContents });
}

initSentry();

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

  Menu.setApplicationMenu(
    buildApplicationMenu({
      openSecondary: () => {
        void openSecondaryWindow();
      },
      openHud: () => {
        void openHudWindow();
      },
    })
  );

  registerIpcHandlers();
  broadcastThemeUpdates();
  void openPrimaryWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void openPrimaryWindow();
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
