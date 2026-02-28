import { withRelatedProject } from "@vendor/related-projects";
import { env } from "../env.js";

/**
 * Gateway base URL derived from Vercel system environment variables.
 */
export const gatewayBaseUrl = (() => {
  if (env.VERCEL_ENV === "preview") {
    return env.VERCEL_URL
      ? `https://${env.VERCEL_URL}/api`
      : "http://localhost:4108/api";
  }

  if (env.VERCEL_ENV === "production") {
    if (!env.VERCEL_PROJECT_PRODUCTION_URL) {
      throw new Error(
        "VERCEL_PROJECT_PRODUCTION_URL is required in production but was not set",
      );
    }
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}/api`;
  }

  return "http://localhost:4108/api";
})();

const isDevelopment =
  env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview";

// Get the console URL dynamically based on environment
export const consoleUrl = withRelatedProject({
  projectName: "lightfast-console",
  defaultHost: isDevelopment
    ? "http://localhost:4107"
    : "https://lightfast.ai",
});
