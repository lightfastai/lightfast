import arcjet, {
  
  
  
  
  
  detectBot,
  request,
  shield,
  tokenBucket,
  slidingWindow,
  fixedWindow,
  protectSignup,
  sensitiveInfo
} from "@arcjet/next";
import type {ArcjetBotCategory, ArcjetWellKnownBot, ArcjetMode, ArcjetDecision, ArcjetReason} from "@arcjet/next";
import { env } from "../env";

// Re-export everything from Arcjet for convenience
export * from "@arcjet/decorate";
export { default as arcjet } from "@arcjet/next";
export {
  detectBot,
  fixedWindow,
  protectSignup,
  sensitiveInfo,
  shield,
  tokenBucket,
  slidingWindow,
  request,
  type ArcjetBotCategory,
  type ArcjetWellKnownBot,
  type ArcjetMode,
  type ArcjetDecision,
  type ArcjetReason,
} from "@arcjet/next";
export { setRateLimitHeaders } from "@arcjet/decorate";

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
    reason: reason,
    ip: decision.ip,
  };
};

