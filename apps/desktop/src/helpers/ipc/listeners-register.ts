import { BrowserWindow } from "electron";

import { addWindowEventListeners } from "./window/window-listeners";

export default function registerListeners(mainWindow: BrowserWindow) {
  addWindowEventListeners(mainWindow);
}
