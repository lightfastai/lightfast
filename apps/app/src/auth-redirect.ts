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

export function isClerkOAuthContinuationUrl(url: URL) {
  return (
    url.protocol === "https:" &&
    CLERK_OAUTH_CONTINUATION_HOST_SUFFIXES.some((suffix) =>
      url.hostname.endsWith(suffix)
    ) &&
    CLERK_OAUTH_CONTINUATION_PATHS.has(url.pathname)
  );
}

export function parseSafeAuthRedirectTarget(value: string | null) {
  if (!value) {
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
