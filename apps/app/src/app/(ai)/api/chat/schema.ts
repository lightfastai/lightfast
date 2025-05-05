import { z } from "zod";

export const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(2000),
});

// Zod schema for the Vercel AI SDK Message type
// Aligned with the database schema (parts, attachments)
export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user"]),
  createdAt: z.coerce.date(),
  content: z.string().min(1).max(2000),
  parts: z.array(textPartSchema),
  // Add other fields like tool_calls, tool_call_id, name if used
});

export const postRequestBodySchema = z.object({
  workspaceId: z.string().nanoid(),
  sessionId: z.string().nanoid().nullable(), // Session ID can be null for a new chat
  message: messageSchema,
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
export type Message = z.infer<typeof messageSchema>;
export type TextPart = z.infer<typeof textPartSchema>;
