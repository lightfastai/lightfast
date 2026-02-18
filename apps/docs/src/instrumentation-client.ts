import {
  captureRouterTransitionStart,
  init as initSentry,
  spotlightBrowserIntegration,
} from "@sentry/nextjs";

import { env } from "~/env";

initSentry({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.1 : 1.0,
  debug: false,
  _experiments: {
    enableLogs: true,
  },
  integrations: [
    ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
      ? [spotlightBrowserIntegration()]
      : []),
  ],
});

export const onRouterTransitionStart = captureRouterTransitionStart;
