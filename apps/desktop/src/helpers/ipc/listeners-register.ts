import { BrowserWindow } from "electron";

import {
  addBlenderEventListeners,
  initializeBlenderConnection,
} from "./blender/blender-listeners";
import { addThemeEventListeners } from "./theme/theme-listeners";
import { addWindowEventListeners } from "./window/window-listeners";

export default function registerListeners(mainWindow: BrowserWindow) {
  addWindowEventListeners(mainWindow);
  addThemeEventListeners();
  addBlenderEventListeners();
  initializeBlenderConnection(mainWindow.webContents);
}
