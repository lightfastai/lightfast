import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import type { AcceleratorName } from "../shared/accelerators";
import {
  type AuthSnapshot,
  type BuildInfoSnapshot,
  IpcChannels,
  type LightfastBridge,
  type SentryInitSnapshot,
  type SettingsSnapshot,
  type SystemThemeVariant,
  type UpdaterStatusSnapshot,
  type WindowKind,
} from "../shared/ipc";

const buildInfo = ipcRenderer.sendSync(
  IpcChannels.getBuildInfoSync
) as BuildInfoSnapshot;
const sentryInit = ipcRenderer.sendSync(
  IpcChannels.getSentryInitOptionsSync
) as SentryInitSnapshot;
const updaterStatus = ipcRenderer.sendSync(
  IpcChannels.updaterStatusSync
) as UpdaterStatusSnapshot;
const settings = ipcRenderer.sendSync(
  IpcChannels.getSettingsSync
) as SettingsSnapshot;
const authSnapshot = ipcRenderer.sendSync(
  IpcChannels.authSnapshotSync
) as AuthSnapshot;

const bridge: LightfastBridge = {
  auth: {
    snapshot: authSnapshot,
    getToken: () => ipcRenderer.invoke(IpcChannels.authGetToken),
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
  sentryInit,
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
  openExternal: (url) => ipcRenderer.invoke(IpcChannels.openExternal, url),
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

contextBridge.exposeInMainWorld("lightfastBridge", bridge);

const windowKind: WindowKind =
  (process.argv
    .find((arg) => arg.startsWith("--window-kind="))
    ?.slice("--window-kind=".length) as WindowKind | undefined) ?? "primary";
contextBridge.exposeInMainWorld("codexWindowType", windowKind);
