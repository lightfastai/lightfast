import { createEmailClient } from "@vendor/email";

import { env } from "~/env";

export const emailClient = createEmailClient(env.RESEND_API_KEY);
