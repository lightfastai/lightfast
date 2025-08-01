/**
 * URL configuration for Lightfast apps with Clerk satellite domains
 */

import { getDeploymentUrl, getBranchUrl, isVercel, type ProjectName } from "./project-config";

export interface AppUrls {
  www: string;
  auth: string;
  app: string;
}

/**
 * Production URLs for each app
 */
const PRODUCTION_URLS: AppUrls = {
  www: "https://lightfast.ai",
  auth: "https://auth.lightfast.ai",
  app: "https://app.lightfast.ai",
} as const;

/**
 * Development URLs for local development
 */
const DEVELOPMENT_URLS: AppUrls = {
  www: "http://localhost:4101",
  auth: "http://localhost:4104",
  app: "http://localhost:4103",
} as const;

/**
 * Get the base URL for a specific app
 */
export function getAppUrl(app: ProjectName): string {
  // In production, use production URLs
  if (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV) {
    return PRODUCTION_URLS[app];
  }

  // In Vercel preview deployments, try to construct preview URLs
  if (isVercel() && process.env.VERCEL_ENV === "preview") {
    const branchUrl = getBranchUrl(app);
    if (branchUrl) return branchUrl;
  }

  // In development or as fallback
  if (process.env.NODE_ENV === "development") {
    return DEVELOPMENT_URLS[app];
  }

  // Default to production URLs
  return PRODUCTION_URLS[app];
}

/**
 * Get all app URLs for the current environment
 */
export function getAllAppUrls(): AppUrls {
  return {
    www: getAppUrl("www"),
    auth: getAppUrl("auth"),
    app: getAppUrl("app"),
  };
}

/**
 * Helper to get auth redirect URLs
 */
export function getAuthUrls() {
  const urls = getAllAppUrls();
  
  return {
    signIn: `${urls.auth}/sign-in`,
    signUp: `${urls.auth}/sign-up`,
    afterSignIn: urls.app,
    afterSignUp: urls.app,
    afterSignOut: urls.www,
  };
}

/**
 * Get the current app's URL
 */
export function getCurrentAppUrl(): string {
  const deploymentUrl = getDeploymentUrl();
  if (deploymentUrl) return deploymentUrl;

  // Fallback to environment-specific URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Default to localhost in development
  if (process.env.NODE_ENV === "development") {
    const port = process.env.PORT || "3000";
    return `http://localhost:${port}`;
  }

  // This should not happen in production
  console.warn("Unable to determine current app URL");
  return "http://localhost:3000";
}

/**
 * Helper for Clerk subdomain configuration
 * For subdomain setups, we don't need satellite config - sessions are shared via root domain cookies
 */
export function getClerkSubdomainConfig(currentApp: ProjectName) {
  // For subdomain setups, we only need to specify the domain for production
  // In development, localhost handles this automatically
  if (process.env.NODE_ENV === "production") {
    return {
      domain: "lightfast.ai", // Root domain for cookie sharing
    };
  }

  // No special config needed for development
  return {};
}