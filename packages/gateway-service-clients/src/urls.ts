import { withRelatedProject } from "@vendor/related-projects";

/**
 * All cross-service URLs route through the console (lightfast.ai) via
 * Next.js rewrites. Uses process.env.VERCEL_ENV directly — available in
 * both Hono services and Next.js server-side contexts.
 */
const consoleBase = withRelatedProject({
  projectName: "lightfast-console",
  defaultHost:
    process.env.VERCEL_ENV !== "production" &&
    process.env.VERCEL_ENV !== "preview"
      ? "http://localhost:3024"
      : "https://lightfast.ai",
});

/** Gateway service URL (cross-service, via console rewrite). */
export const gatewayUrl = `${consoleBase}/services/gateway`;

/** Relay service URL (cross-service, via console rewrite). */
export const relayUrl = `${consoleBase}/services/relay`;

/** Backfill service URL (cross-service, via console rewrite). */
export const backfillUrl = `${consoleBase}/services/backfill`;

/** Console URL (cross-service). */
export const consoleUrl = consoleBase;
