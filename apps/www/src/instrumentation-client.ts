import {
  captureRouterTransitionStart,
  init as initSentry,
  replayIntegration,
  reportingObserverIntegration,
  spotlightBrowserIntegration,
} from "@sentry/nextjs";

import { env } from "~/env";

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

export const onRouterTransitionStart = captureRouterTransitionStart;
