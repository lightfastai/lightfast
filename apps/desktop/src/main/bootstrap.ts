import { join } from "node:path";
import { app } from "electron";
import squirrelStartup from "electron-squirrel-startup";

if (squirrelStartup) {
  app.quit();
}

app.setName("Lightfast");
app.setPath("userData", join(app.getPath("appData"), "Lightfast"));

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

import("./index").catch((error) => {
  console.error("Failed to load main module", error);
  app.exit(1);
});
