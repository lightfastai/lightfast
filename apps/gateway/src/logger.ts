import { createServiceLogger } from "@vendor/observability/service-log";
import { env } from "./env.js";

export const log = createServiceLogger({
  token: env.LOGTAIL_SOURCE_TOKEN,
  service: "gateway",
  environment: env.VERCEL_ENV,
});
