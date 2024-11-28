import { createInngestEventContext } from "@repo/events/root";

import { helloWorld } from "./functions/test";

// Create an API that serves zero functions
export const { GET, POST, PUT } = createInngestEventContext([helloWorld]);
