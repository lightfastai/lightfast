import {
  captureConsoleIntegration,
  captureRouterTransitionStart,
  extraErrorDataIntegration,
  httpClientIntegration,
  init as initSentry,
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
    // replayIntegration lazy-loaded below
    httpClientIntegration({
      failedRequestStatusCodes: [[400, 599]],
    }),
    captureConsoleIntegration({
      levels: ["error", "warn"],
    }),
    extraErrorDataIntegration({
      depth: 3,
    }),
    // feedbackIntegration lazy-loaded below
    ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
      ? [spotlightBrowserIntegration()]
      : []),
  ],
});

export const onRouterTransitionStart = captureRouterTransitionStart;

// Lazy-load replay and feedback after page is fully interactive
// This defers ~418KB of Sentry integrations from the initial bundle
if (typeof window !== "undefined") {
  const loadLazySentryIntegrations = async () => {
    const Sentry = await import("@sentry/nextjs");

    Sentry.addIntegration(
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      })
    );

    Sentry.addIntegration(
      Sentry.feedbackIntegration({
        colorScheme: "system",
        showBranding: false,
        enableScreenshot: true,
      })
    );
  };

  if (document.readyState === "complete") {
    void loadLazySentryIntegrations();
  } else {
    window.addEventListener("load", () => void loadLazySentryIntegrations(), {
      once: true,
    });
  }
}
