import { signalIdSchema } from "@repo/api-contract";
import {
  automationIdSchema,
  automationRunIdSchema,
} from "@repo/app-validation/schemas";
import { sourceControlRepositoryPushEventSchema } from "@repo/source-control-contract";
import { eventType } from "@vendor/inngest";
import { z } from "zod";

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
  "app/signal.created": eventType("app/signal.created", {
    schema: z.object({
      signalId: signalIdSchema,
      clerkOrgId: z.string().min(1),
    }),
  }),
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
        reason: z.enum(["schedule", "setup", "webhook"]),
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
} as const;
