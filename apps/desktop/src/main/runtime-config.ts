import packageJson from "../../package.json";
import { buildFlavorSchema } from "../shared/build-info-schema";
import type { RuntimeConfigSnapshot } from "../shared/ipc";
import { resolveDesktopAppOrigin } from "./app-origin";

let cachedRuntimeConfig: RuntimeConfigSnapshot | null = null;

export function getRuntimeConfig(): RuntimeConfigSnapshot {
  if (cachedRuntimeConfig) {
    return cachedRuntimeConfig;
  }

  cachedRuntimeConfig = {
    appOrigin: resolveDesktopAppOrigin(
      buildFlavorSchema.parse(packageJson.buildFlavor)
    ),
  };
  return cachedRuntimeConfig;
}
