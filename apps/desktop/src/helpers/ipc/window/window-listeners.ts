import { BrowserWindow, ipcMain } from "electron";

import {
  WIN_CLOSE_CHANNEL,
  WIN_MAXIMIZE_CHANNEL,
  WIN_MINIMIZE_CHANNEL,
  WIN_NEW_WINDOW_CHANNEL,
} from "./window-channels";

// Track if we've registered the global handlers
let handlersRegistered = false;

// Track windows by their IDs
const windowsById = new Map<number, BrowserWindow>();

export function addWindowEventListeners(mainWindow: BrowserWindow) {
  // Store reference to this window
  windowsById.set(mainWindow.id, mainWindow);

  // Clean up when window is closed
  mainWindow.on("closed", () => {
    windowsById.delete(mainWindow.id);
  });

  // Only register the IPC handlers once
  if (!handlersRegistered) {
    // Register minimize handler
    ipcMain.handle(WIN_MINIMIZE_CHANNEL, (event) => {
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (windowId && windowsById.has(windowId)) {
        const win = windowsById.get(windowId);
        if (win && !win.isDestroyed()) {
          win.minimize();
        }
      }
    });

    // Register maximize/unmaximize handler
    ipcMain.handle(WIN_MAXIMIZE_CHANNEL, (event) => {
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (windowId && windowsById.has(windowId)) {
        const win = windowsById.get(windowId);
        if (win && !win.isDestroyed()) {
          if (win.isMaximized()) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        }
      }
    });

    // Register close handler
    ipcMain.handle(WIN_CLOSE_CHANNEL, (event) => {
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (windowId && windowsById.has(windowId)) {
        const win = windowsById.get(windowId);
        if (win && !win.isDestroyed()) {
          win.close();
        }
      }
    });

    // Register new window handler
    ipcMain.handle(WIN_NEW_WINDOW_CHANNEL, () => {
      // Import here to avoid circular dependency
      const { createComposerWindow } = require("../../../main");
      createComposerWindow();
    });

    // Mark as registered to prevent duplicate registrations
    handlersRegistered = true;
  }
}
