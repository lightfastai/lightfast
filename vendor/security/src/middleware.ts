import type { Options } from "@nosecone/next";
import { defaults } from "@nosecone/next";

export { createMiddleware as securityMiddleware } from "@nosecone/next";

/**
 * Default Nosecone options
 * CSP is disabled by default - apps should configure it based on their needs
 */
export const noseconeOptions: Options = {
  ...defaults,
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
};
