import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  ping: () => ipcRenderer.invoke("ping"),
  // Add more IPC methods as needed
});

// TypeScript interface for the exposed API
declare global {
  interface Window {
    electron: {
      ping: () => Promise<string>;
    };
  }
}
