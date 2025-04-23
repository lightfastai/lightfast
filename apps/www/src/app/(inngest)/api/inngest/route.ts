import { createEventContext } from "@vendor/inngest/server";

import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import { handleCreateEarlyAccessContact } from "./_workflow/create-early-access-contact";
import { handleSendEarlyAccessEmail } from "./_workflow/send-early-access-welcome-email";

export const maxDuration = 30;

export const { GET, POST, PUT } = createEventContext(inngest, [
  handleCreateEarlyAccessContact,
  handleSendEarlyAccessEmail,
]);
