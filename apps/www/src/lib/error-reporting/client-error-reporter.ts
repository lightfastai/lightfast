import { useCallback, useMemo } from "react";

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
      console.log("reporting error", error, context);
      return reporter.reportError(error, context);
    },
    [reporter],
  );

  return { reportError };
}
