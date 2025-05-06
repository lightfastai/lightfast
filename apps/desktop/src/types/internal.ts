import { UseChatHelpers } from "@ai-sdk/react";

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

export const convertDBMessageToUIMessage = (
  message: DBMessage,
): SessionChatV1Message => {
  return {
    id: message.id,
    parts: message.parts,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    role: message.role,
  } as SessionChatV1Message;
};
