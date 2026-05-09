import { systemRouter } from "./router/system/health";
import { createTRPCRouter } from "./trpc";

export const platformRouter = createTRPCRouter({
  system: systemRouter,
});

export type PlatformRouter = typeof platformRouter;
