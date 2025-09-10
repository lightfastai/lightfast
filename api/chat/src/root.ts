/**
 * Chat application root router
 * This is the main router that combines all chat-specific routers
 */

import { createTRPCRouter } from "./trpc";
import { userRouter } from "./router/auth/user";
import { sessionRouter } from "./router/chat/session";
import { messageRouter } from "./router/chat/message";
import { artifactRouter } from "./router/chat/artifact";

/**
 * Primary chat app router - flattened structure
 */
export const chatAppRouter = createTRPCRouter({
	user: userRouter,
	session: sessionRouter,
	message: messageRouter,
	artifact: artifactRouter,
});

// Export type for use in client
export type ChatAppRouter = typeof chatAppRouter;
