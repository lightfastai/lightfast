import { createDrizzleConfig } from "@vendor/db/create-drizzle-config";

import { env } from "./src/env.js";

export default createDrizzleConfig({
  uri: env.DATABASE_URL_UNPOOLED,
  isPoolingUrl: false,
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
});
