/**
 * Source Event Schema
 *
 * Zod schemas for runtime validation of webhook-derived events.
 * Matches the SourceEvent interface from @repo/console-types.
 */

import { z } from "zod";
import { sourceTypeSchema } from "./sources";

/**
 * Zod schema for SourceActor
 */
export const sourceActorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * Zod schema for SourceReference
 */
export const sourceReferenceSchema = z.object({
  type: z.enum([
    "commit",
    "branch",
    "pr",
    "issue",
    "deployment",
    "project",
    "cycle",
    "assignee",
    "reviewer",
    "team",
    "label",
  ]),
  id: z.string().min(1),
  url: z.string().url().optional(),
  label: z.string().optional(),
});

/**
 * Zod schema for SourceEvent
 * Runtime validation for webhook-derived events
 *
 * Validation rules:
 * - title: max 200 chars (allows for prefix like "[PR Opened] ")
 * - body: max 50000 chars (generous limit for full content before sanitization)
 * - occurredAt: ISO 8601 timestamp with timezone offset
 */
export const sourceEventSchema = z.object({
  source: sourceTypeSchema,
  sourceType: z.string().min(1), // Internal format: "pull-request.merged"
  sourceId: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().max(50000),
  actor: sourceActorSchema.optional(),
  occurredAt: z.string().datetime({ offset: true }),
  references: z.array(sourceReferenceSchema),
  metadata: z.record(z.unknown()),
});

export type SourceEventValidated = z.infer<typeof sourceEventSchema>;
export type SourceActorValidated = z.infer<typeof sourceActorSchema>;
export type SourceReferenceValidated = z.infer<typeof sourceReferenceSchema>;
