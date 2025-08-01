import { getAuthUrls, getClerkSatelliteConfig, type ProjectName } from "@repo/vercel-config";

/**
 * Get Clerk configuration for a specific app
 */
export function getClerkConfig(appName: ProjectName) {
  const authUrls = getAuthUrls();
  const satelliteConfig = getClerkSatelliteConfig(appName);

  // For auth app, we handle redirects differently
  if (appName === "auth") {
    return {
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
      signInFallbackRedirectUrl: authUrls.afterSignIn,
      signUpFallbackRedirectUrl: authUrls.afterSignUp,
      ...satelliteConfig,
    };
  }

  // For other apps, redirect to auth app
  return {
    signInUrl: authUrls.signIn,
    signUpUrl: authUrls.signUp,
    signInFallbackRedirectUrl: "/",
    signUpFallbackRedirectUrl: "/",
    ...satelliteConfig,
  };
}

/**
 * Get middleware configuration for Clerk
 */
export function getClerkMiddlewareConfig(appName: ProjectName) {
  const config = getClerkConfig(appName);
  
  if (appName === "auth") {
    return {
      publicRoutes: ["/", "/sign-in", "/sign-up"],
      ignoredRoutes: ["/api/health"],
      ...config,
    };
  }

  // Other apps have different public routes
  const publicRoutes = appName === "www" 
    ? ["/", "/api/health", "/api/early-access/*"] 
    : ["/api/health"];

  return {
    publicRoutes,
    ignoredRoutes: [],
    ...config,
  };
}