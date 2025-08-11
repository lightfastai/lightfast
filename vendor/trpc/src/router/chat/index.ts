import { chatRouter } from "./chat";
import { createTRPCRouter } from "../../trpc";

export const chatAppRouter = createTRPCRouter({
  chat: chatRouter,
});

export type ChatAppRouter = typeof chatAppRouter;