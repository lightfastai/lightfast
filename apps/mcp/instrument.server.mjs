import * as Sentry from "@sentry/tanstackstart-react";

const dsn =
  process.env.SENTRY_DSN ??
  process.env.VITE_SENTRY_DSN ??
  process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    enableLogs: true,
    tracesSampleRate: 1.0,
  });
}
