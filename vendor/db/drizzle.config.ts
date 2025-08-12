import { env } from "./env";

import { createDrizzleConfig } from "./src/utils/create-drizzle-config";

const config = createDrizzleConfig({
	host: env.DATABASE_HOST,
	username: env.DATABASE_USERNAME,
	password: env.DATABASE_PASSWORD,
	database: "lightfast", // Default database name for PlanetScale
	schema: "./src/lightfast/schema/index.ts",
	out: "./src/lightfast/migrations",
});

export default config;
