import { BrowserWindow } from "electron";

import { DEFAULT_BLENDER_PORT } from "../../main/blender-connection";
import {
  addBlenderEventListeners,
  initializeBlenderConnection,
} from "./blender/blender-listeners";
import { addThemeEventListeners } from "./theme/theme-listeners";
import { addWindowEventListeners } from "./window/window-listeners";

// Track if the global event listeners have been registered
let globalEventListenersRegistered = false;

export default function registerListeners(
  mainWindow: BrowserWindow,
  blenderPort: number = DEFAULT_BLENDER_PORT,
) {
  console.log(
    `Registering listeners for window ${mainWindow.id} with port ${blenderPort}`,
  );

  // Add window-specific event listeners
  addWindowEventListeners(mainWindow);

  // Add window-specific Blender connection
  initializeBlenderConnection(mainWindow.webContents, blenderPort);

  // Register global event listeners only once
  if (!globalEventListenersRegistered) {
    console.log("Registering global event listeners");
    addThemeEventListeners();
    addBlenderEventListeners();
    globalEventListenersRegistered = true;
  }
}
