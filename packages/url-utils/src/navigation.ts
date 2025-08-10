import { getAppUrl, type ProjectName } from "@repo/vercel-config";

/**
 * Navigation helpers for cross-app redirects
 */

/**
 * Create a cross-app navigation URL
 */
export function createCrossAppUrl(
  targetApp: ProjectName,
  path: string,
  params?: Record<string, string>
): string {
  const baseUrl = getAppUrl(targetApp);
  const url = new URL(path, baseUrl);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  return url.toString();
}

/**
 * Navigate to a different app (client-side)
 */
export function navigateToApp(
  targetApp: ProjectName,
  path: string = "/",
  params?: Record<string, string>
): void {
  if (typeof window !== "undefined") {
    window.location.href = createCrossAppUrl(targetApp, path, params);
  }
}

/**
 * Check if we're on a specific app
 */
export function isCurrentApp(appName: ProjectName): boolean {
  if (typeof window === "undefined") return false;
  
  const appUrl = getAppUrl(appName);
  const currentUrl = window.location.origin;
  
  return currentUrl === new URL(appUrl).origin;
}

/**
 * Get redirect URL after authentication
 */
export function getRedirectUrl(defaultApp: ProjectName = "cloud"): string {
  if (typeof window === "undefined") {
    return getAppUrl(defaultApp);
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
        "localhost",
      ];
      
      if (allowedDomains.some(domain => url.hostname.includes(domain))) {
        return redirectUrl;
      }
    } catch {
      // Invalid URL, ignore
    }
  }
  
  return getAppUrl(defaultApp);
}