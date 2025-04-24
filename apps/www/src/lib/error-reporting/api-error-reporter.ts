import {
  RequestContext,
  SecureRequestId,
} from "@vendor/security/requests/create-secure-request-id";

import type { ApiErrorContext } from "./types";
import { env } from "~/env";
import { createSentryReporter } from "./sentry-reporter";

// Create a singleton reporter instance for API errors
const reporter = createSentryReporter({
  disableLogger: env.NODE_ENV === "production",
});

export async function reportApiError(
  error: Error,
  context: ApiErrorContext,
): Promise<void> {
  // Verify request ID before reporting
  const requestContext: RequestContext = {
    method: "unknown",
    path: context.route,
    userAgent: undefined,
  };

  // If request ID is invalid, generate a new one for error tracking
  const isValid = await SecureRequestId.verify(
    context.requestId,
    requestContext,
  );
  const requestId = isValid
    ? context.requestId
    : await SecureRequestId.generate(requestContext);

  // Report error with verified request ID
  await reporter.reportError(error, {
    ...context,
    requestId,
  });
}
