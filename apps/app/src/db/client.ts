import { createDbClient } from "@vendor/db";

import { env } from "~/env";

export const db = createDbClient(env.DATABASE_URL);
