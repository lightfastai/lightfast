import { env } from "~/env";
import { appUrl, platformUrl, wwwUrl } from "~/origins";

const isDev =
  env.NEXT_PUBLIC_VERCEL_ENV === undefined ||
  env.NEXT_PUBLIC_VERCEL_ENV === "development";

const isBuildPhase = process.env.NEXT_PHASE?.includes("build") ?? false;

function toOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function toLocalOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const isLocalhost =
      url.hostname === "localhost" || url.hostname.endsWith(".localhost");
    return isLocalhost ? url.origin : null;
  } catch {
    return null;
  }
}

const canonicalAppOrigin = toOrigin(appUrl);

if (!canonicalAppOrigin) {
  throw new Error(`[cors] appUrl must be a valid URL. Received: ${appUrl}`);
}

if (isDev && !isBuildPhase && canonicalAppOrigin === "https://lightfast.ai") {
  throw new Error(
    "[cors] appUrl resolved to production URL in dev; portless daemon likely not running. " +
      "Run `pnpm dev` before the platform server."
  );
}

const localWebOrigins = isDev
  ? new Set(
      [appUrl, wwwUrl, platformUrl].flatMap((value) => {
        const origin = toLocalOrigin(value);
        return origin ? [origin] : [];
      })
    )
  : new Set<string>();

export function isAllowedWebOrigin(origin: string | null): origin is string {
  if (!origin) {
    return false;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  if (originUrl.origin === canonicalAppOrigin) {
    return true;
  }

  return isDev && localWebOrigins.has(originUrl.origin);
}
