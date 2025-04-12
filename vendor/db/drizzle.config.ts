import { env } from "env";

import { createDrizzleConfig } from "~/utils/create-drizzle-config";

const config = createDrizzleConfig({
  uri: env.POSTGRES_URL,
  isPoolingUrl: true,
  schema: "./src/schema.ts",
  out: "./src/migrations",
});

export default config;
