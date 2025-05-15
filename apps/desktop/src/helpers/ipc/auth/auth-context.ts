import { contextBridge, ipcRenderer } from "electron";

// Export auth-related functions to the renderer process
export function exposeAuthContext() {
  contextBridge.exposeInMainWorld("electron", {
    shell: {
      openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
    },
    auth: {
      // Handle the IPC auth-callback event registration
      onAuthCallback: (callback: (url: string) => void) => {
        const handler = (_: any, url: string) => callback(url);
        ipcRenderer.on("auth-callback", handler);
        return () => ipcRenderer.removeListener("auth-callback", handler);
      },
    },
  });
}
