import { createEnv } from "@t3-oss/env-nextjs";
import { vendorApiKey } from "@repo/console-validation";

// Base Clerk environment variables
export const clerkEnvBase = createEnv({
  shared: {},
  server: {
    CLERK_SECRET_KEY: vendorApiKey("sk_"),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: vendorApiKey("pk_"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    // Note: Server variables are not included in experimental__runtimeEnv by default
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});

/**
 * Get the Clerk Frontend API URL from the publishable key
 * The publishable key contains a base64-encoded domain that we need for CSP
 * Format: pk_test_<base64> or pk_live_<base64>
 */
export function getClerkFrontendApi(): string {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    // Fallback for development - this will be caught by env validation
    return "";
  }

  // Extract the base64 part after pk_test_ or pk_live_
  const base64Part = publishableKey.split("_")[2];

  if (!base64Part) {
    return "";
  }

  try {
    // Decode the base64 to get the domain
    const decoded = Buffer.from(base64Part, "base64").toString("utf-8");
    // The decoded string contains the domain, extract it
    // Example: "charmed-shark-52.clerk.accounts.dev$"
    const domain = decoded.replace(/\$$/, ""); // Remove trailing $
    return `https://${domain}`;
  } catch {
    // If decoding fails, return empty string
    return "";
  }
}
