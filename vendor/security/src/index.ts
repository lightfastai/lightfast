import type {
  ArcjetBotCategory,
  ArcjetMode,
  ArcjetWellKnownBot,
} from "@arcjet/next";
import arcjet, { detectBot, request, tokenBucket } from "@arcjet/next";

import { env } from "~/env";

// Re-export the rules to simplify imports inside handlers
export {
  detectBot,
  fixedWindow,
  protectSignup,
  sensitiveInfo,
  shield,
  tokenBucket,
  slidingWindow,
  request,
} from "@arcjet/next";

export { arcjet };

// Create a base Arcjet instance which can be imported and extended in each route.
const base = arcjet({
  // Get your site key from https://app.arcjet.com
  key: env.ARCJET_KEY,
  // Identify the user by their IP address
  characteristics: ["ip.src"],
  rules: [
    // // Protect against common attacks with Arcjet Shield
    // shield({
    //   // Will block requests. Use "DRY_RUN" to log only
    //   mode: "LIVE",
    // }),
    // Other rules are added in different routes
  ],
});

export const secure = async ({
  mode,
  allow,
  sourceRequest,
}: {
  mode: ArcjetMode;
  allow: (ArcjetWellKnownBot | ArcjetBotCategory)[];
  sourceRequest?: Request;
}) => {
  const req = sourceRequest ?? (await request());
  const aj = base.withRule(detectBot({ mode, allow }));
  const decision = await aj.protect(req);

  if (decision.isDenied()) {
    if (decision.reason.isBot()) {
      throw new Error("No bots allowed");
    }

    if (decision.reason.isRateLimit()) {
      throw new Error("Rate limit exceeded");
    }

    throw new Error("Access denied");
  }
};

// @todo: rework this to be more flexible & modular. perhaps custom Error types too?
export const secureWithTokenBucket = async ({
  mode,
  allow,
  requested,
  sourceRequest,
}: {
  mode: ArcjetMode;
  allow: (ArcjetWellKnownBot | ArcjetBotCategory)[];
  requested: number;
  sourceRequest?: Request;
}) => {
  const req = sourceRequest ?? (await request());
  const aj = base
    .withRule(detectBot({ mode, allow }))
    .withRule(
      tokenBucket({ mode: "LIVE", refillRate: 5, interval: 10, capacity: 10 }),
    );
  const decision = await aj.protect(req, { requested });

  if (decision.isDenied()) {
    if (decision.reason.isBot()) {
      throw new Error("No bots allowed");
    }

    if (decision.reason.isRateLimit()) {
      throw new Error("Rate limit exceeded");
    }

    throw new Error("Access denied");
  }
};
