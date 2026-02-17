import {
  captureRouterTransitionStart,
  init as initSentry,
  replayIntegration,
} from "@sentry/nextjs";

import { env } from "~/env";

initSentry({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  profilesSampleRate: 0,
  debug: false,
  _experiments: {
    enableLogs: true,
  },
  replaysSessionSampleRate:
    env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

export const onRouterTransitionStart = captureRouterTransitionStart;
