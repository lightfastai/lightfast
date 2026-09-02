import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";

import { createWindowOptions } from "./window";

const rendererFile = fileURLToPath(
  new URL("./renderer/index.html", import.meta.url)
);

async function createWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow(createWindowOptions());

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  await window.loadFile(rendererFile);
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.show();
  return window;
}

app.whenReady().then(async () => {
  await createWindow();
  process.stdout.write("Lightfast desktop static shell ready.\n");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
