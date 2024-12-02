import { createDbClient } from "@vendor/db";

import { env } from "~/env";

export const db = createDbClient(env.DAHLIA_APP_DB_URL);
