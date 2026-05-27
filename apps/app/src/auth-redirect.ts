import { env } from "./env";

const CLERK_OAUTH_CONTINUATION_HOST_SUFFIXES = [
  ".accounts.dev",
  ".clerk.accounts.dev",
];
const CLERK_OAUTH_CONTINUATION_PATHS = new Set([
  "/oauth-consent",
  "/oauth/authorize-with-immediate-redirect",
]);

function isRelativeAppPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

function clerkHostForAppUrl(value: string): string | null {
  try {
    const { hostname } = new URL(value);
    const registrableHost = hostname.startsWith("app.")
      ? hostname.slice("app.".length)
      : hostname;
    return `clerk.${registrableHost}`;
  } catch {
    return null;
  }
}

function isAllowedProductionClerkHost(hostname: string) {
  return [env.NEXT_PUBLIC_APP_URL, env.NEXT_PUBLIC_WWW_URL].some((origin) => {
    const clerkHost = clerkHostForAppUrl(origin);
    return clerkHost !== null && hostname === clerkHost;
  });
}

export function isClerkOAuthContinuationUrl(url: URL) {
  return (
    url.protocol === "https:" &&
    (CLERK_OAUTH_CONTINUATION_HOST_SUFFIXES.some((suffix) =>
      url.hostname.endsWith(suffix)
    ) ||
      isAllowedProductionClerkHost(url.hostname)) &&
    CLERK_OAUTH_CONTINUATION_PATHS.has(url.pathname)
  );
}

export function parseSafeAuthRedirectTarget(value: unknown) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  if (isRelativeAppPath(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    return isClerkOAuthContinuationUrl(url) ? url.toString() : null;
  } catch {
    return null;
  }
}
