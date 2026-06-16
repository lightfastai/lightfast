const CLERK_OAUTH_CONTINUATION_HOST_SUFFIXES = [
  ".accounts.dev",
  ".clerk.accounts.dev",
];
const CLERK_OAUTH_CONTINUATION_PATHS = new Set([
  "/oauth-consent",
  "/oauth/authorize-with-immediate-redirect",
]);

function isRelativeAppPath(value: string) {
  try {
    decodeURI(value);
  } catch {
    return false;
  }

  return value.startsWith("/") && !value.startsWith("//");
}

function clerkHostForAppUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

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
  const clerkHost = clerkHostForAppUrl(import.meta.env.VITE_LIGHTFAST_APP_URL);
  return clerkHost !== null && hostname === clerkHost;
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
  if (typeof value !== "string" || value.length === 0 || value === "null") {
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
