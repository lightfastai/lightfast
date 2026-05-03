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
import { mainEnv } from "../env/main";
import { IpcChannels, type SystemThemeVariant } from "../shared/ipc";
import {
  beginSignIn,
  getPendingSigninUrl,
  maybeAutoBeginSignIn,
  onPendingSigninUrl,
} from "./auth-flow";
import { createAuthFocusGate } from "./auth-focus-gate";
import {
  getAuthSnapshot,
  getToken as getAuthToken,
  onAuthChanged,
  signOut as signOutAuth,
} from "./auth-store";
import { getBuildInfo } from "./build-info";
import { buildApplicationMenu } from "./menu";
import { registerProtocolHandler } from "./protocol";
import { getSentryInitOptions, initSentry } from "./sentry";
import {
  getSettings,
  onSettingsChanged,
  type SettingsSnapshot,
  updateSetting,
} from "./settings-store";
import {
  attachLocalShortcuts,
  registerGlobalShortcuts,
  unregisterGlobalShortcuts,
} from "./shortcuts";
import { createTray, destroyTray } from "./tray";
import { initUpdater, registerUpdaterIpc } from "./updater";
import { applyTitleBarOverlayTheme, createWindow } from "./windows/factory";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function currentThemeVariant(): SystemThemeVariant {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function getApiOriginForCsp(): string {
  return mainEnv.LIGHTFAST_API_URL;
}

function getClerkFrontendApi(): string | null {
  const publishableKey = mainEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const base64Part = publishableKey.split("_")[2];
  if (!base64Part) {
    return null;
  }
  try {
    const domain = Buffer.from(base64Part, "base64")
      .toString("utf-8")
      .replace(/\$$/, "");
    if (!domain) {
      return null;
    }
    return `https://${domain}`;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(): string {
  const apiOrigin = getApiOriginForCsp();
  const clerkOrigin = getClerkFrontendApi();
  const extraConnect = [apiOrigin, clerkOrigin].filter(Boolean).join(" ");

  const devServer = MAIN_WINDOW_VITE_DEV_SERVER_URL;
  if (devServer) {
    const origin = new URL(devServer).origin;
    const wsOrigin = origin.replace(/^http/, "ws");
    return [
      `default-src 'self' ${origin}`,
      `script-src 'self' 'unsafe-inline' ${origin}`,
      `style-src 'self' 'unsafe-inline' ${origin}`,
      `connect-src 'self' ${origin} ${wsOrigin} ${extraConnect}`.trim(),
      `img-src 'self' data: blob: ${origin}`,
      `font-src 'self' data: ${origin}`,
    ].join("; ");
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${extraConnect}`.trim(),
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

  ipcMain.on(IpcChannels.getSettingsSync, (event) => {
    event.returnValue = getSettings();
  });

  ipcMain.handle(IpcChannels.updateSetting, (_event, payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return getSettings();
    }
    const { key, value } = payload as {
      key: keyof SettingsSnapshot;
      value: SettingsSnapshot[keyof SettingsSnapshot];
    };
    if (!(key in getSettings())) {
      return getSettings();
    }
    return updateSetting(key, value);
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

  ipcMain.on(IpcChannels.rendererError, (_event, payload: unknown) => {
    // eslint-disable-next-line no-console
    console.error("[renderer]", payload);
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

  ipcMain.on(IpcChannels.authSnapshotSync, (event) => {
    event.returnValue = getAuthSnapshot();
  });
  ipcMain.handle(IpcChannels.authGetToken, () => getAuthToken());
  ipcMain.handle(IpcChannels.authSignIn, () => beginSignIn());
  ipcMain.handle(IpcChannels.authSignOut, () => signOutAuth());
  ipcMain.handle(IpcChannels.authPendingSigninUrl, () => getPendingSigninUrl());
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

type Kind = "primary" | "secondary" | "hud";

const windowsByKind = new Map<Kind, Set<BrowserWindow>>();

function registerWindow(kind: Kind, win: BrowserWindow): void {
  const set = windowsByKind.get(kind) ?? new Set<BrowserWindow>();
  set.add(win);
  windowsByKind.set(kind, set);
  win.once("closed", () => {
    set.delete(win);
  });
}

async function openKind(kind: Kind): Promise<BrowserWindow> {
  const win = await createWindow({ kind, harden: hardenContents });
  registerWindow(kind, win);
  attachLocalShortcuts(win);
  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: "detach" });
  }
  return win;
}

export function openPrimaryWindow(): Promise<BrowserWindow> {
  return openKind("primary");
}

export function openSecondaryWindow(): Promise<BrowserWindow> {
  return openKind("secondary");
}

export function openHudWindow(): Promise<BrowserWindow> {
  return openKind("hud");
}

function findWindow(kind: Kind): BrowserWindow | null {
  const set = windowsByKind.get(kind);
  if (!set) {
    return null;
  }
  for (const win of set) {
    if (!win.isDestroyed()) {
      return win;
    }
  }
  return null;
}

function toggleHudWindow(): void {
  const existing = findWindow("hud");
  if (existing) {
    if (existing.isVisible()) {
      existing.hide();
    } else {
      existing.show();
      existing.focus();
    }
  } else {
    void openHudWindow();
  }
}

const trayActions = {
  showPrimary: () => {
    const existing = findWindow("primary");
    if (existing) {
      existing.show();
      existing.focus();
    } else {
      void openPrimaryWindow();
    }
  },
  toggleHud: toggleHudWindow,
};

function applySettings(snapshot: SettingsSnapshot): void {
  nativeTheme.themeSource = snapshot.themeSource;
  if (process.platform !== "linux" && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: snapshot.launchAtLogin });
  }
  if (snapshot.showInMenuBar) {
    createTray(trayActions);
  } else {
    destroyTray();
  }
}

function broadcastSettings(snapshot: SettingsSnapshot): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.settingsChanged, snapshot);
  }
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
  registerUpdaterIpc();
  registerProtocolHandler(() => BrowserWindow.getAllWindows());
  broadcastThemeUpdates();
  registerGlobalShortcuts({ toggleHud: toggleHudWindow });
  applySettings(getSettings());
  if (getSettings().checkForUpdatesAutomatically) {
    initUpdater();
  }
  onSettingsChanged((snapshot) => {
    applySettings(snapshot);
    broadcastSettings(snapshot);
  });
  void openPrimaryWindow();

  const focusGate = createAuthFocusGate({
    initiallySignedIn: Boolean(getAuthSnapshot().isSignedIn),
    getWindows: () => BrowserWindow.getAllWindows(),
  });
  onAuthChanged((snapshot) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.authChanged, snapshot);
    }
    focusGate(snapshot);
  });
  onPendingSigninUrl((url) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.authPendingSigninUrlChanged, url);
    }
  });

  // Agent-mode auto-trigger. No-op outside agent mode. Idempotent — emits
  // auth_already_signed_in if a token is already persisted.
  maybeAutoBeginSignIn();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void openPrimaryWindow();
    }
  });
});

app.on("will-quit", () => {
  unregisterGlobalShortcuts();
  destroyTray();
});

app.on("web-contents-created", (_event, contents) => {
  hardenContents(contents);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
