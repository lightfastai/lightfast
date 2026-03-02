import { createServiceLogger } from "@vendor/observability/service-log";

export const log = createServiceLogger({
  token: process.env.LOGTAIL_SOURCE_TOKEN,
  service: "backfill",
  environment: process.env.VERCEL_ENV,
});
