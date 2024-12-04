<<<<<<< Updated upstream:apps/dahlia/db/src/tenant/src/client.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
=======
import { createApiClient } from "@neondatabase/api-client";
>>>>>>> Stashed changes:packages/db/src/tenant/src/client.ts
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";

import { createApiClient } from "@vendor/db";

<<<<<<< Updated upstream:apps/dahlia/db/src/tenant/src/client.ts
import { env } from "~/env";

const apiClient = createApiClient("something");

const pg_version = env.DAHLIA_APP_PG_VERSION;
const region_id = env.DAHLIA_APP_REGION_ID;
const org_id = env.DAHLIA_APP_ORG_ID;
=======
export const neon_client = createApiClient({ apiKey: env.NEON_API_KEY });
>>>>>>> Stashed changes:packages/db/src/tenant/src/client.ts

export const createDbClient = (uri: string) => {
  return drizzleServerless(uri, { casing: "snake_case" });
};
<<<<<<< Updated upstream:apps/dahlia/db/src/tenant/src/client.ts

// Creates a new database and returns the database ID
export async function createDatabase() {
  try {
    const response = await apiClient.createProject({
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
    const { data } = await apiClient.getConnectionUri({
      projectId,
      database_name: "neondb",
      role_name: "neondb_owner",
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
=======
>>>>>>> Stashed changes:packages/db/src/tenant/src/client.ts
