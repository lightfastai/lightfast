/**
 * Lightweight PlanetScale database SDK for Lightfast infrastructure
 * Provides a thin wrapper around drizzle-orm and @planetscale/database
 */

import { Client } from "@planetscale/database";
import type { PlanetScaleDatabase } from "drizzle-orm/planetscale-serverless";
import { drizzle } from "drizzle-orm/planetscale-serverless";

/**
 * Configuration for creating a PlanetScale database connection
 */
export interface DatabaseConfig {
  host: string;
  password: string;
  username: string;
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
export function createDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(config: DatabaseConfig, schema?: TSchema): PlanetScaleDatabase<TSchema> {
  const client = createPlanetScaleClient(config);
  return drizzle(client, { schema }) as PlanetScaleDatabase<TSchema>;
}

export type { Config as PlanetScaleConfig } from "@planetscale/database";
export { Client } from "@planetscale/database";
export type { PlanetScaleDatabase } from "drizzle-orm/planetscale-serverless";
/**
 * Re-export commonly used types and utilities
 */
export { drizzle } from "drizzle-orm/planetscale-serverless";
