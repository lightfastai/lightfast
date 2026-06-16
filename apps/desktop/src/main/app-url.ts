import { shell } from "electron";
import { getRuntimeConfig } from "./runtime-config";

export function createAppUrl(path: string): URL {
  if (!(path.startsWith("/") && !path.startsWith("//"))) {
    throw new Error(`Expected app-relative path, got ${path}`);
  }

  return new URL(path, getRuntimeConfig().appOrigin);
}

export function openAppOrigin(): Promise<void> {
  return shell.openExternal(getRuntimeConfig().appOrigin);
}

export function openAppPath(path: string): Promise<void> {
  return shell.openExternal(createAppUrl(path).toString());
}
