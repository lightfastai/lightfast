import {
  captureRouterTransitionStart,
  init as initSentry,
  replayIntegration,
  reportingObserverIntegration,
  spotlightBrowserIntegration,
} from "@sentry/nextjs";
import { initializePostHogAnalytics } from "@vendor/analytics/posthog-instrumentation-client";

import { env } from "~/env";
import { createBaseUrl } from "~/lib/base-url";

initSentry({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  tracesSampleRate: 1.0,
  profilesSampleRate: 0,
  debug: false,
  _experiments: {
    enableLogs: true,
  },
  replaysSessionSampleRate:
    env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.05 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    reportingObserverIntegration({
      types: ["crash", "deprecation", "intervention"],
    }),
    ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
      ? [spotlightBrowserIntegration()]
      : []),
  ],
});

// Initialize PostHog analytics
initializePostHogAnalytics({
  baseUrl: createBaseUrl(),
});

export const onRouterTransitionStart = captureRouterTransitionStart;
