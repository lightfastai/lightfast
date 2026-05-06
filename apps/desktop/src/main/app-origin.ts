import { mainEnv } from "../env/main";
import {
  type BuildFlavor,
  buildFlavorSchema,
} from "../shared/build-info-schema";

const PRODUCTION_APP_ORIGIN = "https://lightfast.ai";

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
  const parsedBuildFlavor = buildFlavorSchema.parse(buildFlavor);

  if (parsedBuildFlavor === "dev") {
    if (!mainEnv.LIGHTFAST_APP_ORIGIN) {
      throw new Error(
        "LIGHTFAST_APP_ORIGIN must be set for desktop dev. Run pnpm dev:desktop or wrap the command with scripts/with-desktop-env.mjs."
      );
    }

    return toOrigin(mainEnv.LIGHTFAST_APP_ORIGIN, "Lightfast app origin");
  }

  return toOrigin(PRODUCTION_APP_ORIGIN, "Production app origin");
}
