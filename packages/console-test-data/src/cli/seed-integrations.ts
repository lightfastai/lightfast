#!/usr/bin/env npx tsx
/**
 * Integration Seeder
 *
 * Seeds workspace integrations (GitHub, Vercel, Sentry, Linear)
 * for demo / testing purposes. Idempotent — skips records that already exist.
 *
 * Usage:
 *   pnpm seed-integrations:prod -- -w <workspaceId> -u <clerkUserId>
 */

import { parseArgs as nodeParseArgs } from "node:util";
import { db } from "@db/console";
import type { InsertWorkspaceIntegration } from "@db/console/schema";
import { workspaceIntegrations } from "@db/console/schema";
import { nanoid } from "@repo/lib";
import { and, eq } from "@vendor/db";

interface SeedOptions {
  userId: string;
  workspaceId: string;
}

interface DemoSource {
  documentCount: number;
  providerResourceId: string;
  sourceConfig: InsertWorkspaceIntegration["sourceConfig"];
}

/**
 * Demo source definitions for all 4 providers.
 * Each entry seeds a workspaceIntegration.
 */
const DEMO_SOURCES: DemoSource[] = [
  {
    sourceConfig: {
      version: 1,
      sourceType: "github",
      type: "repository",
      installationId: "12345678",
      repoId: "901234567",
      repoName: "lightfast",
      repoFullName: "lightfastai/lightfast",
      defaultBranch: "main",
      isPrivate: true,
      isArchived: false,
      sync: {
        branches: ["main"],
        paths: ["**/*"],
        events: ["push", "pull_request", "issues", "release", "discussion"],
        autoSync: true,
      },
    },
    providerResourceId: "901234567",
    documentCount: 0,
  },
  {
    sourceConfig: {
      version: 1,
      sourceType: "vercel",
      type: "project",
      projectId: "prj_lightfast_console",
      projectName: "lightfast-console",
      teamId: "team_lightfastai",
      teamSlug: "lightfastai",
      configurationId: "icfg_demo_001",
      sync: {
        events: [
          "deployment.created",
          "deployment.succeeded",
          "deployment.ready",
          "deployment.error",
          "deployment.canceled",
          "deployment.check-rerequested",
        ],
        autoSync: true,
      },
    },
    providerResourceId: "prj_lightfast_console",
    documentCount: 7,
  },
  {
    sourceConfig: {
      version: 1,
      sourceType: "sentry",
      type: "project",
      projectSlug: "lightfast-console",
      projectId: "4508288486826115",
      sync: {
        events: ["issue", "error", "event_alert", "metric_alert"],
        autoSync: true,
      },
    },
    providerResourceId: "4508288486826115",
    documentCount: 5,
  },
  {
    sourceConfig: {
      version: 1,
      sourceType: "linear",
      type: "team",
      teamId: "team_lightfast_eng",
      teamKey: "LIGHT",
      teamName: "Lightfast",
      sync: {
        events: ["Issue", "Comment", "Project", "Cycle", "ProjectUpdate"],
        autoSync: true,
      },
    },
    providerResourceId: "team_lightfast_eng",
    documentCount: 13,
  },
];

async function seedIntegrations({ workspaceId, userId }: SeedOptions) {
  console.log(`\nSeeding integrations for workspace: ${workspaceId}`);
  console.log(`  User: ${userId}\n`);

  for (const source of DEMO_SOURCES) {
    // Check if workspace integration already exists for this provider resource
    const existingIntegration = await db
      .select({ id: workspaceIntegrations.id })
      .from(workspaceIntegrations)
      .where(
        and(
          eq(workspaceIntegrations.workspaceId, workspaceId),
          eq(
            workspaceIntegrations.providerResourceId,
            source.providerResourceId
          )
        )
      );

    if (existingIntegration.length > 0) {
      console.log(
        `  [skip] ${source.sourceConfig.sourceType} workspace integration already exists`
      );
      continue;
    }

    await db.insert(workspaceIntegrations).values({
      id: `wi-${source.sourceConfig.sourceType}-${nanoid(8)}`,
      workspaceId,
      connectedBy: userId,
      provider: source.sourceConfig.sourceType,
      sourceConfig: source.sourceConfig,
      providerResourceId: source.providerResourceId,
      isActive: true,
      lastSyncStatus: "success",
      documentCount: source.documentCount,
    });
    console.log(
      `  [created] ${source.sourceConfig.sourceType} workspace integration`
    );
  }

  console.log("\nDone! All integrations seeded.");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): SeedOptions {
  const { values } = nodeParseArgs({
    args: process.argv.slice(2),
    options: {
      workspace: { type: "string", short: "w" },
      user: { type: "string", short: "u" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
  });

  if (values.help) {
    console.log(`
Usage: seed-integrations -w <workspaceId> -u <clerkUserId>

Seeds demo workspace integrations for GitHub, Vercel, Sentry,
and Linear. Idempotent — existing records are skipped.

Options:
  -w, --workspace  Workspace ID (required)
  -u, --user       Clerk user ID (required)
  -h, --help       Show this help message

Example:
  pnpm seed-integrations:prod -- -w ws_abc123 -u user_abc123
`);
    process.exit(0);
  }

  return {
    workspaceId: (values.workspace as string) ?? "",
    userId: (values.user as string) ?? "",
  };
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

seedIntegrations(options)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
