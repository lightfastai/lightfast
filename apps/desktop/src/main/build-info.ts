import packageJson from "../../package.json";
import {
  type BuildInfo,
  buildInfoSchema,
  parseRuntimeEnv,
  type RuntimeEnv,
} from "../shared/env";

let cachedBuildInfo: BuildInfo | null = null;
let cachedRuntimeEnv: RuntimeEnv | null = null;

export function getBuildInfo(): BuildInfo {
  if (cachedBuildInfo) {
    return cachedBuildInfo;
  }
  const runtime = getRuntimeEnv();
  const candidate = {
    name: packageJson.name,
    version: packageJson.version,
    buildFlavor: runtime.BUILD_FLAVOR ?? packageJson.buildFlavor,
    buildNumber: packageJson.buildNumber,
    sparkleFeedUrl: runtime.SPARKLE_FEED_URL ?? packageJson.sparkleFeedUrl,
    sparklePublicKey: packageJson.sparklePublicKey,
  };
  cachedBuildInfo = buildInfoSchema.parse(candidate);
  return cachedBuildInfo;
}

export function getRuntimeEnv(): RuntimeEnv {
  if (cachedRuntimeEnv) {
    return cachedRuntimeEnv;
  }
  cachedRuntimeEnv = parseRuntimeEnv(process.env);
  return cachedRuntimeEnv;
}
