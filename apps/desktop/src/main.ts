// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
import path from "path";
import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";

import type { EnvClient } from "./env/client-types";
// Import the validated environment variables
import { env } from "./env/index";
import registerListeners from "./helpers/ipc/listeners-register";

const inDevelopment = process.env.NODE_ENV === "development";

// --- IPC Handlers ---
ipcMain.handle("get-client-env", (): EnvClient => {
  // Manually construct the client environment object to send
  // We use the EnvClient type for type safety.
  // Note: The keys here match the *original* variable names (incl. prefix)
  // as defined in EnvClient type, which is what the renderer expects.
  const clientEnv: EnvClient = {
    VITE_PUBLIC_LIGHTFAST_API_URL: env.VITE_PUBLIC_LIGHTFAST_API_URL,
    // Add other client variables defined in EnvClient here
  };
  return clientEnv;
});
// --- End IPC Handlers ---

// Function to create the Composer window
function createComposerWindow() {
  const preload = path.join(__dirname, "preload.js");
  const composerWindow = new BrowserWindow({
    width: 400,
    height: 800,
    frame: false,
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,
      webSecurity: false,
      preload: preload,
    },
  });

  // Register listeners
  registerListeners(composerWindow);

  // Load the composer HTML (adjust path as needed)
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // If using Vite dev server, load a specific route or file
    composerWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/composer`);
  } else {
    composerWindow.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/composer.html`,
      ),
    );
  }
}

async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch {
    console.error("Failed to install extensions");
  }
}

app.whenReady().then(() => {
  createComposerWindow();
  installExtensions();
});

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createComposerWindow();
  }
});
//osX only ends

// Unregister all shortcuts when app quits
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
