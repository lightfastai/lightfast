import {
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
} from "@lightfast/connector-core/provider-routines";
import {
  userConnectorCallInputSchema,
  userConnectorCallSuccessSchema,
  userConnectorFindInputSchema,
  userConnectorFindOutputSchema,
} from "@repo/user-connector-contract";
import {
  type FlexibleSchema,
  type InferUITools,
  type SafeValidateUIMessagesResult,
  safeValidateUIMessages,
  tool,
  type UIMessage,
} from "@vendor/ai";
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

const chatActivityDataSchema = z
  .object({
    id: z.string().min(1).optional(),
    label: z.string().trim().min(1),
    status: z.enum(["running", "completed", "failed"]).optional(),
    icon: z.string().trim().min(1).optional(),
    provider: z.string().trim().min(1).optional(),
    summary: z.string().trim().min(1).optional(),
    details: z.array(z.string().trim().min(1)).optional(),
    sources: z
      .array(
        z
          .object({
            label: z.string().trim().min(1),
            url: z.string().url().optional(),
          })
          .strict()
      )
      .optional(),
  })
  .strict();

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
  activity?: z.infer<typeof chatActivityDataSchema>;
  opportunities?: z.infer<typeof opportunityDataSchema>;
  skills?: z.infer<typeof skillDataSchema>;
}

type LightfastWorkspaceAssistantDataPartsWithUnknownKeys =
  LightfastWorkspaceAssistantDataParts & Record<string, unknown>;

export const lightfastWorkspaceAssistantDataPartSchemas = {
  activity: chatActivityDataSchema,
  opportunities: opportunityDataSchema,
  skills: skillDataSchema,
} satisfies {
  [K in "activity" | "opportunities" | "skills"]: FlexibleSchema<
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
  callUserConnectorTool: tool({
    description:
      "Call one private user connector tool by routineId for the current user.",
    inputSchema: userConnectorCallInputSchema,
    outputSchema: userConnectorCallSuccessSchema,
  }),
  findProviderRoutines: tool({
    description:
      "Find connected provider routines available to this workspace through enabled connectors.",
    inputSchema: providerRoutineFindInputSchema,
    outputSchema: providerRoutineFindOutputSchema,
  }),
  findUserConnectorTools: tool({
    description:
      "Find private user connector tools available to the current user, such as Granola meeting note tools.",
    inputSchema: userConnectorFindInputSchema,
    outputSchema: userConnectorFindOutputSchema,
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
