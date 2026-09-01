import { homedir } from "node:os";
import { join } from "node:path";

import { cliEnv } from "../env";

export const AUTH_FILE_NAME = "auth.json";

export function getAppUrl(): string {
  const appUrl = cliEnv.LIGHTFAST_APP_URL;
  if (!appUrl) {
    throw new Error(
      "LIGHTFAST_APP_URL is required for Lightfast login and backend commands."
    );
  }

  return appUrl.replace(/\/$/, "");
}

export function getConfigDir(): string {
  if (cliEnv.LIGHTFAST_CLI_CONFIG_DIR) {
    return cliEnv.LIGHTFAST_CLI_CONFIG_DIR;
  }

  if (process.platform === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "com.lightfast.cli"
    );
  }

  if (process.platform === "win32") {
    return join(
      process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
      "com.lightfast.cli"
    );
  }

  return join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "com.lightfast.cli"
  );
}

export function getAuthFilePath(): string {
  return join(getConfigDir(), AUTH_FILE_NAME);
}
