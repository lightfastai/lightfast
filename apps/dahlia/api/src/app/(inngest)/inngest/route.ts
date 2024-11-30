import { handleCreateUser } from "@repo/events";
import { createInngestEventContext } from "@repo/events/root";

// Create an API that serves zero functions
export const { GET, POST, PUT } = createInngestEventContext([handleCreateUser]);
