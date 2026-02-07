/**
 * Daily digest notification workflow
 *
 * Runs at 9 AM UTC every day. Aggregates yesterday's observations
 * into a per-workspace summary and sends via Knock daily-digest workflow.
 *
 * Skips seed workspaces (<50 observations) — too early for digests.
 */

import { inngest } from "../../client/client";
import { log } from "@vendor/observability/log";
import { notifications } from "@vendor/knock";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@db/console/client";
import {
  orgWorkspaces,
  workspaceNeuralObservations,
} from "@db/console/schema";
import { eq, gte, and, desc, sql } from "drizzle-orm";
import { getWorkspaceMaturity } from "./maturity";
import { groupBy, buildRecipientsFromMembers } from "./utils";

export const dailyDigest = inngest.createFunction(
  {
    id: "apps-console/notification.daily-digest",
    name: "Daily Notification Digest",
    description:
      "Aggregates yesterday's observations per workspace and sends daily digest emails",
    retries: 2,
    concurrency: { limit: 5 },
  },
  { cron: "0 9 * * *" }, // 9 AM UTC daily
  async ({ step }) => {
    if (!notifications) {
      return { status: "skipped", reason: "knock_not_configured" };
    }

    // Step 1: Find workspaces with recent observations
    const workspaceIds = await step.run(
      "get-active-workspaces",
      async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const results = await db
          .selectDistinct({
            workspaceId: workspaceNeuralObservations.workspaceId,
          })
          .from(workspaceNeuralObservations)
          .where(
            gte(
              workspaceNeuralObservations.capturedAt,
              yesterday.toISOString(),
            ),
          );

        return results.map((r) => r.workspaceId);
      },
    );

    if (workspaceIds.length === 0) {
      return { status: "completed", workspacesProcessed: 0 };
    }

    // Step 2: Process each workspace
    let processed = 0;
    for (const workspaceId of workspaceIds) {
      await step.run(`digest-${workspaceId}`, async () => {
        if (!notifications) return;

        // Check maturity — seed workspaces don't get daily digests
        const maturity = await getWorkspaceMaturity(workspaceId);
        if (maturity === "seed") {
          log.debug("Skipping daily digest for seed workspace", {
            workspaceId,
          });
          return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // Get yesterday's observations ordered by significance
        const observations =
          await db.query.workspaceNeuralObservations.findMany({
            where: and(
              eq(workspaceNeuralObservations.workspaceId, workspaceId),
              gte(
                workspaceNeuralObservations.capturedAt,
                yesterday.toISOString(),
              ),
            ),
            orderBy: [desc(workspaceNeuralObservations.significanceScore)],
            limit: 20,
            columns: {
              title: true,
              observationType: true,
              significanceScore: true,
              source: true,
            },
          });

        if (observations.length === 0) return;

        // Get workspace + org info
        const workspace = await db.query.orgWorkspaces.findFirst({
          where: eq(orgWorkspaces.id, workspaceId),
          columns: { name: true, clerkOrgId: true },
        });

        if (!workspace?.clerkOrgId) return;

        // Get total count (may exceed the 20 we fetched)
        const countResult = await db
          .select({
            count: sql<number>`count(*)`,
          })
          .from(workspaceNeuralObservations)
          .where(
            and(
              eq(workspaceNeuralObservations.workspaceId, workspaceId),
              gte(
                workspaceNeuralObservations.capturedAt,
                yesterday.toISOString(),
              ),
            ),
          );
        const totalCount = countResult[0]?.count ?? observations.length;

        // Get org members
        const clerk = await clerkClient();
        const members =
          await clerk.organizations.getOrganizationMembershipList({
            organizationId: workspace.clerkOrgId,
            limit: 100,
          });

        const recipients = buildRecipientsFromMembers(members.data);

        if (recipients.length === 0) return;

        // Build digest summary
        const bySource = groupBy(observations, "source");

        const summary = {
          totalObservations: totalCount,
          topItems: observations.slice(0, 5).map((o) => ({
            title: o.title,
            type: o.observationType,
            source: o.source,
            score: o.significanceScore,
          })),
          bySource: Object.entries(bySource).map(([source, count]) => [
            source,
            count,
          ]),
        };

        await notifications.workflows.trigger("daily-digest", {
          recipients,
          tenant: workspaceId,
          data: {
            workspaceId,
            workspaceName: workspace.name,
            date: yesterday.toISOString().split("T")[0],
            summary,
          },
        });

        processed++;

        log.info("Daily digest sent", {
          workspaceId,
          workspaceName: workspace.name,
          recipientCount: recipients.length,
          observationCount: totalCount,
        });
      });
    }

    return { status: "completed", workspacesProcessed: processed };
  },
);

