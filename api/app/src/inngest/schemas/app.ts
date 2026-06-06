import { signalIdSchema } from "@repo/api-contract";
import {
  automationIdSchema,
  automationRunIdSchema,
} from "@repo/app-validation/schemas";
import { sourceControlRepositoryPushEventSchema } from "@repo/source-control-contract";
import { eventType } from "@vendor/inngest";
import { z } from "zod";

export const appTeamMembersReconcileRequestedEventSchema = z.object({
  cursor: z.number().int().positive().nullable().optional(),
  syncedAtIso: z.string().datetime().optional(),
});

export const appSignalEntityIndexBackfillRequestedEventSchema = z.object({
  clerkOrgId: z.string().min(1),
  confirm: z.literal("prod"),
  cursor: z.number().int().positive().nullable().optional(),
});

export const appEvents = {
  "app/automation.run.requested": eventType("app/automation.run.requested", {
    schema: z.object({
      automationId: automationIdSchema,
      clerkOrgId: z.string().min(1),
      runId: automationRunIdSchema,
      scheduleVersion: z.number().int().positive(),
    }),
  }),
  "app/people.classification.requested": eventType(
    "app/people.classification.requested",
    {
      schema: z.object({
        signalId: signalIdSchema,
        clerkOrgId: z.string().min(1),
      }),
    }
  ),
  "app/team-members.reconcile.requested": eventType(
    "app/team-members.reconcile.requested",
    {
      schema: appTeamMembersReconcileRequestedEventSchema,
    }
  ),
  "app/signal.created": eventType("app/signal.created", {
    schema: z.object({
      signalId: signalIdSchema,
      clerkOrgId: z.string().min(1),
    }),
  }),
  "app/signal.entity-index.requested": eventType(
    "app/signal.entity-index.requested",
    {
      schema: z.object({
        signalId: signalIdSchema,
        clerkOrgId: z.string().min(1),
      }),
    }
  ),
  "app/signal.entity-index.backfill.requested": eventType(
    "app/signal.entity-index.backfill.requested",
    {
      schema: appSignalEntityIndexBackfillRequestedEventSchema,
    }
  ),
  "app/github.repository.push.received": eventType(
    "app/github.repository.push.received",
    {
      schema: sourceControlRepositoryPushEventSchema,
    }
  ),
  "app/skills.index.refresh.requested": eventType(
    "app/skills.index.refresh.requested",
    {
      schema: z.object({
        dedupeKey: z.string().min(1),
        reason: z.enum(["read", "schedule", "setup", "webhook"]),
        sourceControlRepositoryId: z.number().int().positive(),
        targetCommitSha: z.string().min(1).optional(),
      }),
    }
  ),
  "app/skills.index.reconcile.requested": eventType(
    "app/skills.index.reconcile.requested",
    {
      schema: z.object({
        requestedAt: z.string().datetime(),
      }),
    }
  ),
  "app/identity.index.refresh.requested": eventType(
    "app/identity.index.refresh.requested",
    {
      schema: z.object({
        dedupeKey: z.string().min(1),
        reason: z.enum(["read", "schedule", "setup", "webhook"]),
        sourceControlRepositoryId: z.number().int().positive(),
        targetCommitSha: z.string().min(1).optional(),
      }),
    }
  ),
  "app/identity.index.reconcile.requested": eventType(
    "app/identity.index.reconcile.requested",
    {
      schema: z.object({
        requestedAt: z.string().datetime(),
      }),
    }
  ),
} as const;
