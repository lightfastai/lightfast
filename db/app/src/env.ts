import type { DatabaseConfig } from "@vendor/db";

type DatabaseEnvironment = Partial<
  Record<"DATABASE_HOST" | "DATABASE_PASSWORD" | "DATABASE_USERNAME", string>
>;

function requireEnvironmentValue(
  environment: DatabaseEnvironment,
  name: keyof DatabaseEnvironment
): string {
  const value = environment[name];
  if (!value) {
    throw new Error(`${name} is required to create the database client.`);
  }
  return value;
}

export function getDatabaseCredentials(
  environment: DatabaseEnvironment = {
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_USERNAME: process.env.DATABASE_USERNAME,
  }
): DatabaseConfig {
  return {
    host: requireEnvironmentValue(environment, "DATABASE_HOST"),
    password: requireEnvironmentValue(environment, "DATABASE_PASSWORD"),
    username: requireEnvironmentValue(environment, "DATABASE_USERNAME"),
  };
}
