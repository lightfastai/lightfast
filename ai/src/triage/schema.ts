import { z } from "zod";

export const triageSourceProviderSchema = z.enum([
  "github",
  "linear",
  "lightfast",
]);

export const triageSourceTypeSchema = z.enum([
  "issue",
  "pull_request",
  "review_comment",
  "manual_note",
  "signal",
]);

export const triageWorkIntentSchema = z.enum([
  "bug",
  "feature",
  "cleanup",
  "investigation",
  "planning",
  "documentation",
  "question",
  "other",
]);

export const triagePrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "urgent",
]);

export const triageDecisionSchema = z.enum([
  "dismiss",
  "needs_context",
  "link_existing",
  "promote_opportunity",
  "create_task",
]);

export const triageCandidateRelationSchema = z.enum([
  "duplicate",
  "related",
  "supersedes",
  "blocked_by",
  "unrelated",
]);

export const triageActionTypeSchema = z.enum([
  "dismiss",
  "ask_for_context",
  "link_existing",
  "promote_opportunity",
  "create_task",
  "comment",
]);

export const triageOwnerSuggestionSchema = z.object({
  kind: z.enum(["person", "team"]),
  name: z.string().trim().min(1).max(120),
  rationale: z.string().trim().min(1),
});

export const triageActionPayloadSchema = z.object({
  candidateId: z.string().trim().min(1).max(256).optional(),
  destination: z.string().trim().min(1).max(80).optional(),
  externalId: z.string().trim().min(1).max(256).optional(),
  externalUrl: z.string().url().optional(),
  commentBody: z.string().trim().min(1).max(2000).optional(),
});

const triageActionPayloadModelSchema = z.object({
  candidateId: z.string().trim().min(1).max(256).nullable(),
  destination: z.string().trim().min(1).max(80).nullable(),
  externalId: z.string().trim().min(1).max(256).nullable(),
  externalUrl: z.string().trim().min(1).max(2048).nullable(),
  commentBody: z.string().trim().min(1).max(2000).nullable(),
});

export const triageSourceItemSchema = z.object({
  provider: triageSourceProviderSchema,
  sourceType: triageSourceTypeSchema,
  externalId: z.string().trim().min(1).max(256),
  externalUrl: z.string().url().optional(),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().max(8000),
  state: z.string().trim().min(1).max(80).optional(),
  labels: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const triageSourceItemClassificationSchema = z.object({
  schemaVersion: z.literal("triage.source-item-classification.v1"),
  sourceSignal: z.object({
    isUseful: z.boolean(),
    rationale: z.string().trim().min(1),
  }),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1000),
  workIntent: triageWorkIntentSchema,
  priority: triagePrioritySchema,
  triageDecision: triageDecisionSchema,
  suggestedOwner: triageOwnerSuggestionSchema.optional(),
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
});

export const triageSourceItemClassificationModelSchema =
  triageSourceItemClassificationSchema
    .omit({
      schemaVersion: true,
      suggestedOwner: true,
    })
    .extend({
      suggestedOwner: triageOwnerSuggestionSchema.nullable(),
    });

export const triageSimilarityCandidateSchema = z.object({
  candidateId: z.string().trim().min(1).max(256),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().min(1).max(1000),
  sourceProvider: triageSourceProviderSchema,
  sourceType: triageSourceTypeSchema,
  status: z.string().trim().min(1).max(80).optional(),
});

export const triageSimilarityRankSchema = z.object({
  schemaVersion: z.literal("triage.similarity-rank.v1"),
  candidates: z
    .array(
      z.object({
        candidateId: z.string().trim().min(1).max(256),
        relation: triageCandidateRelationSchema,
        rationale: z.string().trim().min(1),
        confidence: z.number().min(0).max(1),
      })
    )
    .max(10),
});

export const triageSimilarityRankModelSchema = triageSimilarityRankSchema.omit({
  schemaVersion: true,
});

export const triageActionRecommendationSchema = z.object({
  schemaVersion: z.literal("triage.action-recommendation.v1"),
  triageDecision: triageDecisionSchema,
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  actions: z
    .array(
      z.object({
        type: triageActionTypeSchema,
        label: z.string().trim().min(1).max(160),
        requiresHumanApproval: z.boolean(),
        rationale: z.string().trim().min(1),
        payload: triageActionPayloadSchema.optional(),
      })
    )
    .min(1)
    .max(5),
});

export const triageActionRecommendationModelSchema =
  triageActionRecommendationSchema
    .omit({
      schemaVersion: true,
    })
    .extend({
      actions: z
        .array(
          z.object({
            type: triageActionTypeSchema,
            label: z.string().trim().min(1).max(160),
            requiresHumanApproval: z.boolean(),
            rationale: z.string().trim().min(1),
            payload: triageActionPayloadModelSchema.nullable(),
          })
        )
        .min(1)
        .max(5),
    });

export type TriageSourceProvider = z.infer<
  typeof triageSourceProviderSchema
>;
export type TriageSourceType = z.infer<typeof triageSourceTypeSchema>;
export type TriageWorkIntent = z.infer<typeof triageWorkIntentSchema>;
export type TriagePriority = z.infer<typeof triagePrioritySchema>;
export type TriageDecision = z.infer<typeof triageDecisionSchema>;
export type TriageCandidateRelation = z.infer<
  typeof triageCandidateRelationSchema
>;
export type TriageActionPayload = z.infer<typeof triageActionPayloadSchema>;
export type TriageSourceItem = z.infer<typeof triageSourceItemSchema>;
export type TriageSimilarityCandidate = z.infer<
  typeof triageSimilarityCandidateSchema
>;
export type TriageSourceItemClassification = z.infer<
  typeof triageSourceItemClassificationSchema
>;
export type TriageSimilarityRank = z.infer<typeof triageSimilarityRankSchema>;
export type TriageActionRecommendation = z.infer<
  typeof triageActionRecommendationSchema
>;
