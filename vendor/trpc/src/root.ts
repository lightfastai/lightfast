import { authRouter } from "./router/app/auth";
import { healthRouter } from "./router/app/health";
import { sessionRouter } from "./router/tenant/session";
import { workspaceRouter } from "./router/tenant/workspace";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  app: {
    auth: authRouter,
    health: healthRouter,
  },
  tenant: {
    workspace: workspaceRouter,
    session: sessionRouter,
  },
});

export type AppRouter = typeof appRouter;
