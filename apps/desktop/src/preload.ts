import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

import type { EnvClient } from "./env/client-types"; // Import type from new file
import exposeContexts from "./helpers/ipc/context-exposer";

console.log("[Preload] Script started");

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
contextBridge.exposeInMainWorld("electronAPI", {
  // Function to get the entire client environment object
  getClientEnv: (): Promise<EnvClient> => ipcRenderer.invoke("get-client-env"),
  ping: () => ipcRenderer.invoke("ping"),

  // --- Title Bar IPC ---
  send: (channel: string, ...args: any[]) => {
    // Whitelist channels to prevent sending arbitrary messages
    const validChannels = [
      "minimize-window",
      "maximize-window",
      "close-window",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    // Whitelist channels
    const validChannels = ["window-maximized", "window-unmaximized"];
    if (validChannels.includes(channel)) {
      // Deliberately strip event argument to prevent renderer manipulating it
      const subscription = (_event: IpcRendererEvent, ...args: any[]) =>
        listener(...args);
      ipcRenderer.on(channel, subscription);

      // Return a cleanup function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    } else {
      // Return a dummy cleanup function or throw an error for invalid channels
      return () => {};
    }
  },
  // Note: While exposing removeListener directly is possible, it's often safer
  // to handle listener cleanup via the return function of `on`, as shown above.
  // If direct removal is needed, ensure proper security checks.
  // --- End Title Bar IPC ---

  // Add invoke method with whitelist
  invoke: (channel: string, ...args: any[]) => {
    // Whitelist channels
    const validChannels = [
      "get-client-env",
      "ping",
      "handle-blender-create-object", // Add the Blender tool channel
      "get-blender-status", // Add the status check channel
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    // Return a rejected promise for invalid channels
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  },

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
  // Add function to get current Blender status
  getStatus: () => ipcRenderer.invoke("get-blender-status"),
  // Add function to send messages *to* Blender via main process
  sendToBlender: (message: object) =>
    ipcRenderer.invoke("send-to-blender", message),
});

exposeContexts();
