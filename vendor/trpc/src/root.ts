import { authRouter } from "./router/app/auth";
import { healthRouter } from "./router/app/health";
import { userRouter as userServerRouter } from "./router/app/user";
import { sessionRouter } from "./router/tenant/session";
import { userRouter as userTenantRouter } from "./router/tenant/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  app: {
    auth: authRouter,
    health: healthRouter,
    user: userServerRouter,
  },
  tenant: {
    user: userTenantRouter,
    session: sessionRouter,
  },
});

export type AppRouter = typeof appRouter;
