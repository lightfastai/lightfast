import {
  captureConsoleIntegration,
  captureRouterTransitionStart,
  extraErrorDataIntegration,
  feedbackIntegration,
  httpClientIntegration,
  init as initSentry,
  replayIntegration,
  spotlightBrowserIntegration,
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
    httpClientIntegration({
      failedRequestStatusCodes: [[400, 599]],
    }),
    captureConsoleIntegration({
      levels: ["error", "warn"],
    }),
    extraErrorDataIntegration({
      depth: 3,
    }),
    feedbackIntegration({
      colorScheme: "system",
      showBranding: false,
      enableScreenshot: true,
    }),
    ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
      ? [spotlightBrowserIntegration()]
      : []),
  ],
});

export const onRouterTransitionStart = captureRouterTransitionStart;
