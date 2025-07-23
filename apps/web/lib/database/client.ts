import { Client } from "@planetscale/database";
import { drizzle } from "drizzle-orm/planetscale-serverless";
import { env } from "@/env";

export const planetscaleClient = new Client({
	url: env.DATABASE_URL,
});

export const db = drizzle(planetscaleClient);
