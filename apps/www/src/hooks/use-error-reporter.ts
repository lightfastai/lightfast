import { useCallback } from "react";
import * as Sentry from "@sentry/nextjs";

import type { EarlyAccessErrorType } from "~/components/early-access/errors";
import { env } from "~/env";

// Base error context that all errors must include
interface BaseErrorContext {
  component: string;
  requestId: string;
  error: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// Early access specific error context
interface EarlyAccessErrorContext extends BaseErrorContext {
  errorType: EarlyAccessErrorType;
}

// Generic error context for other error types
interface GenericErrorContext extends BaseErrorContext {
  errorType: string;
}

// Union type of all possible error contexts
type ErrorContext = EarlyAccessErrorContext | GenericErrorContext;

export function useErrorReporter() {
  const reportError = useCallback((error: Error, context: ErrorContext) => {
    // Get current timestamp
    const timestamp = Date.now();

    // Extract required fields
    const {
      component,
      errorType,
      requestId,
      error: errorDetail,
      message,
      metadata = {},
    } = context;

    // Create enriched context with all additional data in metadata
    const enrichedContext = {
      component,
      errorType,
      requestId,
      error: errorDetail,
      message,
      metadata: {
        ...metadata,
        timestamp,
      },
    };

    // Add debug logging in development
    if (env.NODE_ENV === "development") {
      console.log("[Sentry] Reporting error:", {
        error,
        context: enrichedContext,
        dsn: env.NEXT_PUBLIC_SENTRY_DSN,
      });
    }

    try {
      // First set the context
      Sentry.setContext("error_context", enrichedContext);

      // Then set some useful tags
      Sentry.setTag("component", enrichedContext.component);
      Sentry.setTag("errorType", enrichedContext.errorType);
      Sentry.setTag("requestId", enrichedContext.requestId);

      // Finally capture the exception
      Sentry.captureException(error, {
        tags: {
          errorType: enrichedContext.errorType,
          component: enrichedContext.component,
          requestId: enrichedContext.requestId,
        },
        extra: enrichedContext,
      });

      // Log success in development
      if (env.NODE_ENV === "development") {
        console.log("[Sentry] Successfully reported error");
      }
    } catch (sentryError) {
      // Log any issues with Sentry reporting
      console.error("[Sentry] Failed to report error:", sentryError);

      // Log the current Sentry state in development
      if (env.NODE_ENV === "development") {
        console.log("[Sentry] Current state:", {
          initialized: Sentry.getClient() !== undefined,
          dsn: env.NEXT_PUBLIC_SENTRY_DSN,
        });
      }
    }
  }, []);

  return { reportError };
}
