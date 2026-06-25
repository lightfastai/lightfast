import { z } from "zod";
import { connectableConnectorProviderSchema } from "./connectors";
import type { McpScope } from "./mcp";
import {
  providerRoutineClassificationSchema,
  providerRoutineIdSchema,
  providerRoutineSourceSurfaceSchema,
  providerToolNameSchema,
} from "./provider-routines";

export const decisionIdSchema = z.string().min(1);

export const decisionStatusSchema = z.enum(["failed", "running", "succeeded"]);
export type DecisionStatus = z.infer<typeof decisionStatusSchema>;

export const decisionCalledByKindSchema = z.enum([
  "automation",
  "system",
  "user",
]);
export type DecisionCalledByKind = z.infer<typeof decisionCalledByKindSchema>;

const decisionDateTimeSchema = z.union([
  z.date(),
  z
    .string()
    .datetime()
    .transform((value) => new Date(value)),
]);

export const decisionCursorSchema = z.object({
  createdAt: decisionDateTimeSchema,
  id: z.number().int().positive(),
});
export type DecisionCursor = z.infer<typeof decisionCursorSchema>;

export const decisionFindInputSchema = z
  .object({
    cursor: decisionCursorSchema.nullish(),
    limit: z.number().int().min(1).max(100).optional(),
    providers: z.array(connectableConnectorProviderSchema).max(8).optional(),
    query: z
      .string()
      .trim()
      .max(200)
      .transform((value) => value || undefined)
      .optional(),
    since: decisionDateTimeSchema.optional(),
    sourceSurfaces: z
      .array(providerRoutineSourceSurfaceSchema)
      .max(8)
      .optional(),
    statuses: z.array(decisionStatusSchema).max(3).optional(),
    until: decisionDateTimeSchema.optional(),
  })
  .strict();
export type DecisionFindInput = z.input<typeof decisionFindInputSchema>;
export type NormalizedDecisionFindInput = z.infer<
  typeof decisionFindInputSchema
>;

export const decisionGetInputSchema = z
  .object({
    id: decisionIdSchema,
  })
  .strict();
export type DecisionGetInput = z.infer<typeof decisionGetInputSchema>;

export const mcpDecisionScopeSchema = z.enum(["mcp:decisions:read"]);
export type McpDecisionScope = Extract<
  McpScope,
  z.infer<typeof mcpDecisionScopeSchema>
>;

export const mcpDecisionActorSchema = z
  .object({
    clientId: z.string().min(1),
    grantId: z.string().min(1),
    kind: z.literal("mcp"),
    orgId: z.string().min(1),
    scopes: z.array(mcpDecisionScopeSchema).min(1),
    userId: z.string().min(1),
  })
  .strict();
export type McpDecisionActor = z.infer<typeof mcpDecisionActorSchema>;

export const decisionScopeContextSchema = z
  .object({
    decisionRead: z.boolean(),
  })
  .strict();
export type DecisionScopeContext = z.infer<typeof decisionScopeContextSchema>;

export const mcpDecisionFindCommandInputSchema = z
  .object({
    actor: mcpDecisionActorSchema,
    input: decisionFindInputSchema,
    scopes: decisionScopeContextSchema,
  })
  .strict();
export type McpDecisionFindCommandInput = z.infer<
  typeof mcpDecisionFindCommandInputSchema
>;

export const mcpDecisionGetCommandInputSchema = z
  .object({
    actor: mcpDecisionActorSchema,
    input: decisionGetInputSchema,
    scopes: decisionScopeContextSchema,
  })
  .strict();
export type McpDecisionGetCommandInput = z.infer<
  typeof mcpDecisionGetCommandInputSchema
>;

const decisionBaseSchema = z.object({
  calledById: z.string().min(1),
  calledByKind: decisionCalledByKindSchema,
  calledByUserId: z.string().nullable(),
  classification: providerRoutineClassificationSchema,
  createdAt: decisionDateTimeSchema,
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  finishedAt: decisionDateTimeSchema.nullable(),
  id: decisionIdSchema,
  provider: connectableConnectorProviderSchema,
  providerToolName: providerToolNameSchema,
  routineId: providerRoutineIdSchema,
  snippet: z.string(),
  sourceSurface: providerRoutineSourceSurfaceSchema,
  startedAt: decisionDateTimeSchema,
  status: decisionStatusSchema,
  title: z.string().min(1),
});

export const decisionSummarySchema = decisionBaseSchema;
export type DecisionSummary = z.infer<typeof decisionSummarySchema>;

export const decisionRedactedPayloadSchema = z
  .record(z.string(), z.unknown())
  .nullable();

export const decisionDetailSchema = decisionBaseSchema.extend({
  inputRedacted: decisionRedactedPayloadSchema,
  outputRedacted: decisionRedactedPayloadSchema,
  providerActorId: z.string().nullable(),
  providerAttempted: z.boolean(),
  providerConnectionId: z.number().int().positive(),
  providerRoutineCallId: z.string().min(1),
  providerWorkspaceId: z.string().nullable(),
  sourceClientId: z.string().nullable(),
  sourceRef: z.string().nullable(),
  updatedAt: decisionDateTimeSchema,
});
export type DecisionDetail = z.infer<typeof decisionDetailSchema>;

export const decisionFindOutputSchema = z.object({
  items: z.array(decisionSummarySchema),
  nextCursor: decisionCursorSchema.nullable(),
});
export type DecisionFindOutput = z.infer<typeof decisionFindOutputSchema>;

export const decisionGetOutputSchema = decisionDetailSchema;
export type DecisionGetOutput = z.infer<typeof decisionGetOutputSchema>;
