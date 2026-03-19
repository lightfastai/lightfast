import {
  captureConsoleIntegration,
  captureRequestError,
  extraErrorDataIntegration,
  init,
} from "@sentry/nextjs";

import { env } from "~/env";

const register = () => {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME === "nodejs") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NEXT_PUBLIC_VERCEL_ENV,
      sendDefaultPii: true,
      tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
      debug: false,
      enableLogs: true,
      includeLocalVariables: true,
      integrations: [
        captureConsoleIntegration({ levels: ["error", "warn"] }),
        extraErrorDataIntegration({ depth: 3 }),
      ],
    });
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME === "edge") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NEXT_PUBLIC_VERCEL_ENV,
      sendDefaultPii: true,
      tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
      debug: false,
      enableLogs: true,
      integrations: [
        captureConsoleIntegration({ levels: ["error", "warn"] }),
        extraErrorDataIntegration({ depth: 3 }),
      ],
    });
  }
};

register();

export const onRequestError = captureRequestError;
