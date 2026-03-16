import { initSentryService } from "@vendor/observability/sentry";
import { env } from "./env.js";

initSentryService({
  dsn: env.SENTRY_DSN,
  environment: env.VERCEL_ENV,
  release: env.VERCEL_GIT_COMMIT_SHA,
});
