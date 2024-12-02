import { createEventContext } from "@repo/events/server";

import { events } from "~/events/client";
import { handleCreateUser } from "./functions/handle-create-user";

// Create an API that serves zero functions
export const { GET, POST, PUT } = createEventContext(events, [
  handleCreateUser,
]);
