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

    // Fetch organization members from Clerk
    const orgMembers = await step.run("fetch-org-members", async () => {
      const clerk = await clerkClient();
      const membershipList = await clerk.organizations.getOrganizationMembershipList({
        organizationId: clerkOrgId,
      });

      // Map members to recipient format with email addresses
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

      log.info("Fetched org members for notification", {
        clerkOrgId,
        memberCount: recipients.length,
      });

      return recipients;
    });

    // Guard: Must have at least one member to notify
    if (orgMembers.length === 0) {
      return {
        status: "skipped",
        reason: "no_org_members",
        clerkOrgId,
      };
    }

    // Trigger Knock workflow with individual members as recipients
    await step.run("trigger-knock-workflow", async () => {
      if (!notifications) return; // TypeScript guard

      await notifications.workflows.trigger(OBSERVATION_WORKFLOW_KEY, {
        recipients: orgMembers,
        tenant: clerkOrgId,
        data: {
          observationId,
          observationType,
          significanceScore,
          topics: topics ?? [],
          clusterId,
          workspaceId,
        },
      });

      log.info("Knock notification triggered", {
        workspaceId,
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
