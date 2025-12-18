import { z } from "zod";

/**
 * Primary categories for observation classification
 */
export const primaryCategorySchema = z.enum([
  "bug_fix",
  "feature",
  "refactor",
  "documentation",
  "testing",
  "infrastructure",
  "security",
  "performance",
  "incident",
  "decision",
  "discussion",
  "release",
  "deployment",
  "other",
]);

export type PrimaryCategory = z.infer<typeof primaryCategorySchema>;

/**
 * All valid primary categories
 */
export const PRIMARY_CATEGORIES = primaryCategorySchema.options;

/**
 * LLM classification response schema
 */
export const classificationResponseSchema = z.object({
  primaryCategory: primaryCategorySchema.describe(
    "The main category that best describes this event"
  ),
  secondaryCategories: z
    .array(z.string())
    .max(3)
    .describe("Up to 3 additional relevant categories or tags"),
  topics: z
    .array(z.string())
    .max(5)
    .describe("Key topics or themes extracted from the content"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score from 0.0 to 1.0"),
  reasoning: z
    .string()
    .max(200)
    .optional()
    .describe("Brief explanation for the classification"),
});

export type ClassificationResponse = z.infer<typeof classificationResponseSchema>;
