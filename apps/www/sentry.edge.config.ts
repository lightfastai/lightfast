import {
  consoleLoggingIntegration,
  extraErrorDataIntegration,
  init,
} from "@vendor/observability/sentry-nextjs";

import { env } from "~/env";

init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  sendDefaultPii: true,
  debug: false,
  enableLogs: true,
  integrations: [
    consoleLoggingIntegration({ levels: ["error", "warn"] }),
    extraErrorDataIntegration({ depth: 3 }),
  ],
});
