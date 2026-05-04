import { shell } from "electron";
import { getRuntimeConfig } from "./runtime-config";

export function createAppUrl(path: string): URL {
  return new URL(path, getRuntimeConfig().appOrigin);
}

export function openAppOrigin(): Promise<void> {
  return shell.openExternal(getRuntimeConfig().appOrigin);
}
