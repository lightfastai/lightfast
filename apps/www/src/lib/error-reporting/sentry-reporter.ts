import * as Sentry from "@sentry/nextjs";

import { log } from "@vendor/observability/log";

import type { BaseErrorContext, SentryReportingConfig } from "./types";

function logDebug(
  disableLogger: boolean | undefined,
  message: string,
  data?: unknown,
): void {
  if (!disableLogger) {
    log.info(`[Sentry] ${message}`, { data });
  }
}

function setErrorContext(context: BaseErrorContext): void {
  // Set the error context
  Sentry.setContext("error_context", {
    ...context,
    metadata: {
      ...context.metadata,
      timestamp: Date.now(),
    },
  });

  // Set common tags
  Sentry.setTag("errorType", context.errorType);
  Sentry.setTag("requestId", context.requestId);

  // Set component or route tag if present
  if ("component" in context) {
    Sentry.setTag("component", (context as { component: string }).component);
  }
  if ("route" in context) {
    Sentry.setTag("route", (context as { route: string }).route);
  }
}

export function createSentryReporter(config: SentryReportingConfig) {
  return {
    reportError(error: Error, context: BaseErrorContext): void {
      logDebug(config.disableLogger, "Reporting error:", {
        error,
        context,
      });

      try {
        // Set context and capture exception
        setErrorContext(context);

        Sentry.captureException(error, {
          tags: {
            errorType: context.errorType,
            requestId: context.requestId,
          },
          extra: {
            ...context,
            timestamp: Date.now(),
          },
        });

        logDebug(config.disableLogger, "Successfully reported error");
      } catch (sentryError) {
        log.error("[Sentry] Failed to report error:", { sentryError });

        logDebug(config.disableLogger, "Current state:", {
          initialized: Sentry.getClient() !== undefined,
        });
      }
    },
  };
}
