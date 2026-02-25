import { withRelatedProject } from "@vercel/related-projects";
import { env } from "../env";

/**
 * Gateway base URL derived from Vercel system environment variables.
 */
export const gatewayBaseUrl = (() => {
  if (env.VERCEL_ENV === "preview") {
    return env.VERCEL_URL
      ? `https://${env.VERCEL_URL}`
      : "http://localhost:4108";
  }

  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return "http://localhost:4108";
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
