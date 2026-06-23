import {
  consoleLoggingIntegration,
  init as initSentry,
  rewriteFramesIntegration,
  spotlightBrowserIntegration,
} from "@sentry/browser";

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const sentryTunnel = getSentryTunnel(sentryDsn);

initSentry({
  dsn: sentryDsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  debug: false,
  enableLogs: true,
  ...(sentryTunnel ? { tunnel: sentryTunnel } : {}),
  beforeSend(event, hint) {
    if (
      event.exception?.values?.[0]?.value === "NEXT_REDIRECT" ||
      isNextRedirectError(hint.originalException)
    ) {
      return null;
    }

    return event;
  },
  integrations: [
    rewriteFramesIntegration({
      iteratee: (frame) => {
        if (frame.filename) {
          try {
            const { origin } = new URL(frame.filename);
            frame.filename = frame.filename.replace(origin, "app://");
          } catch {
            // Leave non-URL frame filenames unchanged.
          }
        }

        if (frame.filename?.startsWith("app:///_next")) {
          frame.filename = decodeURI(frame.filename);
        }

        if (
          frame.filename?.match(
            /^app:\/\/\/_next\/static\/chunks\/(main-|main-app-|polyfills-|webpack-|framework-|framework\.)[0-9a-f]+\.js$/
          )
        ) {
          frame.in_app = false;
        }

        return frame;
      },
    }),
    consoleLoggingIntegration({ levels: ["error", "warn"] }),
    ...((process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development") === "development"
      ? [spotlightBrowserIntegration()]
      : []),
  ],
});

function isNextRedirectError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const digest = "digest" in error ? error.digest : undefined;

  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;");
}

function getSentryTunnel(dsn: string | undefined) {
  if (!dsn) {
    return;
  }

  try {
    const dsnUrl = new URL(dsn);
    const sentrySaasDsnMatch = dsnUrl.host.match(
      /^o(\d+)\.ingest(?:\.([a-z]{2}))?\.sentry\.io$/
    );
    const projectId = dsnUrl.pathname.split("/").filter(Boolean).at(-1);

    if (!(sentrySaasDsnMatch?.[1] && projectId)) {
      return;
    }

    const regionCode = sentrySaasDsnMatch[2];
    const regionQuery = regionCode ? `&r=${regionCode}` : "";

    return `/monitoring?o=${sentrySaasDsnMatch[1]}&p=${projectId}${regionQuery}`;
  } catch {
    return;
  }
}
