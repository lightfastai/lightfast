import { createDatabase } from "@vendor/db";

import { getDatabaseCredentials } from "./env";
import * as schema from "./schema";

export function createClient(credentials = getDatabaseCredentials()) {
  return createDatabase(credentials, schema);
}

export type Database = ReturnType<typeof createClient>;

let client: Database | undefined;

export function getClient(): Database {
  client ??= createClient();
  return client;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = getClient();
    const value = Reflect.get(database as object, property, database);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
