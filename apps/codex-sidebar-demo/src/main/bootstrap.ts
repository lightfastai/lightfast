import { join } from "node:path";
import { app } from "electron";
import squirrelStartup from "electron-squirrel-startup";

if (squirrelStartup) {
  app.quit();
}

app.setName("Codex Sidebar Demo");
app.setPath("userData", join(app.getPath("appData"), "Codex Sidebar Demo"));

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

import("./index").catch((error) => {
  console.error("Failed to load main module", error);
  app.exit(1);
});
