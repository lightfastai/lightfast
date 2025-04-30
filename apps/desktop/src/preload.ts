import { contextBridge, ipcRenderer } from "electron";

import exposeContexts from "./helpers/ipc/context-exposer";

// Import or redefine types/constants needed from the main process
export const BLENDER_STATUS_CHANNEL = "blender-status-update";

export type BlenderConnectionStatus =
  | { status: "connected" }
  | { status: "disconnected" }
  | { status: "error"; error?: string }
  | { status: "listening" }
  | { status: "stopped" };

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  ping: () => ipcRenderer.invoke("ping"),
  // Add more IPC methods as needed
});

// Expose Blender connection API
contextBridge.exposeInMainWorld("blenderConnection", {
  onStatusUpdate: (callback: (status: BlenderConnectionStatus) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: BlenderConnectionStatus,
    ) => callback(status);
    ipcRenderer.on(BLENDER_STATUS_CHANNEL, listener);

    // Return a cleanup function
    return () => {
      ipcRenderer.removeListener(BLENDER_STATUS_CHANNEL, listener);
    };
  },
  // Add function to send messages *to* Blender via main process
  sendToBlender: (message: object) =>
    ipcRenderer.invoke("send-to-blender", message),
});

exposeContexts();

interface ThemeModeContext {
  toggle: () => Promise<boolean>;
  dark: () => Promise<void>;
  light: () => Promise<void>;
  system: () => Promise<boolean>;
}
interface ElectronWindow {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
}

interface BlenderConnectionAPI {
  onStatusUpdate: (
    callback: (status: BlenderConnectionStatus) => void,
  ) => () => void;
  sendToBlender: (message: object) => Promise<void>;
}

declare global {
  interface Window {
    // Existing electron API if defined here or elsewhere
    electron?: {
      ping: () => Promise<string>;
      // Add other methods if exposed under 'electron'
    };
    electronWindow?: ElectronWindow;
    // Our new API
    blenderConnection: BlenderConnectionAPI;
  }
}
