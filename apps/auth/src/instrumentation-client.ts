import {
  captureConsoleIntegration,
  captureRouterTransitionStart,
  extraErrorDataIntegration,
  httpClientIntegration,
  init as initSentry,
  replayIntegration,
  reportingObserverIntegration,
} from "@sentry/nextjs";

import { env } from "~/env";

initSentry({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  sendDefaultPii: true,
  tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
  debug: false,
  enableLogs: true,
  replaysSessionSampleRate:
    env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.type === "navigation" && breadcrumb.data?.to) {
      breadcrumb.data.to = breadcrumb.data.to
        .replace(/token=[^&]+/, "token=REDACTED")
        .replace(/__clerk_ticket=[^&]+/, "__clerk_ticket=REDACTED")
        .replace(/ticket=[^&]+/, "ticket=REDACTED");
    }
    return breadcrumb;
  },
  integrations: [
    replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    httpClientIntegration({
      failedRequestStatusCodes: [[400, 599]],
    }),
    reportingObserverIntegration({
      types: ["crash", "deprecation", "intervention"],
    }),
    captureConsoleIntegration({ levels: ["error", "warn"] }),
    extraErrorDataIntegration({ depth: 3 }),
  ],
});

export const onRouterTransitionStart = captureRouterTransitionStart;
