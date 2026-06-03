import * as Sentry from "@sentry/nextjs";

import { env } from "~/env";

const environment = env.NEXT_PUBLIC_VERCEL_ENV;

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment,
  sendDefaultPii: true,
  tracesSampleRate: environment === "production" ? 0.2 : 1.0,
  debug: false,
  enableLogs: true,
  beforeSendLog(log) {
    if (environment === "production" && log.level === "debug") {
      return null;
    }
    return log;
  },
  integrations: [Sentry.extraErrorDataIntegration({ depth: 3 })],
});
