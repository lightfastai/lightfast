import { z } from "zod";

export const SIGNAL_INPUT_MAX_LENGTH = 4000;
export const SIGNAL_ID_PREFIX = "signal_";

export const signalIdSchema = z
  .string()
  .regex(
    /^signal_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    "Invalid signal id"
  );

export const signalStatusSchema = z.enum([
  "queued",
  "processing",
  "classified",
  "failed",
]);

export const signalDispositionSchema = z.enum([
  "actionable",
  "needs_context",
  "not_actionable",
]);

export const signalKindSchema = z.enum([
  "engage",
  "follow_up",
  "review",
  "fix",
  "investigate",
  "remember",
  "other",
]);

export const signalPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const signalClassificationRoutingSchema = z.object({
  classifyPeople: z
    .object({
      shouldRun: z.boolean(),
      rationale: z.string().trim().min(1),
    })
    .optional(),
});

export const signalClassificationSchema = z.object({
  schemaVersion: z.literal("signal.classification.v1"),
  disposition: signalDispositionSchema,
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1),
  kind: signalKindSchema,
  nextAction: z.string().trim().min(1),
  priority: signalPrioritySchema,
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  routing: signalClassificationRoutingSchema.optional(),
});

export const createSignalInput = z.object({
  input: z.string().trim().min(1).max(SIGNAL_INPUT_MAX_LENGTH),
});

export const createSignalOutput = z.object({
  id: signalIdSchema,
  status: z.literal("queued"),
});

export const getSignalInput = z.object({
  id: signalIdSchema,
});

export const getSignalOutput = z.object({
  id: signalIdSchema,
  input: z.string(),
  status: signalStatusSchema,
  classification: signalClassificationSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SignalClassification = z.infer<typeof signalClassificationSchema>;
export type SignalClassificationRouting = z.infer<
  typeof signalClassificationRoutingSchema
>;
export type SignalStatus = z.infer<typeof signalStatusSchema>;
export type CreateSignalInput = z.infer<typeof createSignalInput>;
export type CreateSignalOutput = z.infer<typeof createSignalOutput>;
export type GetSignalInput = z.infer<typeof getSignalInput>;
export type GetSignalOutput = z.infer<typeof getSignalOutput>;
