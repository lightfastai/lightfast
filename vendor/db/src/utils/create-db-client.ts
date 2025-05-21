import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../lightfast/schema";

export const createDbClient = (url: string) =>
  drizzle({
    client: postgres(url),
    schema,
    casing: "snake_case",
  });

export type DbClient = ReturnType<typeof createDbClient>;
