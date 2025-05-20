import { contextBridge, ipcRenderer } from "electron";

import {
  WIN_CLOSE_CHANNEL,
  WIN_MAXIMIZE_CHANNEL,
  WIN_MINIMIZE_CHANNEL,
  WIN_NEW_WINDOW_CHANNEL,
} from "./window-channels";

export function exposeWindowContext() {
  contextBridge.exposeInMainWorld("electronWindow", {
    minimize: () => ipcRenderer.invoke(WIN_MINIMIZE_CHANNEL),
    maximize: () => ipcRenderer.invoke(WIN_MAXIMIZE_CHANNEL),
    close: () => ipcRenderer.invoke(WIN_CLOSE_CHANNEL),
    newWindow: () => ipcRenderer.invoke(WIN_NEW_WINDOW_CHANNEL),
    getInfo: () => ipcRenderer.invoke("get-window-info"),
  });
}
