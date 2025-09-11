import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/schema/index.ts",
	out: "./src/migrations",
	dialect: "mysql",
	dbCredentials: {
		url: `mysql://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}/lightfast-app?sslaccept=strict`
	},
	introspect: {
		casing: "camel",
	},
});