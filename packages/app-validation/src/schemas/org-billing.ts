import { z } from "zod";

export const cancelOrgBillingSubscriptionItemSchema = z.object({
  subscriptionItemId: z.string().min(1),
});
