import * as Sentry from "@sentry/tanstackstart-react";

const dsn =
  process.env.SENTRY_DSN ??
  process.env.VITE_SENTRY_DSN ??
  process.env.NEXT_PUBLIC_SENTRY_DSN;

const environment =
  process.env.NEXT_PUBLIC_VERCEL_ENV ??
  process.env.VERCEL_ENV ??
  process.env.NODE_ENV ??
  "development";

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: true,
    enableLogs: true,
    tracesSampleRate: environment === "production" ? 0.2 : 1.0,
    integrations: [Sentry.extraErrorDataIntegration({ depth: 3 })],
    beforeSendLog(log) {
      if (environment === "production" && log.level === "debug") {
        return null;
      }
      return log;
    },
  });
}

if (process.env.BRAINTRUST_API_KEY) {
  const { LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT } = await import(
    "@repo/ai/telemetry"
  );
  const { registerBraintrustOTel } = await import(
    "@vendor/braintrust/otel-tanstack"
  );

  registerBraintrustOTel({
    parent: LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT,
    serviceName: "lightfast-app",
  });
}
