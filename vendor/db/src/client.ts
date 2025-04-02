import { drizzle } from "drizzle-orm/neon-serverless";

import { env } from "../env";

export const createDbClient = (uri: string) => {
  return drizzle({
    connection: uri,
    casing: "snake_case",
  });
};

export const db = createDbClient(env.DATABASE_URL);
