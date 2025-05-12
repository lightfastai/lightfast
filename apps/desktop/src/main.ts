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
import { DEFAULT_BLENDER_PORT } from "./main/blender-connection";

const inDevelopment = process.env.NODE_ENV === "development";

// Keep track of the next available port for Blender connections
let nextBlenderPort = DEFAULT_BLENDER_PORT;
// Track which port is assigned to which window
const windowPortMap = new Map<number, number>();

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

// Handler to get the blender port for a window
ipcMain.handle("get-blender-port", (event) => {
  const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
  if (windowId && windowPortMap.has(windowId)) {
    return windowPortMap.get(windowId);
  }
  return DEFAULT_BLENDER_PORT;
});

// Handler to set the blender port for a window
ipcMain.handle("set-blender-port", async (event, newPort) => {
  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;

    const oldPort = windowPortMap.get(window.id) || DEFAULT_BLENDER_PORT;

    // Don't do anything if the port is the same
    if (oldPort === newPort) return true;

    console.log(
      `Changing Blender port for window ${window.id} from ${oldPort} to ${newPort}`,
    );

    // Check if port is in use by another window
    for (const [windowId, port] of windowPortMap.entries()) {
      if (windowId !== window.id && port === newPort) {
        console.warn(`Port ${newPort} is already in use by window ${windowId}`);
        return false;
      }
    }

    // Update the port in our map
    windowPortMap.set(window.id, newPort);

    // Re-register listeners with the new port
    // This will close the old socket and open a new one
    registerListeners(window, newPort);

    return true;
  } catch (error) {
    console.error("Error setting Blender port:", error);
    return false;
  }
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

  // Assign a unique port to this window for Blender connection
  const windowBlenderPort = nextBlenderPort++;
  windowPortMap.set(composerWindow.id, windowBlenderPort);
  console.log(
    `Assigned Blender port ${windowBlenderPort} to window ${composerWindow.id}`,
  );

  // Register listeners with the assigned port
  registerListeners(composerWindow, windowBlenderPort);

  // Clean up when window is closed
  composerWindow.on("closed", () => {
    windowPortMap.delete(composerWindow.id);
  });

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
