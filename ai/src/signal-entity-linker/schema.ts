import { z } from "zod";

import { SIGNAL_ENTITY_LINKS_SCHEMA_VERSION } from "./constants";

export const signalEntityTargetTypeSchema = z.enum(["person"]);
export const signalEntityMentionKindSchema = z.enum([
  "name",
  "email",
  "handle",
  "profile_url",
]);
export const signalEntityExtractionMethodSchema = z.enum([
  "deterministic",
  "ai",
]);
export const signalEntityLocalEntityKeySchema = z
  .string()
  .regex(/^person_[1-9][0-9]*$/, "Invalid local entity key");

export const signalEntityLinkCandidateSchema = z.object({
  targetType: signalEntityTargetTypeSchema,
  localEntityKey: signalEntityLocalEntityKeySchema,
  label: z.string().trim().min(1).max(160),
  mentionKind: signalEntityMentionKindSchema,
  anchorText: z.string().trim().min(1).max(240),
  anchorOccurrence: z.number().int().positive().max(100),
  extractionMethod: signalEntityExtractionMethodSchema,
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
});

export const signalEntityLinkingSchema = z.object({
  schemaVersion: z.literal(SIGNAL_ENTITY_LINKS_SCHEMA_VERSION),
  candidates: z.array(signalEntityLinkCandidateSchema).max(10),
});

export const signalEntityLinkCandidateModelSchema =
  signalEntityLinkCandidateSchema.omit({
    extractionMethod: true,
  });

export const signalEntityLinkingModelSchema = z.object({
  candidates: z.array(signalEntityLinkCandidateModelSchema).max(10),
});

export type SignalEntityTargetType = z.infer<
  typeof signalEntityTargetTypeSchema
>;
export type SignalEntityMentionKind = z.infer<
  typeof signalEntityMentionKindSchema
>;
export type SignalEntityExtractionMethod = z.infer<
  typeof signalEntityExtractionMethodSchema
>;
export type SignalEntityLocalEntityKey = z.infer<
  typeof signalEntityLocalEntityKeySchema
>;
export type SignalEntityLinkCandidate = z.infer<
  typeof signalEntityLinkCandidateSchema
>;
export type SignalEntityLinking = z.infer<typeof signalEntityLinkingSchema>;
export type SignalEntityLinkCandidateModelOutput = z.infer<
  typeof signalEntityLinkCandidateModelSchema
>;
export type SignalEntityLinkingModelOutput = z.infer<
  typeof signalEntityLinkingModelSchema
>;
