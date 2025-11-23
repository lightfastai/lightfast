import { defaults, type Options } from "@nosecone/next";
import { getClerkFrontendApi } from "@vendor/clerk/env";

// biome-ignore lint/performance/noBarrelFile: "re-exporting"
export { createMiddleware as securityMiddleware } from "@nosecone/next";

/**
 * Nosecone options configured for Clerk authentication
 * Extends default security headers with Clerk-specific CSP directives
 *
 * Based on Clerk's CSP requirements:
 * https://clerk.com/docs/security/clerk-csp
 */
export function createClerkNoseconeOptions(): Options {
  const clerkFrontendApi = getClerkFrontendApi();
  const defaultDirectives = defaults.contentSecurityPolicy?.directives;

  return {
    ...defaults,
    contentSecurityPolicy: {
      directives: {
        // Extend default scriptSrc with Clerk and Cloudflare domains
        scriptSrc: [
          ...Array.from(defaultDirectives?.scriptSrc ?? []),
          () => clerkFrontendApi,
          () => "https://challenges.cloudflare.com",
        ] as never,
        // Extend default connectSrc with Clerk API
        connectSrc: [
          ...Array.from(defaultDirectives?.connectSrc ?? []),
          () => clerkFrontendApi,
        ] as never,
        // Extend default imgSrc with Clerk CDN
        imgSrc: [
          ...Array.from(defaultDirectives?.imgSrc ?? []),
          () => "https://img.clerk.com",
        ] as never,
        // Extend default workerSrc with blob support for Clerk
        workerSrc: [
          ...Array.from(defaultDirectives?.workerSrc ?? []),
          "blob:",
        ] as never,
        // Extend default frameSrc with Cloudflare bot protection
        frameSrc: [
          ...Array.from(defaultDirectives?.frameSrc ?? []),
          () => "https://challenges.cloudflare.com",
        ] as never,
        // Keep other directives from defaults
        baseUri: defaultDirectives?.baseUri,
        childSrc: defaultDirectives?.childSrc,
        defaultSrc: defaultDirectives?.defaultSrc,
        fontSrc: defaultDirectives?.fontSrc,
        formAction: defaultDirectives?.formAction,
        frameAncestors: defaultDirectives?.frameAncestors,
        manifestSrc: defaultDirectives?.manifestSrc,
        mediaSrc: defaultDirectives?.mediaSrc,
        objectSrc: defaultDirectives?.objectSrc,
        styleSrc: defaultDirectives?.styleSrc,
      },
    },
  };
}

/**
 * Default Nosecone options
 * CSP is disabled by default - apps should configure it based on their needs
 */
export const noseconeOptions: Options = {
  ...defaults,
  contentSecurityPolicy: false,
};

/**
 * Nosecone options for Clerk-enabled applications
 */
export const noseconeOptionsWithClerk: Options = createClerkNoseconeOptions();
