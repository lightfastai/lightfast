import { join } from "node:path";
import { app } from "electron";
import squirrelStartup from "electron-squirrel-startup";
import { mainEnv } from "../env/main";

if (squirrelStartup) {
  app.quit();
}

const productName = app.isPackaged ? "Lightfast" : "Lightfast Dev";
app.setName(productName);
app.setPath("userData", join(app.getPath("appData"), productName));

if (!app.isPackaged) {
  const port = mainEnv.LIGHTFAST_REMOTE_DEBUG_PORT;
  if (port !== undefined) {
    app.commandLine.appendSwitch("remote-debugging-port", String(port));
    app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
    console.log(`[cdp] remote debugging on 127.0.0.1:${port}`);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

import("./index").catch((error) => {
  console.error("Failed to load main module", error);
  app.exit(1);
});
