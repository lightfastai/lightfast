/**
 * Lightweight database SDK for Lightfast infrastructure
 * Provides common database utilities and PlanetScale integration
 */

// Export PlanetScale SDK
export * from "./planetscale";

// Export Drizzle ORM utilities
export * from "drizzle-orm/sql";
export { alias } from "drizzle-orm/pg-core";

// Export shared utilities
export * from "./utils/drizzle-zod";
export * from "./utils/create-drizzle-config";

// Note: Individual database schemas (chat, cloud) are now in their own packages
// This package provides the shared infrastructure layer
