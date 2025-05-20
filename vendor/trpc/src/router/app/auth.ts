import type { TRPCRouterRecord } from "@trpc/server";

import type { UserSession } from "@vendor/openauth";

import { publicProcedure } from "../../trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session as UserSession;
  }),
} satisfies TRPCRouterRecord;
