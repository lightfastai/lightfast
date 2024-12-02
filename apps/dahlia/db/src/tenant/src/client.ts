import { createApiClient } from "@neondatabase/api-client";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";

import { env } from "~/env";

export const neonApiClient = createApiClient({
  apiKey: env.DAHLIA_APP_NEON_API_KEY,
});

const pg_version = env.DAHLIA_APP_PG_VERSION;
const db_name = env.DAHLIA_APP_DB_NAME;
const role_name = env.DAHLIA_APP_ROLE_NAME;
const region_id = env.DAHLIA_APP_REGION_ID;
const org_id = env.DAHLIA_APP_ORG_ID;

export const createDbClient = (uri: string) => {
  return drizzleServerless(uri, { casing: "snake_case" });
};

// Creates a new database and returns the database ID
export async function createDatabase() {
  try {
    const response = await neonApiClient.createProject({
      project: {
        pg_version,
        region_id,
        org_id,
      },
    });

    return response.data.project.id;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to create project");
  }
}

export const getDatabaseUri = async (projectId: string) => {
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

export const updateDatabaseSchema = async (
  uri: string,
  migrationsFolder: string,
) => {
  try {
    const client = neon(uri);
    const db = drizzle(client, { casing: "snake_case" });
    await migrate(db, { migrationsFolder });
  } catch (error) {
    console.error(error);
    throw new Error("Failed to update database schema");
  }
};
