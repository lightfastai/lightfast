import { mainEnv } from "../env/main";
import {
  type BuildFlavor,
  buildFlavorSchema,
} from "../shared/build-info-schema";

function toOrigin(rawUrl: string, label: string): string {
  try {
    return new URL(rawUrl).origin;
  } catch {
    throw new Error(
      `${label} must be a valid absolute URL. Received: ${rawUrl}`
    );
  }
}

export function resolveDesktopAppOrigin(buildFlavor: BuildFlavor): string {
  buildFlavorSchema.parse(buildFlavor);

  if (!mainEnv.APP_URL) {
    throw new Error(
      "APP_URL must be set to the backend used by the desktop app."
    );
  }

  return toOrigin(mainEnv.APP_URL, "APP_URL");
}
