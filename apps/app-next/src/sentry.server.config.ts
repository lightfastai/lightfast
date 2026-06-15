import { LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT } from "@repo/ai/telemetry";
import * as Sentry from "@sentry/nextjs";
import { registerBraintrustOTel } from "@vendor/braintrust/otel";
import { NonRetriableError } from "@vendor/inngest";

import { env } from "~/env";

const environment = env.NEXT_PUBLIC_VERCEL_ENV;

const beforeSend: NonNullable<
  Parameters<typeof Sentry.init>[0]["beforeSend"]
> = (event, hint) => {
  const err = hint?.originalException;
  if (err instanceof NonRetriableError) {
    return null;
  }
  return event;
};

registerBraintrustOTel({
  parent: LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT,
  serviceName: "lightfast-app",
});

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment,
  sendDefaultPii: true,
  tracesSampleRate: environment === "production" ? 0.2 : 1.0,
  debug: false,
  enableLogs: true,
  includeLocalVariables: true,
  beforeSend,
  beforeSendLog(log) {
    if (environment === "production" && log.level === "debug") {
      return null;
    }
    return log;
  },
  integrations: [Sentry.extraErrorDataIntegration({ depth: 3 })],
});
