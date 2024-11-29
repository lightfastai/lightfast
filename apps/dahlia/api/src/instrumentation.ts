import * as Sentry from "@sentry/nextjs";
import { init } from "@sentry/nextjs";

import { sentryOpts } from "@repo/next/instrumentation";

export const register = () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    init(sentryOpts);
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    init(sentryOpts);
  }
};

export const onRequestError = Sentry.captureRequestError;
