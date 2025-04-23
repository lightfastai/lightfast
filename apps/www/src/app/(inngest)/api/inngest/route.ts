import { createEventContext } from "@vendor/inngest/server";

import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import { handleJoinEarlyAccess } from "./_workflow/join-early-access";

export const maxDuration = 30;

export const { GET, POST, PUT } = createEventContext(inngest, [
  handleJoinEarlyAccess,
]);
