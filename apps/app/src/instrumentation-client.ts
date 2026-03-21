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

// Scrub auth tokens from Sentry navigation breadcrumbs (ported from auth app)
const TOKEN_RE = /token=[^&]+/;
const CLERK_TICKET_RE = /__clerk_ticket=[^&]+/;
const TICKET_RE = /ticket=[^&]+/;

initSentry({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  sendDefaultPii: true,
  tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
  debug: false,
  enableLogs: true,
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.type === "navigation" && breadcrumb.data?.to) {
      breadcrumb.data.to = breadcrumb.data.to
        .replace(TOKEN_RE, "token=REDACTED")
        .replace(CLERK_TICKET_RE, "__clerk_ticket=REDACTED")
        .replace(TICKET_RE, "ticket=REDACTED");
    }
    return breadcrumb;
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
