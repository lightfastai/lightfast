import { sessionRouter } from "./router/auth/session";
import { chatAppRouter } from "./router/chat";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: {
    session: sessionRouter,
  },
  chat: chatAppRouter,
});

export type AppRouter = typeof appRouter;
