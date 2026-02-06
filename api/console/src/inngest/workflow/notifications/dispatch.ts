/**
 * Notification dispatch workflow
 *
 * Listens for observation.captured events and triggers Knock notifications
 * for high-significance observations (score >= 70).
 *
 * This workflow acts as the bridge between Inngest events and Knock's
 * notification orchestration. It:
 * 1. Filters events by significance threshold
 * 2. Triggers the appropriate Knock workflow with organization context
 */

import { inngest } from "../../client/client";
import { log } from "@vendor/observability/log";
import { notifications } from "@vendor/knock";

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

    // Trigger Knock workflow with organization as tenant
    // Knock will route the notification to all organization members
    await step.run("trigger-knock-workflow", async () => {
      if (!notifications) return; // TypeScript guard

      await notifications.workflows.trigger(OBSERVATION_WORKFLOW_KEY, {
        recipients: [{ id: clerkOrgId }],
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
