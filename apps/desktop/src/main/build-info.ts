import packageJson from "../../package.json";
import { mainEnv } from "../env/main";
import { type BuildInfo, buildInfoSchema } from "../shared/build-info-schema";

let cachedBuildInfo: BuildInfo | null = null;

export function getBuildInfo(): BuildInfo {
  if (cachedBuildInfo) {
    return cachedBuildInfo;
  }
  const candidate = {
    name: packageJson.name,
    version: packageJson.version,
    buildFlavor: packageJson.buildFlavor,
    buildNumber: packageJson.buildNumber,
    sparkleFeedUrl: mainEnv.SPARKLE_FEED_URL ?? packageJson.sparkleFeedUrl,
  };
  cachedBuildInfo = buildInfoSchema.parse(candidate);
  return cachedBuildInfo;
}
