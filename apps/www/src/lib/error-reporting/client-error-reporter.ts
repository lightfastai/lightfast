import { useCallback, useMemo } from "react";

import { useLogger } from "@vendor/observability/use-logger";

import type { ClientErrorContext } from "./types";
import { env } from "~/env";
import { createSentryReporter } from "./sentry-reporter";

export function useErrorReporter() {
  const logger = useLogger();
  const reporter = useMemo(
    () =>
      createSentryReporter({
        disableLogger: env.NODE_ENV === "production",
        logger,
      }),
    [logger],
  );

  const reportError = useCallback(
    (error: Error, context: ClientErrorContext) => {
      return reporter.reportError(error, context);
    },
    [reporter],
  );

  return { reportError };
}
