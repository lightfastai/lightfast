/**
 * Post-Transform Event Schema (Zod v4)
 *
 * Canonical type definitions for webhook-derived events after transformation.
 * These are the shapes produced by console-webhooks transformers and stored
 * as JSONB in the workspace_events table.
 *
 * Uses zod/v4 for compatibility with @upstash/realtime's type system.
 */

import { z } from "zod/v4";

/**
 * Zod schema for PostTransformActor
 */
export const postTransformActorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * Zod schema for PostTransformReference
 */
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
  url: z.string().url().optional(),
  label: z.string().optional(),
});

/**
 * Zod schema for PostTransformEvent
 * Runtime validation for webhook-derived events after transformation.
 *
 * Validation rules:
 * - title: max 200 chars (allows for prefix like "[PR Opened] ")
 * - body: max 50000 chars (generous limit for full content before sanitization)
 * - occurredAt: ISO 8601 timestamp
 */
export const postTransformEventSchema = z.object({
  source: z.enum(["github", "vercel", "linear", "sentry"]),
  sourceType: z.string().min(1), // Internal format: "pull-request.merged"
  sourceId: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().max(50000),
  actor: postTransformActorSchema.optional(),
  occurredAt: z.iso.datetime(),
  references: z.array(postTransformReferenceSchema),
  metadata: z.record(z.string(), z.unknown()),
});

export type PostTransformEvent = z.infer<typeof postTransformEventSchema>;
export type PostTransformActor = z.infer<typeof postTransformActorSchema>;
export type PostTransformReference = z.infer<typeof postTransformReferenceSchema>;
