import { createEventContext } from "@vendor/inngest/server";

import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import { handleSendEmailConfirmation } from "~/app/(inngest)/api/inngest/_workflow/send-email-confirmation";

export const maxDuration = 30;

export const { GET, POST, PUT } = createEventContext(inngest, [
  handleSendEmailConfirmation,
]);
