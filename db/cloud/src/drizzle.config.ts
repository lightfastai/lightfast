import { defineConfig } from "drizzle-kit";

import { env } from "../env";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: `mysql://${env.DATABASE_USERNAME}:${env.DATABASE_PASSWORD}@${env.DATABASE_HOST}/lightfast-cloud?ssl={"rejectUnauthorized":true}`,
  },
});
