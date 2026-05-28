import { env } from "~/env";
import { appUrl } from "~/origins";

const isDev =
  env.NEXT_PUBLIC_VERCEL_ENV === undefined ||
  env.NEXT_PUBLIC_VERCEL_ENV === "development";

const isBuildPhase = process.env.NEXT_PHASE?.includes("build") ?? false;

const canonicalAppOrigin = new URL(appUrl).origin;

if (isDev && !isBuildPhase && canonicalAppOrigin === "https://lightfast.ai") {
  throw new Error(
    "[cors] appUrl resolved to production URL in dev; portless daemon likely not running. " +
      "Run `pnpm dev` before the platform/app server."
  );
}

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
  const originValue = originUrl.origin;

  if (originValue === canonicalAppOrigin) {
    return true;
  }
  return false;
}

// Dev-only carve-out: the Electron renderer in dev loads from
// http://localhost:<vite-port> (not in the portless set). Auth is via Bearer
// JWT, not cookies, so admitting localhost here doesn't weaken auth.
export function isDesktopDevOrigin(origin: string | null): origin is string {
  if (!origin) {
    return false;
  }
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname === "localhost"
    );
  } catch {
    return false;
  }
}

// Prod packaged Electron renders from a file:// page. Chromium serializes the
// opaque origin as the ASCII string "null" (Fetch spec), so the Origin header
// arrives as the literal string "null" — not the JS null of an absent header.
// The renderer also sets x-lightfast-desktop: 1; we admit only the conjunction.
// Auth is still gated on the Bearer JWT (apps/desktop renderer tRPC provider);
// the marker is signal, not an auth boundary.
export function isPackagedDesktopRequest(
  origin: string | null,
  headers: Headers
): boolean {
  if (headers.get("x-lightfast-desktop") !== "1") {
    return false;
  }
  return origin === "null";
}
