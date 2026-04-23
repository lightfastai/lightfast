import { app, autoUpdater, BrowserWindow, ipcMain } from "electron";
import { IpcChannels } from "../shared/ipc";
import { getBuildInfo, getRuntimeEnv } from "./build-info";

export interface UpdaterStatus {
  message?: string;
  progress?: number;
  state:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "ready"
    | "error";
}

let currentStatus: UpdaterStatus = { state: "idle" };
let initialized = false;

function broadcastStatus(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.updaterStatusChanged, currentStatus);
  }
}

function expandFeedUrl(url: string): string {
  return url.replace(/\$\{arch\}/g, process.arch);
}

function resolveFeedUrl(): string | null {
  const build = getBuildInfo();
  const env = getRuntimeEnv();
  if (process.platform === "darwin") {
    const raw = env.SPARKLE_FEED_URL ?? (build.sparkleFeedUrl || null);
    return raw ? expandFeedUrl(raw) : null;
  }
  if (process.platform === "win32") {
    return env.SQUIRREL_FEED_URL ?? null;
  }
  return null;
}

export function registerUpdaterIpc(): void {
  ipcMain.handle(IpcChannels.updaterCheck, async () => {
    if (!initialized) {
      return { ok: false, reason: "updater-disabled" };
    }
    try {
      autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "unknown",
      };
    }
  });

  ipcMain.handle(IpcChannels.updaterInstall, () => {
    if (currentStatus.state !== "ready") {
      return;
    }
    autoUpdater.quitAndInstall();
  });

  ipcMain.on(IpcChannels.updaterStatusSync, (event) => {
    event.returnValue = currentStatus;
  });
}

export function initUpdater(): void {
  if (initialized) {
    return;
  }
  if (!app.isPackaged) {
    return;
  }
  const build = getBuildInfo();
  if (build.buildFlavor === "dev") {
    return;
  }

  const feedUrl = resolveFeedUrl();
  if (!feedUrl) {
    return;
  }

  try {
    autoUpdater.setFeedURL({ url: feedUrl });
  } catch {
    currentStatus = { state: "error", message: "Feed URL rejected" };
    broadcastStatus();
    return;
  }

  autoUpdater.on("checking-for-update", () => {
    currentStatus = { state: "checking" };
    broadcastStatus();
  });
  autoUpdater.on("update-available", () => {
    currentStatus = { state: "available" };
    broadcastStatus();
  });
  autoUpdater.on("update-not-available", () => {
    currentStatus = { state: "not-available" };
    broadcastStatus();
  });
  autoUpdater.on("update-downloaded", () => {
    currentStatus = { state: "ready" };
    broadcastStatus();
  });
  autoUpdater.on("error", (error) => {
    currentStatus = { state: "error", message: error.message };
    broadcastStatus();
  });

  initialized = true;

  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 10_000);
}
