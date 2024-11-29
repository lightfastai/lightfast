import { createInngestEventContext } from "@repo/events/root";

import { okFunction } from "./functions/ok";

// Create an API that serves zero functions
export const { GET, POST, PUT } = createInngestEventContext([okFunction]);
