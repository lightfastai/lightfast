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
// Import the blender connection module and its variables
import {
  getBlenderStatus,
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

// Add handler for getting Blender status
ipcMain.handle("get-blender-status", () => {
  // Return the current Blender connection status using the imported function
  return getBlenderStatus();
});

// Add handler for sending messages to Blender
ipcMain.handle("send-to-blender", async (event, message) => {
  try {
    console.log("Main: Sending message to Blender:", message);

    // Check if Blender is connected
    if (!isBlenderConnected()) {
      console.warn("Main: Blender is not connected. Cannot send message.");
      return {
        success: false,
        error:
          "Blender is not connected. Please check your Blender connection.",
        errorCode: "BLENDER_NOT_CONNECTED",
      };
    }

    // Send the message to Blender
    sendToBlender(message);

    return {
      success: true,
      message: "Message sent to Blender",
    };
  } catch (error: any) {
    console.error("Main: Error sending message to Blender:", error);
    return {
      success: false,
      error: `Failed to send message to Blender: ${error.message}`,
      errorCode: "EXECUTION_ERROR",
    };
  }
});

// Add Blender execute code handler
ipcMain.handle("handle-blender-execute-code", async (event, args) => {
  try {
    console.log("Main: Received request to execute code in Blender");

    // Extract code from args
    const { code } = args;

    if (!code) {
      console.warn("Main: No code provided for execution");
      return {
        success: false,
        error: "No code provided for execution",
        errorCode: "INVALID_CODE",
      };
    }

    // Check if Blender is connected before attempting to send the command
    if (!isBlenderConnected()) {
      console.warn("Main: Blender is not connected. Cannot execute code.");
      return {
        success: false,
        error:
          "Blender is not connected. Please check your Blender connection.",
        errorCode: "BLENDER_NOT_CONNECTED",
      };
    }

    // Send to Blender via WebSocket
    const command = {
      action: "execute_code",
      params: {
        code,
      },
    };

    sendToBlender(command);

    // For now, return a success message - in a more advanced implementation,
    // we would wait for a response from Blender with the execution results
    return {
      success: true,
      message: "Code has been sent to Blender for execution",
    };
  } catch (error: any) {
    console.error("Main: Error handling Blender code execution:", error);
    return {
      success: false,
      error: `Failed to execute code in Blender: ${error.message}`,
      errorCode: "EXECUTION_ERROR",
    };
  }
});

// Add Blender get state handler
ipcMain.handle("handle-blender-get-state", async (event, args) => {
  try {
    console.log("Main: Received request to get Blender state");

    // Check if Blender is connected before attempting to send the command
    if (!isBlenderConnected()) {
      console.warn("Main: Blender is not connected. Cannot get state.");
      return {
        success: false,
        error:
          "Blender is not connected. Please check your Blender connection.",
        errorCode: "BLENDER_NOT_CONNECTED",
      };
    }

    // Send to Blender via WebSocket
    const command = {
      action: "get_state",
      params: {},
    };

    sendToBlender(command);

    // For now, return a success message - the actual state will be received via WebSocket
    return {
      success: true,
      message: "Request to get Blender state has been sent",
    };
  } catch (error: any) {
    console.error("Main: Error handling Blender get state:", error);
    return {
      success: false,
      error: `Failed to get Blender state: ${error.message}`,
      errorCode: "EXECUTION_ERROR",
    };
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

  registerListeners(composerWindow);

  // Initialize Blender WebSocket server
  startBlenderSocketServer(composerWindow.webContents);
  console.log("Blender WebSocket server initialized");

  ipcMain.on("minimize-window", () => {
    composerWindow?.minimize();
  });

  ipcMain.on("maximize-window", () => {
    if (composerWindow?.isMaximized()) {
      composerWindow.unmaximize();
    } else {
      composerWindow?.maximize();
    }
  });

  ipcMain.on("close-window", () => {
    composerWindow?.close();
  });

  composerWindow.on("maximize", () => {
    composerWindow.webContents.send("window-maximized");
  });

  composerWindow.on("unmaximize", () => {
    composerWindow.webContents.send("window-unmaximized");
  });

  // You may want to register listeners here if needed
  // registerListeners(composerWindow);

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
