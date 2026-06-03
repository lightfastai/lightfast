import {
  type FlexibleSchema,
  type InferUITools,
  type SafeValidateUIMessagesResult,
  safeValidateUIMessages,
  tool,
  type UIMessage,
} from "@vendor/ai";
import {
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
} from "@repo/provider-routine-contract";
import { z } from "zod";

const lightfastWorkspaceAssistantMessageMetadataObjectSchema = z
  .object({
    generationId: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    source: z.enum(["workspace-assistant"]).optional(),
    streamId: z.string().min(1).optional(),
  })
  .strict();

export const lightfastWorkspaceAssistantMessageMetadataSchema =
  lightfastWorkspaceAssistantMessageMetadataObjectSchema.optional();

const opportunityDataSchema = z
  .object({
    count: z.number().int().min(0).optional(),
    status: z.enum(["retrieved", "empty", "error"]).optional(),
  })
  .strict();

const skillDataSchema = z
  .object({
    skills: z.array(
      z
        .object({
          description: z.string().nullable().optional(),
          name: z.string().nullable().optional(),
          slug: z.string().min(1),
        })
        .strict()
    ),
  })
  .strict();

export interface LightfastWorkspaceAssistantDataParts {
  opportunities?: z.infer<typeof opportunityDataSchema>;
  skills?: z.infer<typeof skillDataSchema>;
}

type LightfastWorkspaceAssistantDataPartsWithUnknownKeys =
  LightfastWorkspaceAssistantDataParts & Record<string, unknown>;

export const lightfastWorkspaceAssistantDataPartSchemas = {
  opportunities: opportunityDataSchema,
  skills: skillDataSchema,
} satisfies {
  [K in "opportunities" | "skills"]: FlexibleSchema<
    LightfastWorkspaceAssistantDataParts[K]
  >;
};

export const lightfastWorkspaceAssistantTools = {
  callProviderRoutine: tool({
    description:
      "Call one connected provider routine by routineId using this workspace's enabled connector.",
    inputSchema: providerRoutineCallInputSchema,
    outputSchema: providerRoutineCallSuccessSchema,
  }),
  findProviderRoutines: tool({
    description:
      "Find connected provider routines available to this workspace through enabled connectors.",
    inputSchema: providerRoutineFindInputSchema,
    outputSchema: providerRoutineFindOutputSchema,
  }),
};

type LightfastWorkspaceAssistantTools = InferUITools<
  typeof lightfastWorkspaceAssistantTools
>;

export type LightfastWorkspaceAssistantMessageMetadata = z.infer<
  typeof lightfastWorkspaceAssistantMessageMetadataObjectSchema
>;

export type LightfastUIMessage = UIMessage<
  LightfastWorkspaceAssistantMessageMetadata,
  LightfastWorkspaceAssistantDataPartsWithUnknownKeys,
  LightfastWorkspaceAssistantTools
>;

export type LightfastWorkspaceAssistantMessagePart =
  LightfastUIMessage["parts"][number];

export function safeValidateLightfastUIMessages(input: {
  messages: unknown;
}): Promise<SafeValidateUIMessagesResult<LightfastUIMessage>> {
  return safeValidateUIMessages<LightfastUIMessage>({
    dataSchemas: lightfastWorkspaceAssistantDataPartSchemas,
    messages: input.messages,
    metadataSchema: lightfastWorkspaceAssistantMessageMetadataSchema,
    tools: lightfastWorkspaceAssistantTools,
  });
}
