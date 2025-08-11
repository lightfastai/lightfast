import { drizzle } from "drizzle-orm/planetscale-serverless";

import { env } from "../env";
import * as schema from "./lightfast/schema";

export const db = drizzle({
  connection: {
    host: env.DATABASE_HOST,
    username: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
  },
  schema,
});
