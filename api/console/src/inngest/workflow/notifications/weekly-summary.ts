/**
 * Weekly summary notification workflow
 *
 * Runs Monday at 9 AM UTC. Aggregates the past week's observations
 * into per-workspace summaries with velocity trends, top event types,
 * and highlights. Sends via Knock weekly-summary workflow.
 *
 * Available to growing and mature workspaces (not seed).
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
import { eq, gte, and, desc, sql, lt } from "drizzle-orm";
import { getWorkspaceMaturity } from "./maturity";

export const weeklySummary = inngest.createFunction(
  {
    id: "apps-console/notification.weekly-summary",
    name: "Weekly Notification Summary",
    description:
      "Aggregates the past week's observations per workspace with velocity trends",
    retries: 2,
    concurrency: { limit: 5 },
  },
  { cron: "0 9 * * 1" }, // Monday 9 AM UTC
  async ({ step }) => {
    if (!notifications) {
      return { status: "skipped", reason: "knock_not_configured" };
    }

    // Step 1: Find workspaces with observations in the past week
    const workspaceIds = await step.run(
      "get-active-workspaces",
      async () => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const results = await db
          .selectDistinct({
            workspaceId: workspaceNeuralObservations.workspaceId,
          })
          .from(workspaceNeuralObservations)
          .where(
            gte(
              workspaceNeuralObservations.capturedAt,
              oneWeekAgo.toISOString(),
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
      await step.run(`weekly-${workspaceId}`, async () => {
        if (!notifications) return;

        // Check maturity — seed workspaces don't get weekly summaries
        const maturity = await getWorkspaceMaturity(workspaceId);
        if (maturity === "seed") {
          log.debug("Skipping weekly summary for seed workspace", {
            workspaceId,
          });
          return;
        }

        const now = new Date();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(now.getDate() - 14);

        // Get this week's top observations
        const observations =
          await db.query.workspaceNeuralObservations.findMany({
            where: and(
              eq(workspaceNeuralObservations.workspaceId, workspaceId),
              gte(
                workspaceNeuralObservations.capturedAt,
                oneWeekAgo.toISOString(),
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

        // Count this week vs last week for velocity
        const [thisWeekResult, lastWeekResult] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)` })
            .from(workspaceNeuralObservations)
            .where(
              and(
                eq(workspaceNeuralObservations.workspaceId, workspaceId),
                gte(
                  workspaceNeuralObservations.capturedAt,
                  oneWeekAgo.toISOString(),
                ),
              ),
            ),
          db
            .select({ count: sql<number>`count(*)` })
            .from(workspaceNeuralObservations)
            .where(
              and(
                eq(workspaceNeuralObservations.workspaceId, workspaceId),
                gte(
                  workspaceNeuralObservations.capturedAt,
                  twoWeeksAgo.toISOString(),
                ),
                lt(
                  workspaceNeuralObservations.capturedAt,
                  oneWeekAgo.toISOString(),
                ),
              ),
            ),
        ]);

        const thisWeekCount = thisWeekResult[0]?.count ?? 0;
        const lastWeekCount = lastWeekResult[0]?.count ?? 0;

        // Get workspace + org info
        const workspace = await db.query.orgWorkspaces.findFirst({
          where: eq(orgWorkspaces.id, workspaceId),
          columns: { name: true, clerkOrgId: true },
        });

        if (!workspace?.clerkOrgId) return;

        // Get org members
        const clerk = await clerkClient();
        const members =
          await clerk.organizations.getOrganizationMembershipList({
            organizationId: workspace.clerkOrgId,
            limit: 100,
          });

        const recipients = members.data
          .filter(
            (m) => m.publicUserData?.userId && m.publicUserData.identifier,
          )
          .map((m) => ({
            id: m.publicUserData?.userId ?? "",
            email: m.publicUserData?.identifier ?? "",
            name: m.publicUserData?.firstName ?? undefined,
          }));

        if (recipients.length === 0) return;

        // Build summary
        const topEventTypes = groupBy(observations, "observationType");
        const topEventEntries = Object.entries(topEventTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([type, count]) => [type, count]);

        const summary = {
          totalObservations: thisWeekCount,
          thisWeekCount,
          lastWeekCount,
          topEventTypes: topEventEntries,
          topItems: observations.slice(0, 5).map((o) => ({
            title: o.title,
            type: o.observationType,
            source: o.source,
            score: o.significanceScore,
          })),
        };

        const weekStart = oneWeekAgo.toISOString().split("T")[0];

        await notifications.workflows.trigger("weekly-summary", {
          recipients,
          tenant: workspaceId,
          data: {
            workspaceId,
            workspaceName: workspace.name,
            weekStart,
            summary,
          },
        });

        processed++;

        log.info("Weekly summary sent", {
          workspaceId,
          workspaceName: workspace.name,
          recipientCount: recipients.length,
          thisWeekCount,
          lastWeekCount,
        });
      });
    }

    return { status: "completed", workspacesProcessed: processed };
  },
);

function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce(
    (acc, item) => {
      const k = String(item[key]);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}
