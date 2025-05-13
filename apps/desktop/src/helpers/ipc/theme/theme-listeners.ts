import { ipcMain, nativeTheme } from "electron";

import {
  THEME_MODE_CURRENT_CHANNEL,
  THEME_MODE_DARK_CHANNEL,
  THEME_MODE_LIGHT_CHANNEL,
  THEME_MODE_SYSTEM_CHANNEL,
  THEME_MODE_TOGGLE_CHANNEL,
} from "./theme-channels";

// Track if we've already registered the theme listeners
let themeHandlersRegistered = false;

export function addThemeEventListeners() {
  // Only register handlers once
  if (themeHandlersRegistered) {
    console.log("Theme event listeners already registered, skipping");
    return;
  }

  console.log("Registering theme event listeners");

  ipcMain.handle(THEME_MODE_CURRENT_CHANNEL, () => nativeTheme.themeSource);
  ipcMain.handle(THEME_MODE_TOGGLE_CHANNEL, () => {
    if (nativeTheme.shouldUseDarkColors) {
      nativeTheme.themeSource = "light";
    } else {
      nativeTheme.themeSource = "dark";
    }
    return nativeTheme.shouldUseDarkColors;
  });
  ipcMain.handle(
    THEME_MODE_DARK_CHANNEL,
    () => (nativeTheme.themeSource = "dark"),
  );
  ipcMain.handle(
    THEME_MODE_LIGHT_CHANNEL,
    () => (nativeTheme.themeSource = "light"),
  );
  ipcMain.handle(THEME_MODE_SYSTEM_CHANNEL, () => {
    nativeTheme.themeSource = "system";
    return nativeTheme.shouldUseDarkColors;
  });

  // Mark as registered
  themeHandlersRegistered = true;
}
