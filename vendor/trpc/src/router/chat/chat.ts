import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";

export const chatRouter = createTRPCRouter({
  // Chat routes will be implemented here
  health: publicProcedure.query(() => {
    return { status: "ok", service: "lightfast-chat" };
  }),
});