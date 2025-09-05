import { getAuthUrls, getClerkSubdomainConfig, type ProjectName } from "@repo/vercel-config";

/**
 * Get Clerk configuration for a specific app in a subdomain setup
 * Handles redirects between subdomains (auth.lightfast.ai, cloud.lightfast.ai, etc.)
 * Also handles localhost development with cross-port session sharing
 */
export function getClerkConfig(appName: ProjectName) {
  const authUrls = getAuthUrls();
  const subdomainConfig = getClerkSubdomainConfig(appName);
  
  // Check if we're in development mode with localhost
  const isDevelopment = process.env.NODE_ENV === "development";
  const isLocalhost = authUrls.signIn?.includes("localhost") || authUrls.afterSignIn?.includes("localhost");
  
  // For auth app, we handle redirects differently
  if (appName === "auth") {
    return {
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
      signInFallbackRedirectUrl: authUrls.afterSignIn,
      signUpFallbackRedirectUrl: authUrls.afterSignUp,
      signInForceRedirectUrl: authUrls.afterSignIn,
      signUpForceRedirectUrl: authUrls.afterSignUp,
      ...subdomainConfig,
    };
  }

  // For other apps, redirect to auth subdomain
  return {
    signInUrl: authUrls.signIn,
    signUpUrl: authUrls.signUp,
    signInFallbackRedirectUrl: "/",
    signUpFallbackRedirectUrl: "/",
    afterSignOutUrl: authUrls.afterSignOut,
    ...subdomainConfig,
  };
}

/**
 * Get middleware configuration for Clerk subdomain setup
 * Configures public routes and auth redirects for each subdomain
 */
export function getClerkMiddlewareConfig(appName: ProjectName) {
  const config = getClerkConfig(appName);
  
  if (appName === "auth") {
    return {
      publicRoutes: ["/sign-in", "/sign-in/sso-callback", "/sign-up"],
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