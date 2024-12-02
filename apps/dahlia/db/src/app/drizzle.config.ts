import { createDrizzleConfig } from "@vendor/db/config";

import { env } from "~/env";

export default createDrizzleConfig({
  uri: env.DAHLIA_APP_DB_URL,
  isPoolingUrl: false,
  schema: "src/app/schema.ts",
  out: "src/app/migrations",
});
