import { mainEnv } from "../env/main";
import {
  type BuildFlavor,
  buildFlavorSchema,
} from "../shared/build-info-schema";

const PRODUCTION_APP_ORIGIN = "https://lightfast.ai";
type DesktopAppOriginBuildFlavor = BuildFlavor | "production";

function toOrigin(rawUrl: string, label: string): string {
  try {
    return new URL(rawUrl).origin;
  } catch {
    throw new Error(
      `${label} must be a valid absolute URL. Received: ${rawUrl}`
    );
  }
}

export function resolveDesktopAppOrigin(
  buildFlavor: DesktopAppOriginBuildFlavor
): string {
  const parsedBuildFlavor =
    buildFlavor === "production"
      ? "prod"
      : buildFlavorSchema.parse(buildFlavor);

  if (parsedBuildFlavor === "dev") {
    if (!mainEnv.APP_URL) {
      throw new Error(
        "APP_URL must be set for desktop dev. Run pnpm --filter @lightfast/desktop dev so package scripts inject APP_URL=$(portless get lightfast)."
      );
    }

    return toOrigin(mainEnv.APP_URL, "APP_URL");
  }

  return toOrigin(PRODUCTION_APP_ORIGIN, "Production app origin");
}
