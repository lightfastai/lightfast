import { useCallback, useMemo } from "react";

import { log } from "@vendor/observability/log";

import type { ClientErrorContext } from "./types";
import { env } from "~/env";
import { createSentryReporter } from "./sentry-reporter";

export function useErrorReporter() {
  const reporter = useMemo(
    () =>
      createSentryReporter({
        disableLogger: env.NODE_ENV === "production",
      }),
    [],
  );

  const reportError = useCallback(
    (error: Error, context: ClientErrorContext) => {
      log.error("reporting error", { error, context });
      return reporter.reportError(error, context);
    },
    [reporter],
  );

  return { reportError };
}
