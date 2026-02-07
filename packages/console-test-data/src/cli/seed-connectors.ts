#!/usr/bin/env npx tsx
/**
 * Seed Demo Connectors
 *
 * Adds fake Vercel, Linear, and Sentry connector records to a workspace
 * so the UI shows all 4 sources as connected.
 *
 * Usage:
 *   pnpm --filter @repo/console-test-data seed-connectors -- -w <workspaceId> -u <clerkUserId>
 */

import { db } from "@db/console/client";
import { userSources, workspaceIntegrations } from "@db/console/schema";
import { eq, and } from "drizzle-orm";

interface SeedOptions {
  workspaceId: string;
  userId: string;
}

const DEMO_SOURCES = [
  {
    sourceType: "vercel" as const,
    userSourceId: "us_demo_vercel_001_00",
    integrationId: "wi_demo_vercel_001_00",
    accessToken: "demo_vercel_token",
    providerMetadata: {
      version: 1,
      sourceType: "vercel",
      teamId: "team_lightfast",
      teamSlug: "lightfastai",
      userId: "vercel_user_001",
      configurationId: "icfg_demo_001",
    },
    sourceConfig: {
      version: 1,
      sourceType: "vercel",
      type: "project",
      projectId: "prj_lightfast_console",
      projectName: "lightfast-console",
      teamId: "team_lightfast",
      teamSlug: "lightfastai",
      configurationId: "icfg_demo_001",
      sync: {
        events: ["deployment.created", "deployment.succeeded", "deployment.error"],
        autoSync: true,
      },
    },
    providerResourceId: "prj_lightfast_console",
    documentCount: 7,
  },
  {
    sourceType: "linear" as const,
    userSourceId: "us_demo_linear_001_00",
    integrationId: "wi_demo_linear_001_00",
    accessToken: "demo_linear_token",
    providerMetadata: {
      version: 1,
      sourceType: "linear",
    },
    sourceConfig: {
      version: 1,
      sourceType: "linear",
      type: "project",
      projectId: "proj_neural_memory",
      projectName: "Neural Memory v1",
      sync: {
        events: ["Issue", "Comment", "ProjectUpdate"],
        autoSync: true,
      },
    },
    providerResourceId: "proj_neural_memory",
    documentCount: 13,
  },
  {
    sourceType: "sentry" as const,
    userSourceId: "us_demo_sentry_001_00",
    integrationId: "wi_demo_sentry_001_00",
    accessToken: "demo_sentry_token",
    providerMetadata: {
      version: 1,
      sourceType: "sentry",
    },
    sourceConfig: {
      version: 1,
      sourceType: "sentry",
      type: "project",
      projectId: "201",
      projectName: "lightfast-console",
      sync: {
        events: ["issue.created", "issue.resolved", "error", "event_alert", "metric_alert"],
        autoSync: true,
      },
    },
    providerResourceId: "201",
    documentCount: 5,
  },
];

async function seedConnectors(options: SeedOptions) {
  const { workspaceId, userId } = options;

  console.log(`\nSeeding demo connectors for workspace: ${workspaceId}`);
  console.log(`  User: ${userId}\n`);

  for (const source of DEMO_SOURCES) {
    // Check if user source already exists
    const existing = await db
      .select({ id: userSources.id })
      .from(userSources)
      .where(and(eq(userSources.userId, userId), eq(userSources.sourceType, source.sourceType)));

    if (existing.length > 0) {
      console.log(`  [skip] ${source.sourceType} user source already exists (${existing[0]!.id})`);

      // Still check if workspace integration exists
      const existingIntegration = await db
        .select({ id: workspaceIntegrations.id })
        .from(workspaceIntegrations)
        .where(and(
          eq(workspaceIntegrations.workspaceId, workspaceId),
          eq(workspaceIntegrations.userSourceId, existing[0]!.id),
        ));

      if (existingIntegration.length > 0) {
        console.log(`  [skip] ${source.sourceType} workspace integration already exists`);
        continue;
      }

      // Create workspace integration with existing user source
      await db.insert(workspaceIntegrations).values({
        id: source.integrationId,
        workspaceId,
        userSourceId: existing[0]!.id,
        connectedBy: userId,
        sourceConfig: source.sourceConfig as never,
        providerResourceId: source.providerResourceId,
        isActive: true,
        lastSyncStatus: "success",
        documentCount: source.documentCount,
      });
      console.log(`  [created] ${source.sourceType} workspace integration`);
      continue;
    }

    // Create user source
    await db.insert(userSources).values({
      id: source.userSourceId,
      userId,
      sourceType: source.sourceType,
      accessToken: source.accessToken,
      providerMetadata: source.providerMetadata as never,
      isActive: true,
    });
    console.log(`  [created] ${source.sourceType} user source`);

    // Create workspace integration
    await db.insert(workspaceIntegrations).values({
      id: source.integrationId,
      workspaceId,
      userSourceId: source.userSourceId,
      connectedBy: userId,
      sourceConfig: source.sourceConfig as never,
      providerResourceId: source.providerResourceId,
      isActive: true,
      lastSyncStatus: "success",
      documentCount: source.documentCount,
    });
    console.log(`  [created] ${source.sourceType} workspace integration`);
  }

  console.log("\nDone! All connectors seeded.");
}

// CLI parsing
function parseArgs(): SeedOptions {
  const args = process.argv.slice(2);
  const options: SeedOptions = { workspaceId: "", userId: "" };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-w" || arg === "--workspace") {
      options.workspaceId = args[++i] ?? "";
    } else if (arg === "-u" || arg === "--user") {
      options.userId = args[++i] ?? "";
    } else if (arg === "-h" || arg === "--help") {
      console.log(`
Usage: seed-connectors -w <workspaceId> -u <clerkUserId>

Options:
  -w, --workspace  Workspace ID (required)
  -u, --user       Clerk user ID (required)
  -h, --help       Show this help message

Example:
  pnpm --filter @repo/console-test-data seed-connectors -- -w ws_abc123 -u user_abc123
`);
      process.exit(0);
    }
  }

  return options;
}

const options = parseArgs();

if (!options.workspaceId) {
  console.error("Error: --workspace (-w) is required");
  process.exit(1);
}
if (!options.userId) {
  console.error("Error: --user (-u) is required");
  process.exit(1);
}

seedConnectors(options)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
