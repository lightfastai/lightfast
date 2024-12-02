import { createEventContext } from "@vendor/inngest/server";

import { inngest } from "~/inngest/client";
import { handleCreateUser } from "./functions/handle-create-user";

// Create an API that serves zero functions
export const { GET, POST, PUT } = createEventContext(inngest, [
  handleCreateUser,
]);
