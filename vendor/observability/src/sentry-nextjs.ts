import * as Sentry from "@sentry/nextjs";

export const captureException = Sentry.captureException;
export const captureRequestError = Sentry.captureRequestError;
export const consoleLoggingIntegration = Sentry.consoleLoggingIntegration;
export const extraErrorDataIntegration = Sentry.extraErrorDataIntegration;
export const init = Sentry.init;
export const logger = Sentry.logger;
export const withServerActionInstrumentation =
  Sentry.withServerActionInstrumentation;
