import { userRouter } from "./router/auth/user";
import { sessionRouter } from "./router/chat/session";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
	auth: {
		user: userRouter,
	},
	chat: {
		session: sessionRouter,
	},
});

export type AppRouter = typeof appRouter;
