import { z } from "zod";

export const OPPORTUNITY_INPUT_MAX_LENGTH = 4000;

export const opportunityIdSchema = z
  .string()
  .regex(
    /^opp_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    "Invalid opportunity id"
  );

export const opportunityStatusSchema = z.enum([
  "queued",
  "processing",
  "classified",
  "failed",
]);

export const opportunityDispositionSchema = z.enum([
  "actionable",
  "needs_context",
  "not_actionable",
]);

export const opportunityKindSchema = z.enum([
  "engage",
  "follow_up",
  "review",
  "fix",
  "investigate",
  "remember",
  "other",
]);

export const opportunityPrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "urgent",
]);

export const opportunityClassificationSchema = z.object({
  schemaVersion: z.literal("opportunity.classification.v1"),
  disposition: opportunityDispositionSchema,
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1),
  kind: opportunityKindSchema,
  nextAction: z.string().trim().min(1),
  priority: opportunityPrioritySchema,
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
});

export const createOpportunityInput = z.object({
  input: z.string().trim().min(1).max(OPPORTUNITY_INPUT_MAX_LENGTH),
});

export const createOpportunityOutput = z.object({
  id: opportunityIdSchema,
  status: z.literal("queued"),
});

export const getOpportunityInput = z.object({
  id: opportunityIdSchema,
});

export const getOpportunityOutput = z.object({
  id: opportunityIdSchema,
  input: z.string(),
  status: opportunityStatusSchema,
  classification: opportunityClassificationSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type OpportunityClassification = z.infer<
  typeof opportunityClassificationSchema
>;
export type OpportunityStatus = z.infer<typeof opportunityStatusSchema>;
export type CreateOpportunityInput = z.infer<typeof createOpportunityInput>;
export type CreateOpportunityOutput = z.infer<typeof createOpportunityOutput>;
export type GetOpportunityInput = z.infer<typeof getOpportunityInput>;
export type GetOpportunityOutput = z.infer<typeof getOpportunityOutput>;
