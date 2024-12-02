import { createApiClient as createNeonApiClient } from "@neondatabase/api-client";
import { drizzle } from "drizzle-orm/neon-serverless";

import type { Db } from "../types/db";

export const createDbClient = (uri: string): Db => {
  return drizzle({
    connection: uri,
    casing: "snake_case",
  });
};

export const createApiClient = (apiKey: string) =>
  createNeonApiClient({
    apiKey,
  });

export const getDatabaseUri = async (
  neonApiClient: ReturnType<typeof createApiClient>,
  projectId: string,
  db_name: string,
  role_name: string,
) => {
  try {
    const { data } = await neonApiClient.getConnectionUri({
      projectId,
      database_name: db_name,
      role_name,
    });
    return data.uri;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to get database URI");
  }
};
