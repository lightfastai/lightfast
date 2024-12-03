import type { TRPCRouterRecord } from "@trpc/server";

import { publicProcedure } from "@vendor/trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),
} satisfies TRPCRouterRecord;
