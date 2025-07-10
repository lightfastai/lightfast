import { defineConfig } from "drizzle-kit";
import { env } from "./env";

export default defineConfig({
	schema: "./lib/database/schema.ts",
	out: "./lib/database/migrations",
	dialect: "mysql",
	dbCredentials: {
		url: env.DATABASE_URL || "",
	},
});
