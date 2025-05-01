import { createTRPCRouter } from "../trpc";
import { authRouter } from "./router/app/auth";
import { healthRouter } from "./router/app/health";
import { appUserRouter } from "./router/app/user";
import { edgeRouter } from "./router/tenant/edge";
import { nodeRouter } from "./router/tenant/node";
import { workspaceRouter } from "./router/tenant/workspace";

export const appRouter = createTRPCRouter({
  app: {
    auth: authRouter,
    user: appUserRouter,
    health: healthRouter,
  },
  tenant: {
    workspace: workspaceRouter,
    node: nodeRouter,
    edge: edgeRouter,
  },
});

export type AppRouter = typeof appRouter;
