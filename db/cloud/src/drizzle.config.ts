import { env } from "../env";
import { createDrizzleConfig } from "./utils/create-drizzle-config";

const config = createDrizzleConfig({
	host: env.DATABASE_HOST,
	username: env.DATABASE_USERNAME,
	password: env.DATABASE_PASSWORD,
	database: "lightfast-cloud",
	schema: "./src/schema/index.ts",
	out: "./src/migrations",
});

export default config;