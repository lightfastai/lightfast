import { env } from "../../env";

import { createDrizzleConfig } from "../utils/create-drizzle-config";

export default createDrizzleConfig({
  host: env.DATABASE_HOST,
  username: env.DATABASE_USERNAME,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  schema: "./src/lightfast/schema/index.ts",
  out: "./src/lightfast/migrations",
});
