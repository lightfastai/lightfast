import "server-only";

import { PostHog } from "posthog-node";

import { posthogEnv } from "~/env";

export const analytics = new PostHog(posthogEnv.NEXT_PUBLIC_POSTHOG_KEY, {
  host: posthogEnv.NEXT_PUBLIC_POSTHOG_HOST,

  // Don't batch events and flush immediately - we're running in a serverless environment
  flushAt: 1,
  flushInterval: 0,
});
