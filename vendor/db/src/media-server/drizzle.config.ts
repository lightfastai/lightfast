import { env } from "env";

import { createDrizzleConfig } from "../utils/create-drizzle-config";

export default createDrizzleConfig({
  uri: env.DATABASE_URL,
  isPoolingUrl: true,
  schema: "./src/media-server/schema/index.ts",
  out: "./src/media-server/migrations",
});
