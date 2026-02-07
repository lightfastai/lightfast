import { createTRPCRouter, userScopedProcedure } from "../../trpc";
import { signUserToken } from "@vendor/knock";
import { env } from "@vendor/knock/env";

export const notificationsRouter = createTRPCRouter({
  getToken: userScopedProcedure.query(async ({ ctx }) => {
    // Knock API key must be configured to sign tokens
    if (!env.KNOCK_API_KEY) return null;

    const token = await signUserToken(ctx.auth.userId);
    return token;
  }),
});
