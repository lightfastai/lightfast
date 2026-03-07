import { z } from "zod";

export const preTransformVercelWebhookPayloadSchema = z.object({
  id: z.string(),
  type: z.string(),
  createdAt: z.number(),
  region: z.string().nullish(),
  payload: z
    .object({
      deployment: z
        .object({
          id: z.string(),
          name: z.string(),
          url: z.string().optional(),
          readyState: z
            .enum(["READY", "ERROR", "BUILDING", "QUEUED", "CANCELED", "INITIALIZING"])
            .optional(),
          errorCode: z.string().optional(),
          meta: z
            .object({
              githubCommitSha: z.string().optional(),
              githubCommitRef: z.string().optional(),
              githubCommitMessage: z.string().optional(),
              githubCommitAuthorName: z.string().optional(),
              githubCommitAuthorLogin: z.string().optional(),
              githubOrg: z.string().optional(),
              githubRepo: z.string().optional(),
              githubDeployment: z.string().optional(),
              githubCommitOrg: z.string().optional(),
              githubCommitRepo: z.string().optional(),
              githubCommitRepoId: z.string().optional(),
              githubPrId: z.string().optional(),
              githubRepoId: z.string().optional(),
              githubRepoOwnerType: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      target: z.enum(["production", "staging"]).nullable().optional(),
      project: z
        .object({
          id: z.string(),
          name: z.string().optional(),
        })
        .optional(),
      team: z
        .object({
          id: z.string(),
          slug: z.string().optional(),
          name: z.string().optional(),
        })
        .optional(),
      user: z.object({ id: z.string() }).optional(),
      alias: z.array(z.string()).optional(),
      check: z.object({ id: z.string() }).optional(),
      links: z
        .object({
          deployment: z.string().optional(),
          project: z.string().optional(),
        })
        .optional(),
      plan: z.string().optional(),
      regions: z.array(z.string()).optional(),
      fromDeploymentId: z.string().optional(),
      toDeploymentId: z.string().optional(),
    })
    .passthrough(),
});

export const vercelWebhookEventTypeSchema = z.enum([
  "deployment.created",
  "deployment.succeeded",
  "deployment.ready",
  "deployment.error",
  "deployment.canceled",
  "deployment.check-rerequested",
  "deployment.promoted",
  "deployment.rollback",
  "deployment.cleanup",
]);

// ── Relay-level loose webhook payload schema ──

export const vercelWebhookPayloadSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().optional(),
    payload: z
      .object({
        project: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
        team: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type PreTransformVercelWebhookPayload = z.infer<typeof preTransformVercelWebhookPayloadSchema>;
export type VercelWebhookEventType = z.infer<typeof vercelWebhookEventTypeSchema>;
export type VercelWebhookPayload = z.infer<typeof vercelWebhookPayloadSchema>;
