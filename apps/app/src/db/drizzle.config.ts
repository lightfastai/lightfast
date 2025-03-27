import { createDrizzleConfig } from "@vendor/db/config";

import { env } from "~/env";

export default createDrizzleConfig({
  uri: env.DATABASE_URL_UNPOOLED,
  isPoolingUrl: false,
  schema: "src/app/schema.ts",
  out: "src/app/migrations",
});
