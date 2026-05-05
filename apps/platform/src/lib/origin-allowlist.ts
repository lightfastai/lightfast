import { getPortlessProxyOrigins } from "@lightfastai/dev-proxy/next";
import { env } from "~/env";
import { appUrl } from "~/lib/related-projects";

const isDev =
  env.NEXT_PUBLIC_VERCEL_ENV === undefined ||
  env.NEXT_PUBLIC_VERCEL_ENV === "development";

const isBuildPhase = process.env.NEXT_PHASE?.includes("build") ?? false;

const canonicalAppOrigin = new URL(appUrl).origin;

if (isDev && !isBuildPhase && canonicalAppOrigin === "https://lightfast.ai") {
  throw new Error(
    "[origin-allowlist] appUrl resolved to production URL in dev; portless daemon likely not running. " +
      "Run `pnpm dev:full` (which starts portless) or `portless start` before the platform/app server."
  );
}

const devOrigins = isDev
  ? getPortlessProxyOrigins({ allowMissingConfig: true })
  : [];

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  const originValue = originUrl.origin;

  if (originValue === canonicalAppOrigin) return true;
  if (!isDev) return false;

  return devOrigins.some((pattern) => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      return (
        originUrl.host.endsWith(suffix) && originUrl.host.length > suffix.length
      );
    }
    return originUrl.host === pattern;
  });
}
