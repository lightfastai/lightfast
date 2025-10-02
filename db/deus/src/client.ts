import { createDatabase } from "@vendor/db";
import { env } from "../env";
import * as schema from "./schema";

export const db = createDatabase(
  {
    host: env.DATABASE_HOST,
    username: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
  },
  schema
);
