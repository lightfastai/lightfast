import {
  captureConsoleIntegration,
  extraErrorDataIntegration,
  init,
  spotlightIntegration,
} from "@vendor/observability/sentry-nextjs";

import { env } from "~/env";

init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_VERCEL_ENV,
  sendDefaultPii: true,
  debug: false,
  enableLogs: true,
  includeLocalVariables: true,
  integrations: [
    captureConsoleIntegration({ levels: ["error", "warn"] }),
    extraErrorDataIntegration({ depth: 3 }),
    ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
      ? [spotlightIntegration()]
      : []),
  ],
});
