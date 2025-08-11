import { chatAppRouter } from "./router/chat";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  chat: chatAppRouter,
});

export type AppRouter = typeof appRouter;
