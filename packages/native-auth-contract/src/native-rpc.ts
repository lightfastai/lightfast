import { z } from "zod";

import { nativeSessionMetadataSchema } from "./native-auth";

export const nativeRpcCommandNames = [
  "auth.session",
  "providerRoutines.find",
  "providerRoutines.call",
] as const;
export const nativeRpcCommandSchema = z.enum(nativeRpcCommandNames);

export const nativeRpcRequestSchema = z
  .object({
    command: nativeRpcCommandSchema,
    input: z.unknown().optional(),
  })
  .strict();

export const nativeRpcAuthSessionInputSchema = z.object({}).strict();

export const nativeRpcBaseErrorCodeNames = [
  "BAD_REQUEST",
  "COMMAND_NOT_FOUND",
  "FORBIDDEN",
  "INTERNAL_SERVER_ERROR",
  "UNAUTHORIZED",
] as const;
export const nativeRpcBaseErrorCodeSchema = z.enum(nativeRpcBaseErrorCodeNames);
export const nativeRpcProviderRoutineErrorCodeSchema = z
  .string()
  .regex(/^PROVIDER_ROUTINE_[A-Z0-9_]+$/);
export const nativeRpcErrorCodeSchema = z.union([
  nativeRpcBaseErrorCodeSchema,
  nativeRpcProviderRoutineErrorCodeSchema,
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
export type NativeRpcBaseErrorCode = z.infer<
  typeof nativeRpcBaseErrorCodeSchema
>;
export type NativeRpcProviderRoutineErrorCode = `PROVIDER_ROUTINE_${string}`;
export type NativeRpcErrorCode =
  | NativeRpcBaseErrorCode
  | NativeRpcProviderRoutineErrorCode;
export type NativeRpcErrorResponse = z.infer<
  typeof nativeRpcErrorResponseSchema
>;
export type NativeRpcSuccessResponse = z.infer<
  typeof nativeRpcSuccessResponseSchema
>;
