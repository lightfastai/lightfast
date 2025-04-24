import type { ApiErrorContext } from "./types";
import { env } from "~/env";
import { createSentryReporter } from "./sentry-reporter";

// Create a singleton reporter instance for API errors
const reporter = createSentryReporter({
  disableLogger: env.NODE_ENV === "production",
});

export function reportApiError(error: Error, context: ApiErrorContext): void {
  // Simply report the error with the provided context
  reporter.reportError(error, {
    ...context,
    requestId: context.requestId || "unknown",
  });
}
