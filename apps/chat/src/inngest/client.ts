import { EventSchemas, Inngest } from "inngest";
import type { GenerateSessionTitleEvent } from "./functions/generate-session-title";

// Define all event types for the chat app
type ChatEvents = {
  "chat/session.title.generate": GenerateSessionTitleEvent;
};

// Create the Inngest client for the chat app
export const inngest = new Inngest({
  id: "lightfast-chat",
  schemas: new EventSchemas().fromRecord<ChatEvents>(),
});