import { contextBridge, ipcRenderer } from "electron";

import exposeContexts from "./helpers/ipc/context-exposer";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  ping: () => ipcRenderer.invoke("ping"),
  // Add more IPC methods as needed
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
// TypeScript interface for the exposed API

declare global {
  interface Window {
    electron: {
      ping: () => Promise<string>;
    };
    themeMode: ThemeModeContext;
    electronWindow: ElectronWindow;
  }
}
