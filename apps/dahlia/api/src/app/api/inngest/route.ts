import { createInngestEventContext } from "@repo/events/root";

import { createDatabaseFunction } from "./functions/db-create";

// Create an API that serves zero functions
export const { GET, POST, PUT } = createInngestEventContext([
  createDatabaseFunction,
]);
