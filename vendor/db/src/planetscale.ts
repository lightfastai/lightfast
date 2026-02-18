/**
 * Lightweight PlanetScale database SDK for Lightfast infrastructure
 * Provides a thin wrapper around drizzle-orm and @planetscale/database
 */

import { drizzle  } from "drizzle-orm/planetscale-serverless";
import type {PlanetScaleDatabase} from "drizzle-orm/planetscale-serverless";
import { Client  } from "@planetscale/database";

/**
 * Configuration for creating a PlanetScale database connection
 */
export interface DatabaseConfig {
  host: string;
  username: string;
  password: string;
}

/**
 * Creates a PlanetScale client instance
 */
export function createPlanetScaleClient(config: DatabaseConfig): Client {
  return new Client({
    host: config.host,
    username: config.username,
    password: config.password,
  });
}

/**
 * Creates a Drizzle ORM instance with PlanetScale
 * @param config - Database configuration
 * @param schema - Optional schema object for type safety
 */
export function createDatabase<TSchema extends Record<string, unknown> = Record<string, never>>(
  config: DatabaseConfig,
  schema?: TSchema
): PlanetScaleDatabase<TSchema> {
  const client = createPlanetScaleClient(config);
  return drizzle(client, { schema }) as PlanetScaleDatabase<TSchema>;
}

/**
 * Re-export commonly used types and utilities
 */
export { drizzle } from "drizzle-orm/planetscale-serverless";
export type { PlanetScaleDatabase } from "drizzle-orm/planetscale-serverless";
export { Client } from "@planetscale/database";
export type { Config as PlanetScaleConfig } from "@planetscale/database";