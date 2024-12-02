import {
  createApiClient,
  createDbClient,
  getDatabaseUri as getDatabaseUriShared,
} from "@vendor/db";

import { env } from "~/env";

export const db = createDbClient(env.DAHLIA_APP_DB_URL);

export const apiClient = createApiClient(env.DAHLIA_APP_NEON_API_KEY);

export const getDatabaseUri = async (projectId: string) => {
  return getDatabaseUriShared(
    apiClient,
    projectId,
    env.DAHLIA_APP_DB_NAME,
    env.DAHLIA_APP_ROLE_NAME,
  );
};
