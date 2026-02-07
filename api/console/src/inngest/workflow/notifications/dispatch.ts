/**
 * Notification dispatch workflow
 *
 * Listens for observation.captured events and triggers Knock notifications
 * for high-significance observations (score >= 70).
 *
 * This workflow acts as the bridge between Inngest events and Knock's
 * notification orchestration. It:
 * 1. Filters events by significance threshold
 * 2. Fetches organization members from Clerk
 * 3. Triggers the appropriate Knock workflow with individual recipients
 */

import { inngest } from "../../client/client";
import { log } from "@vendor/observability/log";
import { notifications } from "@vendor/knock";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";

/** Minimum significance score to trigger a notification */
const NOTIFICATION_SIGNIFICANCE_THRESHOLD = 70;

/** Knock workflow key for observation notifications (configured in Knock dashboard) */
const OBSERVATION_WORKFLOW_KEY = "observation-captured";

export const notificationDispatch = inngest.createFunction(
  {
    id: "apps-console/notification.dispatch",
    name: "Notification Dispatch",
    description: "Routes high-significance observations to Knock notifications",
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
    } = event.data;

    // Guard: Knock client must be configured
    if (!notifications) {
      log.debug("Knock not configured, skipping notification", { workspaceId });
      return { status: "skipped", reason: "knock_not_configured" };
    }

    // Guard: Only notify for high-significance events
    if (!significanceScore || significanceScore < NOTIFICATION_SIGNIFICANCE_THRESHOLD) {
      return {
        status: "skipped",
        reason: "below_notification_threshold",
        significanceScore,
        threshold: NOTIFICATION_SIGNIFICANCE_THRESHOLD,
      };
    }

    // Guard: Must have org context for notification routing
    if (!clerkOrgId) {
      return { status: "skipped", reason: "missing_clerk_org_id" };
    }

    // Fetch ALL organization members from Clerk (paginated)
    const orgMembers = await step.run("fetch-org-members", async () => {
      try {
        const clerk = await clerkClient();
        const allRecipients: Array<{ id: string; email: string; name: string | undefined }> = [];
        let offset = 0;
        const limit = 100;

        // Paginate through all org members
        while (true) {
          const membershipList = await clerk.organizations.getOrganizationMembershipList({
            organizationId: clerkOrgId,
            limit,
            offset,
          });

          const recipients = membershipList.data
            .filter((membership) =>
              membership.publicUserData?.userId &&
              membership.publicUserData?.identifier
            )
            .map((membership) => {
              const userData = membership.publicUserData!;
              return {
                id: userData.userId!,
                email: userData.identifier!,
                name: userData.firstName && userData.lastName
                  ? `${userData.firstName} ${userData.lastName}`
                  : userData.firstName || undefined,
              };
            });

          allRecipients.push(...recipients);

          // Stop if we got fewer results than the limit (last page)
          if (membershipList.data.length < limit) {
            break;
          }
          offset += limit;
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
        // Re-throw to fail the step and prevent workflow continuation
        throw error;
      }
    });

    // Guard: Validate org members result
    if (!orgMembers || !Array.isArray(orgMembers)) {
      return {
        status: "failed",
        reason: "invalid_org_members_result",
        clerkOrgId,
      };
    }

    // Guard: Must have at least one member to notify
    if (orgMembers.length === 0) {
      return {
        status: "skipped",
        reason: "no_org_members",
        clerkOrgId,
      };
    }

    // Look up workspace name for human-readable templates
    const workspaceName = await step.run("lookup-workspace-name", async () => {
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
        columns: { name: true },
      });
      return workspace?.name ?? workspaceId;
    });

    // Trigger Knock workflow with individual members as recipients
    await step.run("trigger-knock-workflow", async () => {
      if (!notifications) return; // TypeScript guard

      await notifications.workflows.trigger(OBSERVATION_WORKFLOW_KEY, {
        recipients: orgMembers,
        tenant: workspaceId,  // Changed from clerkOrgId — scopes preferences per-workspace
        data: {
          observationId,
          observationType,
          significanceScore,
          topics: topics ?? [],
          clusterId,
          workspaceId,
          workspaceName,  // Human-readable workspace name for templates
        },
      });

      log.info("Knock notification triggered", {
        workspaceId,
        workspaceName,
        observationId,
        clerkOrgId,
        recipientCount: orgMembers.length,
        significanceScore,
      });
    });

    return {
      status: "sent",
      observationId,
      clerkOrgId,
      significanceScore,
    };
  },
);
