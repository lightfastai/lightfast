import { authRouter } from "./router/app/auth";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  app: {
    auth: authRouter,
    // user: appUserRouter,
    // health: healthRouter,
  },
  // tenant: {
  //   workspace: workspaceRouter,
  //   node: nodeRouter,
  //   edge: edgeRouter,
  // },
});

export type AppRouter = typeof appRouter;
