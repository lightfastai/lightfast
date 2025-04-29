import { env } from "env";

import { createDrizzleConfig } from "../utils/create-drizzle-config";

export default createDrizzleConfig({
  uri: env.POSTGRES_URL,
  isPoolingUrl: true,
  schema: "./src/lightfast/schema/index.ts",
  out: "./src/lightfast/migrations",
});
