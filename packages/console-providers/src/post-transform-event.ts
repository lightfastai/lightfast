/**
 * Post-Transform Event Schema
 *
 * Canonical type definitions for webhook-derived events after transformation.
 * These are the shapes produced by provider transformers and stored
 * as JSONB in the workspace_events table.
 */

import { z } from "zod";

export const entityRefSchema = z.object({
  provider: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  title: z.string(),
  url: z.string().url().nullable(),
  state: z.string().nullable(),
});

export const entityRelationSchema = z.object({
  provider: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  title: z.string().nullable(),
  url: z.string().url().nullable(),
  relationshipType: z.string().min(1),
});

export const postTransformEventSchema = z.object({
  deliveryId: z.string().min(1),
  sourceId: z.string().min(1),
  provider: z.string().min(1),
  eventType: z.string().min(1),
  occurredAt: z.iso.datetime(),
  entity: entityRefSchema,
  relations: z.array(entityRelationSchema),
  title: z.string().min(1).max(200),
  body: z.string().max(50_000),
  attributes: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()])
  ),
});

export type EntityRef = z.infer<typeof entityRefSchema>;
export type EntityRelation = z.infer<typeof entityRelationSchema>;
export type PostTransformEvent = z.infer<typeof postTransformEventSchema>;
