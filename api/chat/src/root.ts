/**
 * Chat application root router
 * This is the main router that combines all chat-specific routers
 */

import { createTRPCRouter } from "./trpc";
import { userRouter } from "./router/auth/user";
import { sessionRouter } from "./router/chat/session";
import { messageRouter } from "./router/chat/message";

/**
 * Primary chat app router
 */
export const chatAppRouter = createTRPCRouter({
  auth: {
    user: userRouter,
  },
  chat: {
    session: sessionRouter,
    message: messageRouter,
  },
});

// Export type for use in client
export type ChatAppRouter = typeof chatAppRouter;