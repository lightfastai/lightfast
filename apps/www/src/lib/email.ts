import { createEmailClient } from "@vendor/email";

import { env } from "~/env";

export const mail = createEmailClient(env.RESEND_API_KEY);
