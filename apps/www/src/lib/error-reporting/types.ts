import type { Logger } from "@vendor/observability/types";

import type { EarlyAccessErrorType } from "~/components/early-access/errors";

// Base error context that all errors must include
export interface BaseErrorContext {
  errorType: string;
  requestId: string;
  error: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// Client-specific context
export interface ClientErrorContext extends BaseErrorContext {
  component: string;
}

// API-specific context
export interface ApiErrorContext extends BaseErrorContext {
  route: string;
}

// Early access specific error context
export interface EarlyAccessErrorContext extends ClientErrorContext {
  errorType: EarlyAccessErrorType;
}

// Union type for all possible error contexts
export type ErrorContext =
  | ClientErrorContext
  | ApiErrorContext
  | EarlyAccessErrorContext;

// Shared configuration for Sentry reporting
export interface SentryReportingConfig {
  disableLogger: boolean;
  logger: Logger;
}
