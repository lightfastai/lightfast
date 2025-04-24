import { useCallback } from "react";
import * as Sentry from "@sentry/nextjs";

import type { EarlyAccessErrorType } from "~/components/early-access/errors";

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

    Sentry.setContext("error_context", enrichedContext);
    Sentry.captureException(error, {
      tags: {
        errorType: enrichedContext.errorType,
        component: enrichedContext.component,
        requestId: enrichedContext.requestId,
      },
    });
  }, []);

  return { reportError };
}
