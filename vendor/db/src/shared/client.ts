import { drizzle } from "drizzle-orm/neon-serverless";

import type { Db } from "../types/db";

export const createDbClient = (uri: string): Db => {
  return drizzle({
    connection: uri,
    casing: "snake_case",
  });
};
