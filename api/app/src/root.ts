import type { ApiContext } from "./context";
import { createRouter } from "./router";

const healthRouter = createRouter({
  async check(context: ApiContext) {
    return {
      requestId: context.requestId,
      status: "ok" as const,
      timestamp: context.now().toISOString(),
      version: "0.1.0",
    };
  },
});

export const appRouter = createRouter({ health: healthRouter });
export type AppRouter = typeof appRouter;
