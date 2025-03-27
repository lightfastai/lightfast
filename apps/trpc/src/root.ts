import { createTRPCRouter } from "@vendor/trpc";

import { authRouter } from "./router/app/auth";
import { appDatabaseRouter } from "./router/app/database";
import { appUserRouter } from "./router/app/user";
import { edgeRouter } from "./router/tenant/edge";
import { nodeRouter } from "./router/tenant/node";
import { workspaceRouter } from "./router/tenant/workspace";

export const appRouter = createTRPCRouter({
  app: {
    auth: authRouter,
    user: appUserRouter,
    database: appDatabaseRouter,
  },
  tenant: {
    workspace: workspaceRouter,
    node: nodeRouter,
    edge: edgeRouter,
  },
});

export type AppRouter = typeof appRouter;
