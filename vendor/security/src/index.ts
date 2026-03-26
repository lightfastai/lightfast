import type { ArcjetDecision } from "@arcjet/next";
import arcjet from "@arcjet/next";
import { env } from "./env";

export { type ArcjetCanDecorate, setRateLimitHeaders } from "@arcjet/decorate";
// Re-export everything from Arcjet for convenience
export {
  type ArcjetBotCategory,
  type ArcjetDecision,
  type ArcjetMode,
  type ArcjetReason,
  type ArcjetWellKnownBot,
  default as arcjet,
  detectBot,
  fixedWindow,
  protectSignup,
  request,
  sensitiveInfo,
  shield,
  slidingWindow,
  tokenBucket,
  validateEmail,
} from "@arcjet/next";

// Export middleware utilities
export { noseconeOptions, securityMiddleware } from "./middleware";

// Export the Arcjet key for apps to create their own instances
export const ARCJET_KEY = env.ARCJET_KEY;

/**
 * Create a base Arcjet instance with just the key
 * Apps can extend this with their own rules
 */
export const createArcjet = (characteristics: string[] = ["ip.src"]) => {
  return arcjet({
    key: env.ARCJET_KEY,
    characteristics,
    rules: [], // Let apps add their own rules
  });
};

/**
 * Helper to check if a decision was denied and why
 */
export const checkDecision = (decision: ArcjetDecision) => {
  if (!decision.isDenied()) {
    return { denied: false as const };
  }

  const reason = decision.reason;
  return {
    denied: true as const,
    isBot: reason.isBot(),
    isRateLimit: reason.isRateLimit(),
    isShield: reason.isShield(),
    reason,
    ip: decision.ip,
  };
};
