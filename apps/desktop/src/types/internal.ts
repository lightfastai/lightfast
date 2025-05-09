import { UseChatHelpers } from "@ai-sdk/react";
import { Attachment, UIMessage } from "ai";
import { z } from "zod";

import { RouterOutputs } from "@vendor/trpc";

export type SessionChatV1Status = UseChatHelpers["status"];

export type SessionChatV1Roles = UseChatHelpers["messages"][0]["role"];

/// @IMPORTANT we don't use 'content' as we ai sdk recommends using 'parts'
export type SessionChatV1Message = Omit<
  UseChatHelpers["messages"][0],
  "content" | "roles"
> & {
  role: SessionChatV1Roles;
};

export type DBSession = RouterOutputs["tenant"]["session"]["get"];

export type DBMessage = DBSession["messages"][0];

export const convertDBMessageToUIMessages = (
  messages: DBMessage[],
): UIMessage[] => {
  return messages.map((message) => ({
    // Note: id will soon be deprecated in @ai-sdk/react
    id: message.id as UIMessage["id"],
    parts: message.parts as UIMessage["parts"],
    createdAt: message.createdAt as UIMessage["createdAt"],
    // Note: content will soon be deprecated in @ai-sdk/react
    content: "",
    role: message.role as UIMessage["role"],
    experimental_attachments: (message.attachments as Array<Attachment>) ?? [],
  }));
};

// Session mode enum (manual mode currently disabled in UI)
export const SessionMode = z.enum(["agent", "manual"]);
export type SessionMode = z.infer<typeof SessionMode>;

// Input status for message input component
export const InputStatus = z.enum(["ready", "thinking", "done"]);
export type InputStatus = z.infer<typeof InputStatus>;

// Record mapping session modes to display labels
export const MODE_LABELS: Record<SessionMode, string> = {
  agent: "Agent",
  manual: "Manual",
};
