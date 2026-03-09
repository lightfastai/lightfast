/**
 * Post-Transform Event Schema
 *
 * Canonical type definitions for webhook-derived events after transformation.
 * These are the shapes produced by provider transformers and stored
 * as JSONB in the workspace_events table.
 */

import { z } from "zod";

export const postTransformActorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().nullable(),
  avatarUrl: z.string().url().nullable(),
});

export const postTransformReferenceSchema = z.object({
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
  url: z.string().url().nullable(),
  label: z.string().nullable(),
});

/**
 * Zod schema for PostTransformEvent.
 *
 * `source` is z.string() (not an enum) to avoid a circular dependency
 * with the PROVIDERS registry. Runtime enum validation can be done via
 * `sourceTypeSchema` from the registry if needed at boundaries.
 */
export const postTransformEventSchema = z.object({
  source: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().max(50_000),
  actor: postTransformActorSchema.nullable(),
  occurredAt: z.iso.datetime(),
  references: z.array(postTransformReferenceSchema),
  metadata: z.record(z.string(), z.unknown()),
});

export type PostTransformEvent = z.infer<typeof postTransformEventSchema>;
export type PostTransformActor = z.infer<typeof postTransformActorSchema>;
export type PostTransformReference = z.infer<
  typeof postTransformReferenceSchema
>;
