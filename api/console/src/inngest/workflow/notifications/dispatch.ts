/**
 * Notification dispatch workflow
 *
 * Listens for observation.captured events and routes notifications through
 * the rubric-driven classifier. Replaces the previous single-threshold
 * (score >= 70) system with category-based classification, worthiness
 * scoring, and workspace maturity gating.
 *
 * Flow:
 * 1. Classify event via rubric (category, worthiness, maturity)
 * 2. If suppressed, return early
 * 3. Filter recipients based on targeting rule
 * 4. Trigger the appropriate Knock workflow
 */

import { inngest } from "../../client/client";
import { log } from "@vendor/observability/log";
import { notifications } from "@vendor/knock";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@db/console/client";
import {
  orgWorkspaces,
  workspaceNeuralObservations,
  workspaceObservationRelationships,
} from "@db/console/schema";
import { eq, or } from "drizzle-orm";
import { classifyNotification } from "./classifier";
import { getWorkspaceMaturity } from "./maturity";
import { filterByTargetingRule } from "./recipient-filter";

export const notificationDispatch = inngest.createFunction(
  {
    id: "apps-console/notification.dispatch",
    name: "Notification Dispatch",
    description:
      "Routes observations through rubric classifier to Knock notifications",
    retries: 3,
    concurrency: {
      limit: 20,
      key: "event.data.workspaceId",
    },
  },
  { event: "apps-console/neural/observation.captured" },
  async ({ event, step }) => {
    const {
      workspaceId,
      clerkOrgId,
      observationId,
      observationType,
      significanceScore,
      topics,
      clusterId,
      actorSourceId,
      actorName: _actorName,
    } = event.data;

    // Guard: Knock client must be configured
    if (!notifications) {
      log.debug("Knock not configured, skipping notification", {
        workspaceId,
      });
      return { status: "skipped", reason: "knock_not_configured" };
    }

    // Guard: Must have org context for notification routing
    if (!clerkOrgId) {
      return { status: "skipped", reason: "missing_clerk_org_id" };
    }

    // Step 1: Get workspace maturity
    const maturity = await step.run("get-workspace-maturity", () =>
      getWorkspaceMaturity(workspaceId),
    );

    // Step 2: Check for cross-tool relationships on this observation
    const hasRelationships = await step.run(
      "check-relationships",
      async () => {
        // Look up the internal BIGINT ID from the external nanoid
        const obs = await db.query.workspaceNeuralObservations.findFirst({
          where: eq(workspaceNeuralObservations.externalId, observationId),
          columns: { id: true },
        });

        if (!obs) return false;

        // Check if this observation has any relationships
        const rel =
          await db.query.workspaceObservationRelationships.findFirst({
            where: or(
              eq(
                workspaceObservationRelationships.sourceObservationId,
                obs.id,
              ),
              eq(
                workspaceObservationRelationships.targetObservationId,
                obs.id,
              ),
            ),
            columns: { id: true },
          });

        return !!rel;
      },
    );

    // Step 3: Classify via rubric
    const decision = classifyNotification({
      observationType,
      significanceScore: significanceScore ?? 0,
      topics: topics ?? [],
      hasRelationships,
      actorId: actorSourceId,
      workspaceMaturity: maturity,
    });

    // If suppressed, return early with decision context
    if (!decision.shouldNotify) {
      log.debug("Notification suppressed by classifier", {
        workspaceId,
        observationId,
        observationType,
        reason: decision.suppressionReason,
        category: decision.category,
        worthiness: decision.worthinessScore?.total,
      });
      return {
        status: "suppressed",
        reason: decision.suppressionReason,
        decision,
      };
    }

    // Step 4: Fetch organization members from Clerk
    const orgMembers = await step.run("fetch-org-members", async () => {
      try {
        const clerk = await clerkClient();
        const allRecipients: { id: string; email: string; name?: string }[] =
          [];
        let offset = 0;
        const pageLimit = 100;

        while (true) {
          const membershipList =
            await clerk.organizations.getOrganizationMembershipList({
              organizationId: clerkOrgId,
              limit: pageLimit,
              offset,
            });

          for (const membership of membershipList.data) {
            const userData = membership.publicUserData;
            if (!userData?.userId || !userData.identifier) continue;

            const firstName = userData.firstName;
            const lastName = userData.lastName;
            allRecipients.push({
              id: userData.userId,
              email: userData.identifier,
              name:
                firstName && lastName
                  ? `${firstName} ${lastName}`
                  : firstName ?? undefined,
            });
          }

          if (membershipList.data.length < pageLimit) {
            break;
          }
          offset += pageLimit;
        }

        log.info("Fetched org members for notification", {
          clerkOrgId,
          memberCount: allRecipients.length,
        });

        return allRecipients;
      } catch (error) {
        log.error("Failed to fetch org members from Clerk", {
          clerkOrgId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    if (orgMembers.length === 0) {
      return {
        status: "skipped",
        reason: "no_org_members",
        clerkOrgId,
      };
    }

    // Step 5: Filter recipients based on targeting rule
    const recipients = filterByTargetingRule(
      orgMembers,
      decision.targetingRule,
      actorSourceId,
    );

    if (recipients.length === 0) {
      return {
        status: "skipped",
        reason: "no_matching_recipients",
        targetingRule: decision.targetingRule,
      };
    }

    // Step 6: Look up workspace name for templates
    const workspaceName = await step.run(
      "lookup-workspace-name",
      async () => {
        const workspace = await db.query.orgWorkspaces.findFirst({
          where: eq(orgWorkspaces.id, workspaceId),
          columns: { name: true },
        });
        return workspace?.name ?? workspaceId;
      },
    );

    // Step 7: Trigger the appropriate Knock workflow
    await step.run("trigger-knock-workflow", async () => {
      if (!notifications) return; // TypeScript guard

      // Map to Knock's InlineIdentifyUserRequest format
      const knockRecipients = recipients.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
      }));

      await notifications.workflows.trigger(decision.knockWorkflowKey, {
        recipients: knockRecipients,
        tenant: workspaceId,
        data: {
          observationId,
          observationType,
          significanceScore,
          topics: topics ?? [],
          clusterId,
          workspaceId,
          workspaceName,
          category: decision.category,
          channelTier: decision.channelTier,
        },
      });

      log.info("Knock notification triggered", {
        workspaceId,
        workspaceName,
        observationId,
        clerkOrgId,
        recipientCount: recipients.length,
        significanceScore,
        knockWorkflow: decision.knockWorkflowKey,
        category: decision.category,
        channelTier: decision.channelTier,
        targetingRule: decision.targetingRule,
        worthiness: decision.worthinessScore?.total,
      });
    });

    return {
      status: "sent",
      observationId,
      clerkOrgId,
      significanceScore,
      knockWorkflow: decision.knockWorkflowKey,
      category: decision.category,
      channelTier: decision.channelTier,
    };
  },
);
