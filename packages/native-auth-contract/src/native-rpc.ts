import { z } from "zod";

import { nativeSessionMetadataSchema } from "./native-auth";

export const nativeRpcCommandNames = ["auth.session"] as const;
export const nativeRpcCommandSchema = z.enum(nativeRpcCommandNames);

export const nativeRpcRequestSchema = z
  .object({
    command: nativeRpcCommandSchema,
    input: z.unknown().optional(),
  })
  .strict();

export const nativeRpcAuthSessionInputSchema = z.object({}).strict();

export const nativeRpcErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "COMMAND_NOT_FOUND",
  "FORBIDDEN",
  "INTERNAL_SERVER_ERROR",
  "UNAUTHORIZED",
]);

export const nativeRpcErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: nativeRpcErrorCodeSchema,
        message: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const nativeRpcSuccessResponseSchema = z
  .object({
    ok: z.literal(true),
    result: z.unknown(),
  })
  .strict();

export const nativeRpcAuthSessionSuccessResponseSchema = z
  .object({
    ok: z.literal(true),
    result: nativeSessionMetadataSchema,
  })
  .strict();

export type NativeRpcCommand = z.infer<typeof nativeRpcCommandSchema>;
export type NativeRpcRequest = z.infer<typeof nativeRpcRequestSchema>;
export type NativeRpcErrorCode = z.infer<typeof nativeRpcErrorCodeSchema>;
export type NativeRpcErrorResponse = z.infer<
  typeof nativeRpcErrorResponseSchema
>;
export type NativeRpcSuccessResponse = z.infer<
  typeof nativeRpcSuccessResponseSchema
>;
