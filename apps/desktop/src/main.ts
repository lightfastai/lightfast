// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
import path from "path";
import { app, BrowserWindow, ipcMain } from "electron";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";

import type { EnvClient } from "./env/client-types";
// Import the validated environment variables
import { env } from "./env/index";
import registerListeners from "./helpers/ipc/listeners-register";
// Import the blender connection module
import {
  isBlenderConnected,
  sendToBlender,
  startBlenderSocketServer,
} from "./main/blender-connection";

// Example usage (if you had defined variables in env.ts):
// console.log("API Key:", env.API_KEY);

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

// Handle Blender object creation
ipcMain.handle("handle-blender-create-object", async (event, args) => {
  try {
    console.log("Main: Received request to create Blender object:", args);

    // Extract parameters from args
    const { objectType, location = { x: 0, y: 0, z: 0 }, name } = args;

    // Create command for Blender
    const command = {
      action: "create_object",
      params: {
        type: objectType,
        location,
        name:
          name ||
          `New${objectType.charAt(0)}${objectType.slice(1).toLowerCase()}`,
      },
    };

    // Check if Blender is connected before attempting to send the command
    if (!isBlenderConnected()) {
      console.warn("Main: Blender is not connected. Cannot execute command.");
      return {
        success: false,
        error:
          "Blender is not connected. Please check your Blender connection.",
        errorCode: "BLENDER_NOT_CONNECTED",
      };
    }

    // Send to Blender via WebSocket
    sendToBlender(command);

    // For now, return a success message - in a more advanced implementation,
    // we would wait for a response from Blender
    return {
      success: true,
      message: `Created ${objectType.toLowerCase()} at location (${location.x}, ${location.y}, ${location.z})`,
      objectName: command.params.name,
    };
  } catch (error: any) {
    console.error("Main: Error handling Blender object creation:", error);
    return {
      success: false,
      error: `Failed to create Blender object: ${error.message}`,
      errorCode: "EXECUTION_ERROR",
    };
  }
});
// --- End IPC Handlers ---

function createWindow() {
  const preload = path.join(__dirname, "preload.js");
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
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
  registerListeners(mainWindow);

  // Initialize Blender WebSocket server
  startBlenderSocketServer(mainWindow.webContents);
  console.log("Blender WebSocket server initialized");

  ipcMain.on("minimize-window", () => {
    mainWindow?.minimize();
  });

  ipcMain.on("maximize-window", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on("close-window", () => {
    mainWindow?.close();
  });

  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximized");
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-unmaximized");
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
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

app.whenReady().then(createWindow).then(installExtensions);

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//osX only ends
