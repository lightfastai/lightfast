import { createTRPCRouter, userScopedProcedure } from "../../trpc";
import { signUserToken } from "@vendor/knock";
import { env } from "@vendor/knock/env";

export const notificationsRouter = createTRPCRouter({
  getToken: userScopedProcedure.query(async ({ ctx }) => {
    // Sign user token with Knock signing key for enhanced security
    const token = await signUserToken(ctx.auth.userId, {
      signingKey: env.KNOCK_SIGNING_KEY,
    });
    return token;
  }),
});
