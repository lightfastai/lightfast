import * as Sentry from "@sentry/core";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: 0,
  debug: false,
});
