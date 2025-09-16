/**
 * Chat application root router
 * This is the main router that combines all chat-specific routers
 */

import { createTRPCRouter } from "./trpc";
import { userRouter } from "./router/auth/user";
import { sessionRouter } from "./router/chat/session";
import { messageRouter } from "./router/chat/message";
import { messageFeedbackRouter } from "./router/chat/message-feedback";
import { artifactRouter } from "./router/chat/artifact";
import { usageRouter } from "./router/chat/usage";
import { billingRouter } from "./router/billing/billing";

/**
 * Primary chat app router - flattened structure
 */
export const chatAppRouter = createTRPCRouter({
	user: userRouter,
	session: sessionRouter,
	message: messageRouter,
	messageFeedback: messageFeedbackRouter,
	artifact: artifactRouter,
	usage: usageRouter,
	billing: billingRouter,
});

// Export type for use in client
export type ChatAppRouter = typeof chatAppRouter;
