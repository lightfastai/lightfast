import { createTRPCRouter, publicProcedure } from "../../../trpc";

export const healthRouter = createTRPCRouter({
  health: publicProcedure.query(() => {
    console.log("health check");
    return { status: "ok" };
  }),
});
