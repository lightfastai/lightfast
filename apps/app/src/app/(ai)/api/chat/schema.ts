import type { Message } from "ai";
import { z } from "zod";

export const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(2000),
});

export const toolInvocationPartSchema = z.object({
  type: z.literal("tool-invocation"),
  result: z.any().optional(),
});

export const partSchema = z.union([textPartSchema, toolInvocationPartSchema]);

// Zod schema for the Vercel AI SDK Message type
// Aligned with the database schema (parts, attachments)
export const messageSchema = z.object({
  id: z.string().nanoid(),
  role: z.enum(["user", "assistant"]),
  createdAt: z.coerce.date(),
  content: z.string().min(1).max(2000),
  parts: z.array(partSchema),
  // Add other fields like tool_calls, tool_call_id, name if used
});

export const postRequestBodySchema = z.object({
  workspaceId: z.string().nanoid(),
  sessionId: z.string().nanoid().nullable(), // Session ID can be null for a new chat
  message: messageSchema,
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
export type TextPart = z.infer<typeof textPartSchema>;
export type ToolInvocationPart = z.infer<typeof toolInvocationPartSchema>;

export const $BaseStreamConfig = z.object({
  workspaceId: z.string().nanoid(),
  sessionId: z.string().nanoid().nullable(),
});

export type BaseStreamConfig = z.infer<typeof $BaseStreamConfig> & {
  messages: Message[];
};
