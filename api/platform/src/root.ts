import { createTRPCRouter } from "./trpc";

export const platformRouter = createTRPCRouter({});

export const adminRouter = createTRPCRouter({});

export type PlatformRouter = typeof platformRouter;
export type AdminRouter = typeof adminRouter;
