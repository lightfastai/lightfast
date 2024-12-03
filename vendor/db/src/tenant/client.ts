import type { Api } from "@neondatabase/api-client";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";

import { createApiClient } from "../shared/client";

// Define the configuration interface to match the API's expected format
interface DatabaseConfig {
  pg_version: number;
  region_id: string;
  org_id: string;
}

export class DatabaseClient {
  private apiClient: Api<unknown>;
  private _pg_version: number;
  private _region_id: string;
  private _org_id: string;

  constructor(apiKey: string, opts: DatabaseConfig) {
    // Create the api client
    this.apiClient = createApiClient(apiKey);

    // Set the config
    this._pg_version = opts.pg_version;
    this._region_id = opts.region_id;
    this._org_id = opts.org_id;
  }

  createDbClient(uri: string) {
    return drizzleServerless(uri, { casing: "snake_case" });
  }

  async createDatabase() {
    try {
      const response = await this.apiClient.createProject({
        project: {
          pg_version: this._pg_version,
          region_id: this._region_id,
          org_id: this._org_id,
        },
      });

      return response.data.project.id;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to create project");
    }
  }

  async getDatabaseUri(projectId: string) {
    try {
      const { data } = await this.apiClient.getConnectionUri({
        projectId,
        database_name: "neondb",
        role_name: "neondb_owner",
      });
      return data.uri;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to get database URI");
    }
  }

  async updateDatabaseSchema(uri: string, migrationsFolder: string) {
    try {
      const client = neon(uri);
      const db = drizzle(client, { casing: "snake_case" });
      await migrate(db, { migrationsFolder });
    } catch (error) {
      console.error(error);
      throw new Error("Failed to update database schema");
    }
  }
}
