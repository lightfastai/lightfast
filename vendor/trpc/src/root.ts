import { authRouter } from "./router/app/auth";
import { healthRouter } from "./router/app/health";
import { workspaceRouter } from "./router/tenant/workspace";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  app: {
    auth: authRouter,
    // user: appUserRouter,
    health: healthRouter,
  },
  tenant: {
    workspace: workspaceRouter,
    //   node: nodeRouter,
    //   edge: edgeRouter,
  },
});

export type AppRouter = typeof appRouter;
