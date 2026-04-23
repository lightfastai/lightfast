import { app, type BrowserWindow, globalShortcut } from "electron";

const DEV_DEVTOOLS_KEYS = new Set(["F12", "I"]);

export function attachLocalShortcuts(win: BrowserWindow): void {
  if (app.isPackaged) {
    return;
  }
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") {
      return;
    }
    if (
      DEV_DEVTOOLS_KEYS.has(input.key) &&
      (input.key === "F12" ||
        (input.control && input.shift) ||
        (input.meta && input.alt))
    ) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
    if ((input.meta || input.control) && input.key === "R") {
      win.webContents.reloadIgnoringCache();
      event.preventDefault();
    }
  });
}

export interface GlobalShortcutActions {
  toggleHud: () => void;
}

export function registerGlobalShortcuts(actions: GlobalShortcutActions): void {
  globalShortcut.register("CmdOrCtrl+Alt+H", actions.toggleHud);
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
