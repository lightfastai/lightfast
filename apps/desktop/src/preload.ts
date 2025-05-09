import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

import type { EnvClient } from "./env/client-types"; // Import type from new file
import {
  BLENDER_EXECUTE_CODE_CHANNEL,
  BLENDER_GET_SCENE_INFO_CHANNEL,
  BLENDER_STATUS_CHANNEL,
} from "./helpers/ipc/blender/blender-channels";
import exposeContexts from "./helpers/ipc/context-exposer";
import {
  WINDOW_CLOSE_CHANNEL,
  WINDOW_MAXIMIZE_CHANNEL,
  WINDOW_MAXIMIZED_CHANNEL,
  WINDOW_MINIMIZE_CHANNEL,
  WINDOW_UNMAXIMIZED_CHANNEL,
} from "./helpers/ipc/window/window-event-channels";

console.log("[Preload] Script started");

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
      WINDOW_MINIMIZE_CHANNEL,
      WINDOW_MAXIMIZE_CHANNEL,
      WINDOW_CLOSE_CHANNEL,
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    // Whitelist channels
    const validChannels = [
      WINDOW_MAXIMIZED_CHANNEL,
      WINDOW_UNMAXIMIZED_CHANNEL,
    ];
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
      BLENDER_STATUS_CHANNEL, // Add the status check channel
      BLENDER_EXECUTE_CODE_CHANNEL, // Add the Blender execute code channel
      BLENDER_GET_SCENE_INFO_CHANNEL, // Add the Blender get scene info channel
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    // Return a rejected promise for invalid channels
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  },

  // Add more IPC methods as needed
});

// Use the centralized context exposure system
exposeContexts();
