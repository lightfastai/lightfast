import { userRouter } from "./router/auth/user";
import { sessionRouter } from "./router/chat/session";
import { messageRouter } from "./router/chat/message";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
	auth: {
		user: userRouter,
	},
	chat: {
		session: sessionRouter,
		message: messageRouter,
	},
});

export type AppRouter = typeof appRouter;
