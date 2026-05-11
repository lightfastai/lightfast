import { z } from "zod";

export const systemHealthOutput = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
  version: z.string(),
});

export type SystemHealthOutput = z.infer<typeof systemHealthOutput>;
