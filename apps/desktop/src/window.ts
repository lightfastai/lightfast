import type { BrowserWindowConstructorOptions } from "electron";

export function createWindowOptions(): BrowserWindowConstructorOptions {
  return {
    autoHideMenuBar: true,
    backgroundColor: "#09090b",
    height: 720,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    width: 1080,
  };
}
