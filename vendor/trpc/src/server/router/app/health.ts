import { createTRPCRouter, publicProcedure } from "../../../trpc";

export const healthRouter = createTRPCRouter({
  health: publicProcedure.query(() => {
    return { status: "ok" };
  }),
});
