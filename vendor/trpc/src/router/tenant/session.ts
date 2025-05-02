import { inngest } from "../../inngest/client/client";
import { publicProcedure } from "../../trpc";

export const sessionRouter = {
  get: publicProcedure.query(async ({ ctx }) => {
    return ctx.session;
  }),
  create: publicProcedure.mutation(async ({ ctx }) => {
    return ctx.session;
  }),
  blenderAgent: publicProcedure.mutation(async ({ ctx }) => {
    await inngest.send({
      name: "blender-agent/run",
      data: {
        input:
          "Hello, I would like to create a new Blender project. Tell me what I need to do.",
      },
    });
  }),
};
