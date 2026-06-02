import {
  type ConnectableConnectorProvider,
  connectableConnectorProviderSchema,
} from "@repo/connector-contract";
import { z } from "zod";

export const providerToolNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9_.-]+$/, "Unsupported provider tool name");
export type ProviderToolName = z.infer<typeof providerToolNameSchema>;

export const providerRoutineIdSchema = z.string().refine((routineId) => {
  const separatorIndex = routineId.indexOf("__");
  if (separatorIndex <= 0) {
    return false;
  }

  const provider = routineId.slice(0, separatorIndex);
  const providerToolName = routineId.slice(separatorIndex + 2);

  return (
    connectableConnectorProviderSchema.safeParse(provider).success &&
    providerToolNameSchema.safeParse(providerToolName).success
  );
}, "Unsupported provider routine id");
export type ProviderRoutineId = z.infer<typeof providerRoutineIdSchema>;

export function providerRoutineId(
  provider: ConnectableConnectorProvider,
  providerToolName: string
): ProviderRoutineId {
  const parsedProvider = connectableConnectorProviderSchema.parse(provider);
  const parsedToolName = providerToolNameSchema.parse(providerToolName);
  return providerRoutineIdSchema.parse(`${parsedProvider}__${parsedToolName}`);
}

export function parseProviderRoutineId(routineId: string): {
  provider: ConnectableConnectorProvider;
  providerToolName: ProviderToolName;
} {
  const parsed = providerRoutineIdSchema.parse(routineId);
  const separatorIndex = parsed.indexOf("__");
  const provider = parsed.slice(0, separatorIndex);
  const providerToolName = parsed.slice(separatorIndex + 2);
  return {
    provider: connectableConnectorProviderSchema.parse(provider),
    providerToolName: providerToolNameSchema.parse(providerToolName),
  };
}

export const providerRoutineClassificationSchema = z.enum([
  "read",
  "write",
  "unknown_write_default",
]);
export type ProviderRoutineClassification = z.infer<
  typeof providerRoutineClassificationSchema
>;

export const providerRoutineSourceSurfaceSchema = z.enum([
  "hosted_mcp",
  "native_cli",
  "automation",
  "system",
]);
export type ProviderRoutineSourceSurface = z.infer<
  typeof providerRoutineSourceSurfaceSchema
>;

export const providerRoutineFindInputSchema = z
  .object({
    includeSchema: z.boolean().optional(),
    limit: z.number().int().min(1).max(20).optional(),
    provider: connectableConnectorProviderSchema.optional(),
    query: z.string().min(1).max(200).optional(),
    readOnly: z.boolean().optional(),
    routineId: providerRoutineIdSchema.optional(),
  })
  .strict();
export type ProviderRoutineFindInput = z.infer<
  typeof providerRoutineFindInputSchema
>;

export const providerRoutineSearchReasonSchema = z.enum([
  "no_enabled_providers",
  "no_matching_routines",
]);
export type ProviderRoutineSearchReason = z.infer<
  typeof providerRoutineSearchReasonSchema
>;

export const providerRoutineSummarySchema = z.object({
  classification: providerRoutineClassificationSchema,
  description: z.string().optional(),
  examples: z
    .array(
      z.object({
        input: z.record(z.string(), z.unknown()),
        label: z.string(),
      })
    )
    .optional(),
  inputSchema: z.unknown().optional(),
  inputSummary: z.string().optional(),
  provider: connectableConnectorProviderSchema,
  providerToolName: providerToolNameSchema,
  routineId: providerRoutineIdSchema,
  title: z.string(),
});
export type ProviderRoutineSummary = z.infer<
  typeof providerRoutineSummarySchema
>;

export const providerRoutineFindOutputSchema = z.object({
  reason: providerRoutineSearchReasonSchema.optional(),
  routines: z.array(providerRoutineSummarySchema),
});
export type ProviderRoutineFindOutput = z.infer<
  typeof providerRoutineFindOutputSchema
>;

export const providerRoutineCallInputSchema = z
  .object({
    input: z.record(z.string(), z.unknown()),
    routineId: providerRoutineIdSchema,
  })
  .strict();
export type ProviderRoutineCallInput = z.infer<
  typeof providerRoutineCallInputSchema
>;

export const providerRoutineCallStatusSchema = z.enum(["succeeded", "failed"]);
export type ProviderRoutineCallStatus = z.infer<
  typeof providerRoutineCallStatusSchema
>;

export const providerRoutineErrorCodeSchema = z.enum([
  "PROVIDER_ROUTINE_NOT_FOUND",
  "PROVIDER_ROUTINE_NOT_ENABLED",
  "PROVIDER_ROUTINE_CONNECTION_REQUIRED",
  "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
  "PROVIDER_ROUTINE_INVALID_INPUT",
  "PROVIDER_ROUTINE_AUTH_REQUIRED",
  "PROVIDER_ROUTINE_PROVIDER_FAILED",
  "PROVIDER_ROUTINE_TIMEOUT",
]);
export type ProviderRoutineErrorCode = z.infer<
  typeof providerRoutineErrorCodeSchema
>;

export const providerRoutineCallSuccessSchema = z.object({
  provider: connectableConnectorProviderSchema,
  providerRoutineCallId: z.string().min(1),
  providerToolName: providerToolNameSchema,
  result: z.unknown(),
  routineId: providerRoutineIdSchema,
  status: z.literal("succeeded"),
});
export type ProviderRoutineCallSuccess = z.infer<
  typeof providerRoutineCallSuccessSchema
>;

export const providerRoutineCallFailureSchema = z.object({
  error: z.object({
    code: providerRoutineErrorCodeSchema,
    message: z.string(),
  }),
  providerRoutineCallId: z.string().min(1),
  routineId: providerRoutineIdSchema,
  status: z.literal("failed"),
});
export type ProviderRoutineCallFailure = z.infer<
  typeof providerRoutineCallFailureSchema
>;
