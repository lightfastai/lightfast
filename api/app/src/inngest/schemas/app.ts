import { signalIdSchema } from "@repo/api-contract";
import { z } from "zod";

export const appEvents = {
  "app/people.classification.requested": z.object({
    signalId: signalIdSchema,
    clerkOrgId: z.string().min(1),
  }),
  "app/signal.created": z.object({
    signalId: signalIdSchema,
    clerkOrgId: z.string().min(1),
  }),
} as const;
