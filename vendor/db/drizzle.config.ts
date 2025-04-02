import { env } from "./env";
import { createDrizzleConfig } from "./src/utils/create-drizzle-config";

export default createDrizzleConfig({
  uri: env.DATABASE_URL_UNPOOLED,
  isPoolingUrl: false,
  schema: "src/schema.ts",
  out: "src/migrations",
});
