import { env } from "../env";
import { createDbClient } from "./utils/create-db-client";

// This is a singleton database client.
// It works with process.env defined using t3-oss.
// If using Cloudflare Workers, this singleton can't be used
// since we don't have access to process.env.
export const db = createDbClient(env.POSTGRES_URL);
