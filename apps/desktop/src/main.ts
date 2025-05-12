// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
import path from "path";
import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";

import { nanoid } from "@repo/lib";

import type { EnvClient } from "./env/client-types";
// Import the validated environment variables
import { env } from "./env/index";
import registerListeners from "./helpers/ipc/listeners-register";
import { DEFAULT_BLENDER_PORT } from "./main/blender-connection";

// Extend global with our window port map
declare global {
  var windowPortMap: Map<number, number>;
}

const inDevelopment = process.env.NODE_ENV === "development";

// Keep track of the next available port for Blender connections
let nextBlenderPort = DEFAULT_BLENDER_PORT;
// Track which port is assigned to which window
const windowPortMap = new Map<number, number>();
// Make the port map accessible globally
global.windowPortMap = windowPortMap;

// Keep track of window unique IDs
const windowUniqueIds = new Map<number, string>();

// Create a collection to track all active windows
const windows: BrowserWindow[] = [];

// Function to register keyboard shortcuts
function registerShortcuts() {
  // Register Cmd+Shift+N / Ctrl+Shift+N to create a new window
  globalShortcut.register("CommandOrControl+Shift+N", () => {
    console.log("Creating new window via keyboard shortcut");
    createComposerWindow();
  });
}

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

// Handler to get window information (index, total windows)
ipcMain.handle("get-window-info", (event) => {
  const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
  if (!windowId)
    return { index: 0, total: windows.length, id: 0, uniqueId: nanoid(6) };

  const index = windows.findIndex((win) => win.id === windowId);
  const uniqueId = windowUniqueIds.get(windowId) || nanoid(6);

  return {
    index: index !== -1 ? index : 0,
    total: windows.length,
    id: windowId,
    uniqueId,
  };
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
export function createComposerWindow() {
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

  // Generate and assign a unique ID for this window
  const uniqueId = nanoid(6);
  windowUniqueIds.set(composerWindow.id, uniqueId);

  console.log(
    `Created window ${uniqueId} (ID: ${composerWindow.id}) with Blender port ${windowBlenderPort}`,
  );

  // Register listeners with the assigned port
  registerListeners(composerWindow, windowBlenderPort);

  // Add window to our collection
  windows.push(composerWindow);

  // Clean up when window is closed
  composerWindow.on("closed", () => {
    windowPortMap.delete(composerWindow.id);
    windowUniqueIds.delete(composerWindow.id);
    const windowIndex = windows.findIndex(
      (win) => win.id === composerWindow.id,
    );
    if (windowIndex !== -1) {
      windows.splice(windowIndex, 1);
    }
  });

  // Log the total number of windows whenever a window is created
  console.log(`Total windows active: ${windows.length}`);

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

  return composerWindow;
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
  // Create first window
  createComposerWindow();

  // Install extensions
  installExtensions();

  // Register keyboard shortcuts
  registerShortcuts();
});

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (windows.length === 0) {
    createComposerWindow();
  }
});
//osX only ends

// Unregister all shortcuts when app quits
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
