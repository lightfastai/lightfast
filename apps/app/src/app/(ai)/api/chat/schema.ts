import { z } from "zod";

// Zod schema for the Vercel AI SDK Message type
// Aligned with the database schema (parts, attachments)
export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system", "tool"]),
  parts: z.unknown(), // Use z.unknown() or a more specific schema if parts structure is known
  attachments: z.unknown().optional(), // Use z.unknown() or a more specific schema
  createdAt: z.date().optional(),
  // Add other fields like tool_calls, tool_call_id, name if used
});

export const postRequestBodySchema = z.object({
  workspaceId: z.string(),
  sessionId: z.string().uuid().nullable(), // Session ID can be null for a new chat
  message: messageSchema,
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
export type Message = z.infer<typeof messageSchema>;
