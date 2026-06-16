import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import type { AcceleratorName } from "../shared/accelerators";
import {
  type AuthSnapshot,
  type BuildInfoSnapshot,
  IpcChannels,
  type LightfastBridge,
  type RuntimeConfigSnapshot,
  type SettingsSnapshot,
  type SystemThemeVariant,
  type UpdaterStatusSnapshot,
  type WindowKind,
} from "../shared/ipc";
import { BRIDGE_GLOBAL, WINDOW_KIND_GLOBAL } from "../shared/window-globals";

export function buildBridge(): LightfastBridge {
  const buildInfo = ipcRenderer.sendSync(
    IpcChannels.getBuildInfoSync
  ) as BuildInfoSnapshot;
  const updaterStatus = ipcRenderer.sendSync(
    IpcChannels.updaterStatusSync
  ) as UpdaterStatusSnapshot;
  const settings = ipcRenderer.sendSync(
    IpcChannels.getSettingsSync
  ) as SettingsSnapshot;
  const authSnapshot = ipcRenderer.sendSync(
    IpcChannels.authSnapshotSync
  ) as AuthSnapshot;
  const runtimeConfig = ipcRenderer.sendSync(
    IpcChannels.runtimeConfigSync
  ) as RuntimeConfigSnapshot;

  return {
    appOrigin: runtimeConfig.appOrigin,
    auth: {
      snapshot: authSnapshot,
      getToken: () => ipcRenderer.invoke(IpcChannels.authGetToken),
      getRequestHeaders: () =>
        ipcRenderer.invoke(IpcChannels.authGetRequestHeaders),
      signIn: () => ipcRenderer.invoke(IpcChannels.authSignIn),
      signOut: () => ipcRenderer.invoke(IpcChannels.authSignOut),
      onChanged: (listener) => {
        const handler = (_event: IpcRendererEvent, snap: AuthSnapshot) =>
          listener(snap);
        ipcRenderer.on(IpcChannels.authChanged, handler);
        return () => ipcRenderer.off(IpcChannels.authChanged, handler);
      },
      pendingSigninUrl: () =>
        ipcRenderer.invoke(IpcChannels.authPendingSigninUrl),
      onPendingSigninUrlChanged: (listener) => {
        const handler = (_event: IpcRendererEvent, url: string | null) =>
          listener(url);
        ipcRenderer.on(IpcChannels.authPendingSigninUrlChanged, handler);
        return () =>
          ipcRenderer.off(IpcChannels.authPendingSigninUrlChanged, handler);
      },
    },
    buildInfo,
    platform: process.platform,
    getSystemThemeVariant: () =>
      ipcRenderer.invoke(IpcChannels.getSystemThemeVariant),
    onSystemThemeVariantUpdated: (listener) => {
      const handler = (_event: unknown, variant: SystemThemeVariant) =>
        listener(variant);
      ipcRenderer.on(IpcChannels.systemThemeVariantUpdated, handler);
      return () =>
        ipcRenderer.off(IpcChannels.systemThemeVariantUpdated, handler);
    },
    onUpdaterStatusChanged: (listener) => {
      const handler = (_event: unknown, status: UpdaterStatusSnapshot) =>
        listener(status);
      ipcRenderer.on(IpcChannels.updaterStatusChanged, handler);
      return () => ipcRenderer.off(IpcChannels.updaterStatusChanged, handler);
    },
    onMenuAction: (listener) => {
      const handler = (_event: unknown, action: AcceleratorName) =>
        listener(action);
      ipcRenderer.on(IpcChannels.menuAction, handler);
      return () => ipcRenderer.off(IpcChannels.menuAction, handler);
    },
    onSettingsChanged: (listener) => {
      const handler = (_event: unknown, snapshot: SettingsSnapshot) =>
        listener(snapshot);
      ipcRenderer.on(IpcChannels.settingsChanged, handler);
      return () => ipcRenderer.off(IpcChannels.settingsChanged, handler);
    },
    openApp: () => ipcRenderer.invoke(IpcChannels.openApp),
    openAppPath: (path) => ipcRenderer.invoke(IpcChannels.openAppPath, path),
    openWindow: (kind) => ipcRenderer.invoke(IpcChannels.openWindow, kind),
    reportError: (payload) =>
      ipcRenderer.send(IpcChannels.rendererError, payload),
    settings,
    updateSetting: (key, value) =>
      ipcRenderer.invoke(IpcChannels.updateSetting, { key, value }),
    updater: {
      status: updaterStatus,
      check: () => ipcRenderer.invoke(IpcChannels.updaterCheck),
      install: () => ipcRenderer.invoke(IpcChannels.updaterInstall),
    },
  };
}

export function exposePreload(kind: WindowKind): void {
  contextBridge.exposeInMainWorld(BRIDGE_GLOBAL, buildBridge());
  contextBridge.exposeInMainWorld(WINDOW_KIND_GLOBAL, kind);
}
