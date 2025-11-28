import { defaults, type Options } from "@nosecone/next";

// biome-ignore lint/performance/noBarrelFile: "re-exporting"
export { createMiddleware as securityMiddleware } from "@nosecone/next";

/**
 * Default Nosecone options
 * CSP is disabled by default - apps should configure it based on their needs
 */
export const noseconeOptions: Options = {
  ...defaults,
  contentSecurityPolicy: false,
};
