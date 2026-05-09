import { z } from "zod";

import { createTRPCRouter, serviceProcedure } from "../../trpc";

export const systemRouter = createTRPCRouter({
  health: serviceProcedure
    .output(
      z.object({
        status: z.literal("ok"),
        timestamp: z.string(),
        caller: z.string(),
      })
    )
    .query(({ ctx }) => ({
      status: "ok" as const,
      timestamp: new Date().toISOString(),
      caller: ctx.auth.caller,
    })),
});
