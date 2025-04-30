import { join } from "path";
import { app, BrowserWindow, ipcMain } from "electron";

import { startBlenderSocketServer } from "./main/blender-connection";

// import { startBlenderSocketServer } from "./main/blender-connection";

// import { autoUpdater } from "electron-updater";

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer

const DIST_ELECTRON = join(__dirname, "..");
const DIST = join(DIST_ELECTRON, "../dist");
const VITE_PUBLIC = app.isPackaged ? DIST : join(DIST_ELECTRON, "../public");
const inDevelopment = process.env.NODE_ENV === "production";

let mainWindow: BrowserWindow | null = null;

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      devTools: false,
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInSubFrames: true,
      preload: join(__dirname, "../preload/preload.js"),
    },
    titleBarStyle: "hidden",
  });

  // Load app
  if (process.env.VITE_DEV_SERVER_URL) {
    // Development mode - load from Vite dev server
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (!devServerUrl) {
      throw new Error("VITE_DEV_SERVER_URL is undefined");
    }
    console.log("Loading URL:", devServerUrl);
    await mainWindow.loadURL(devServerUrl);
    // mainWindow.webContents.openDevTools(); // We'll open it unconditionally below
  } else {
    // Production - load the built HTML file
    mainWindow.loadFile(join(DIST, "index.html"));
  }

  // Always open DevTools after loading content
  mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();
  if (mainWindow) {
    startBlenderSocketServer(mainWindow.webContents);
  }

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Auto-updates
// if (!process.env.VITE_DEV_SERVER_URL) {
//   app
//     .whenReady()
//     .then(() => autoUpdater.checkForUpdatesAndNotify())
//     .catch(console.error);
// }

// Example IPC handler
ipcMain.handle("ping", () => "pong");

// // Example IPC handler to send messages to Blender from the renderer
// ipcMain.handle("send-to-blender", async (_event, message) => {
//   sendToBlender(message);
// });

// Stop the server and unregister shortcuts when the app quits
// app.on("will-quit", () => {
//   stopBlenderSocketServer();
//   // Unregister all shortcuts.
//   globalShortcut.unregisterAll();
// });
