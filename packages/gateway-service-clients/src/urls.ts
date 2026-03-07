import { withRelatedProject } from "@vendor/related-projects";

/**
 * Environment detection for URL resolution.
 * Uses process.env.VERCEL_ENV directly — available in both Hono services
 * and Next.js server-side contexts without importing app-specific env modules.
 */
const isDevelopment =
  process.env.VERCEL_ENV !== "production" &&
  process.env.VERCEL_ENV !== "preview";

/** Gateway service URL (cross-service). */
export const gatewayUrl = `${withRelatedProject({
  projectName: "lightfast-gateway",
  defaultHost: isDevelopment
    ? "http://localhost:4110"
    : "https://gateway.lightfast.ai",
})}/services`;

/** Relay service URL (cross-service). */
export const relayUrl = `${withRelatedProject({
  projectName: "lightfast-relay",
  defaultHost: isDevelopment
    ? "http://localhost:4108"
    : "https://relay.lightfast.ai",
})}/api`;

/** Backfill service URL (cross-service). */
export const backfillUrl = `${withRelatedProject({
  projectName: "lightfast-backfill",
  defaultHost: isDevelopment
    ? "http://localhost:4109"
    : "https://backfill.lightfast.ai",
})}/api`;

/** Console URL (cross-service). */
export const consoleUrl = withRelatedProject({
  projectName: "lightfast-console",
  defaultHost: isDevelopment
    ? "http://localhost:3024"
    : "https://lightfast.ai",
});
