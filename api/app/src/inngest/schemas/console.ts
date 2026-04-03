import { z } from "zod";

export const consoleEvents = {
  "console/activity.record": z.object({
    clerkOrgId: z.string(),
    category: z.enum([
      "auth",
      "integration",
      "store",
      "job",
      "search",
      "document",
      "permission",
      "api_key",
      "settings",
    ]),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    relatedActivityId: z.string().optional(),
    timestamp: z.string().datetime(),
  }),
};
