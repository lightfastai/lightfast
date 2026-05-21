import { signalIdSchema } from "@repo/api-contract";
import { z } from "zod";

export const appEvents = {
  "app/signal.created": z.object({
    signalId: signalIdSchema,
    clerkOrgId: z.string().min(1),
  }),
} as const;
