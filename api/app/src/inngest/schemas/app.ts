import { opportunityIdSchema } from "@repo/api-contract";
import { z } from "zod";

export const appEvents = {
  "app/opportunity.created": z.object({
    opportunityId: opportunityIdSchema,
    clerkOrgId: z.string().min(1),
  }),
} as const;
