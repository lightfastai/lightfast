import { createApiClient as createNeonApiClient } from "@neondatabase/api-client";
import { drizzle } from "drizzle-orm/neon-serverless";

import type { Db } from "../types/db";
import { env } from "../../env";

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

// @TODO: remove this to the tenant client
export const apiClient = createApiClient(env.NEON_API_KEY);

export const getDatabaseUri = async (projectId: string) => {
  try {
    const { data } = await apiClient.getConnectionUri({
      projectId,
      database_name: "neondb", // @TODO: make this dynamic
      role_name: "neondb_owner", // @TODO: make this dynamic
    });
    return data.uri;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to get database URI");
  }
};
