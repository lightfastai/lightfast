import {
  captureConsoleIntegration,
  captureRequestError,
  extraErrorDataIntegration,
  init,
  spotlightIntegration,
} from "@vendor/observability/sentry-nextjs";

import { McpTokenVerificationError } from "~/auth/verify-token";
import { env } from "~/env";

const sharedIntegrations = () => [
  captureConsoleIntegration({ levels: ["error", "warn"] }),
  extraErrorDataIntegration({ depth: 3 }),
];

const beforeSend: NonNullable<Parameters<typeof init>[0]["beforeSend"]> = (
  event,
  hint
) => {
  if (hint?.originalException instanceof McpTokenVerificationError) {
    return null;
  }
  return event;
};

const register = () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    init({
      dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      environment: env.NEXT_PUBLIC_VERCEL_ENV,
      sendDefaultPii: true,
      tracesSampleRate: env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,
      debug: false,
      enableLogs: true,
      includeLocalVariables: true,
      beforeSend,
      integrations: [
        ...sharedIntegrations(),
        ...(env.NEXT_PUBLIC_VERCEL_ENV === "development"
          ? [spotlightIntegration()]
          : []),
      ],
    });
  }
};

register();

export const onRequestError = captureRequestError;
