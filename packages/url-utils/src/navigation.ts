/**
 * Navigation helpers for cross-app redirects
 * NOTE: Most navigation should use app-specific related-projects.ts exports
 * These utilities are kept for backward compatibility but are deprecated
 */

/**
 * Get redirect URL after authentication
 * @deprecated Use app-specific related-projects.ts instead
 */
export function getRedirectUrl(defaultUrl: string): string {
  if (typeof window === "undefined") {
    return defaultUrl;
  }

  // Check if there's a redirect URL in the query params
  const params = new URLSearchParams(window.location.search);
  const redirectUrl = params.get("redirect_url");

  if (redirectUrl) {
    try {
      // Validate it's a valid URL and from our domains
      const url = new URL(redirectUrl);
      const allowedDomains = [
        "lightfast.ai",
        "auth.lightfast.ai",
        "cloud.lightfast.ai",
        "chat.lightfast.ai",
        "docs.lightfast.ai",
        "playground.lightfast.ai",
        "localhost",
      ];

      if (allowedDomains.some(domain => url.hostname.includes(domain))) {
        return redirectUrl;
      }
    } catch {
      // Invalid URL, ignore
    }
  }

  return defaultUrl;
}