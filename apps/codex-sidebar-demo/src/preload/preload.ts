import { contextBridge, ipcRenderer } from "electron";
import {
  IpcChannels,
  type LightfastBridge,
  type SystemThemeVariant,
  type WindowKind,
} from "../shared/ipc";

const bridge: LightfastBridge = {
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
  openExternal: (url) => ipcRenderer.invoke(IpcChannels.openExternal, url),
  openWindow: (kind) => ipcRenderer.invoke(IpcChannels.openWindow, kind),
};

contextBridge.exposeInMainWorld("lightfastBridge", bridge);

const windowKind: WindowKind =
  (process.argv
    .find((arg) => arg.startsWith("--window-kind="))
    ?.slice("--window-kind=".length) as WindowKind | undefined) ?? "primary";
contextBridge.exposeInMainWorld("codexWindowType", windowKind);
