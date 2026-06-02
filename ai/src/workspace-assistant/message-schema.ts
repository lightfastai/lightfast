import {
  type FlexibleSchema,
  type SafeValidateUIMessagesResult,
  safeValidateUIMessages,
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

type LightfastWorkspaceAssistantDataPart =
  | z.infer<typeof opportunityDataSchema>
  | z.infer<typeof skillDataSchema>;

export interface LightfastWorkspaceAssistantDataParts {
  [key: string]: LightfastWorkspaceAssistantDataPart | undefined;
  opportunities?: z.infer<typeof opportunityDataSchema>;
  skills?: z.infer<typeof skillDataSchema>;
}

export const lightfastWorkspaceAssistantDataPartSchemas = {
  opportunities: opportunityDataSchema,
  skills: skillDataSchema,
} satisfies {
  [K in "opportunities" | "skills"]: FlexibleSchema<
    LightfastWorkspaceAssistantDataParts[K]
  >;
};

export const lightfastWorkspaceAssistantTools = {};

export type LightfastWorkspaceAssistantMessageMetadata = z.infer<
  typeof lightfastWorkspaceAssistantMessageMetadataObjectSchema
>;

export type LightfastUIMessage = UIMessage<
  LightfastWorkspaceAssistantMessageMetadata,
  LightfastWorkspaceAssistantDataParts
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
