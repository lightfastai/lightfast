import { BrowserWindow } from "electron";

import { DEFAULT_BLENDER_PORT } from "../../main/blender-connection";
import {
  addBlenderEventListeners,
  initializeBlenderConnection,
} from "./blender/blender-listeners";
import { addThemeEventListeners } from "./theme/theme-listeners";
import { addWindowEventListeners } from "./window/window-listeners";

export default function registerListeners(
  mainWindow: BrowserWindow,
  blenderPort: number = DEFAULT_BLENDER_PORT,
) {
  addWindowEventListeners(mainWindow);
  addThemeEventListeners();
  addBlenderEventListeners();
  initializeBlenderConnection(mainWindow.webContents, blenderPort);
}
