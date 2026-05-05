import { app, autoUpdater, BrowserWindow, ipcMain } from "electron";
import { mainEnv } from "../env/main";
import { IpcChannels } from "../shared/ipc";
import { getBuildInfo } from "./build-info";

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
  if (process.platform === "darwin") {
    const raw = mainEnv.SPARKLE_FEED_URL ?? (build.sparkleFeedUrl || null);
    return raw ? expandFeedUrl(raw) : null;
  }
  if (process.platform === "win32") {
    return mainEnv.SQUIRREL_FEED_URL ?? null;
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
  // Squirrel.Mac requires the new build to satisfy the running app's
  // designated requirement. Ad-hoc DRs are content-bound — every build has
  // a different DR, so swap-in always fails. Disable updater here; beta
  // users (currently just jp) reinstall manually when v0.1.0 ships.
  if (build.signingMode === "ad-hoc") {
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
