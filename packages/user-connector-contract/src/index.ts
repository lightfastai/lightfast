import {
  type UserConnectorProvider,
  userConnectorProviderSchema,
} from "@lightfast/connector-core";
import { z } from "zod";

export const userConnectorToolNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_.-]+$/, "Unsupported user connector tool name");
export type UserConnectorToolName = z.infer<typeof userConnectorToolNameSchema>;

export const userConnectorRoutineIdSchema = z.string().refine((routineId) => {
  const separatorIndex = routineId.indexOf("__");
  if (separatorIndex <= 0) {
    return false;
  }

  const provider = routineId.slice(0, separatorIndex);
  const providerToolName = routineId.slice(separatorIndex + 2);

  return (
    userConnectorProviderSchema.safeParse(provider).success &&
    userConnectorToolNameSchema.safeParse(providerToolName).success
  );
}, "Unsupported user connector routine id");
export type UserConnectorRoutineId = z.infer<
  typeof userConnectorRoutineIdSchema
>;

export function userConnectorRoutineId(
  provider: UserConnectorProvider,
  providerToolName: string
): UserConnectorRoutineId {
  const parsedProvider = userConnectorProviderSchema.parse(provider);
  const parsedToolName = userConnectorToolNameSchema.parse(providerToolName);
  return userConnectorRoutineIdSchema.parse(
    `${parsedProvider}__${parsedToolName}`
  );
}

export function parseUserConnectorRoutineId(routineId: string): {
  provider: UserConnectorProvider;
  providerToolName: UserConnectorToolName;
} {
  const parsed = userConnectorRoutineIdSchema.parse(routineId);
  const separatorIndex = parsed.indexOf("__");
  const provider = parsed.slice(0, separatorIndex);
  const providerToolName = parsed.slice(separatorIndex + 2);
  return {
    provider: userConnectorProviderSchema.parse(provider),
    providerToolName: userConnectorToolNameSchema.parse(providerToolName),
  };
}

export const userConnectorRoutineSummarySchema = z.object({
  description: z.string().optional(),
  inputSchema: z.unknown().optional(),
  inputSummary: z.string().optional(),
  provider: userConnectorProviderSchema,
  providerToolName: userConnectorToolNameSchema,
  routineId: userConnectorRoutineIdSchema,
  title: z.string(),
});
export type UserConnectorRoutineSummary = z.infer<
  typeof userConnectorRoutineSummarySchema
>;

export const userConnectorFindInputSchema = z
  .object({
    includeSchema: z.boolean().optional(),
    limit: z.number().int().min(1).max(20).optional(),
    provider: userConnectorProviderSchema.optional(),
    query: z.string().min(1).max(200).optional(),
    routineId: userConnectorRoutineIdSchema.optional(),
  })
  .strict();
export type UserConnectorFindInput = z.infer<
  typeof userConnectorFindInputSchema
>;

export const userConnectorFindOutputSchema = z.object({
  reason: z
    .enum(["no_connected_user_connectors", "no_matching_tools"])
    .optional(),
  routines: z.array(userConnectorRoutineSummarySchema),
});
export type UserConnectorFindOutput = z.infer<
  typeof userConnectorFindOutputSchema
>;

export const userConnectorCallInputSchema = z
  .object({
    input: z.record(z.string(), z.unknown()),
    routineId: userConnectorRoutineIdSchema,
  })
  .strict();
export type UserConnectorCallInput = z.infer<
  typeof userConnectorCallInputSchema
>;

export const userConnectorCallSuccessSchema = z.object({
  provider: userConnectorProviderSchema,
  providerToolName: userConnectorToolNameSchema,
  result: z.unknown(),
  routineId: userConnectorRoutineIdSchema,
  status: z.literal("succeeded"),
});
export type UserConnectorCallSuccess = z.infer<
  typeof userConnectorCallSuccessSchema
>;
