#!/usr/bin/env npx tsx
/**
 * Integration Seeder for Production Demo
 *
 * Seeds workspace integrations (GitHub, Vercel, Sentry, Linear) for demo purposes.
 *
 * Usage:
 *   pnpm seed-integrations:prod -- --workspace <id> --user <clerkUserId> --github-source <id> --vercel-source <id> --sentry-source <id> --linear-source <id>
 */

import { db } from "@db/console";
import { workspaceIntegrations } from "@db/console/schema";
import { nanoid } from "@repo/lib";

interface SeedOptions {
  workspaceId: string;
  userId: string;
  githubUserSourceId: string;
  vercelUserSourceId: string;
  sentryUserSourceId: string;
  linearUserSourceId: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg.startsWith("--") || arg.startsWith("-")) {
      const key = arg.replace(/^-+/, "");
      const value = args[i + 1];
      if (value && !value.startsWith("-")) {
        parsed[key] = value;
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

function showHelp() {
  console.log(`
Integration Seeder for Production Demo

Usage:
  pnpm seed-integrations:prod -- [options]

Required:
  --workspace, -w        Workspace ID (from production)
  --user, -u             Clerk User ID (your user)
  --github-source, -gh   GitHub userSource ID
  --vercel-source, -v    Vercel userSource ID
  --sentry-source, -s    Sentry userSource ID
  --linear-source, -l    Linear userSource ID

Optional:
  --help, -h             Show this help

Examples:
  pnpm seed-integrations:prod -- -w ws_abc123 -u user_xyz789 -gh us-gh -v us-vc -s us-sentry -l us-linear
`);
}

/**
 * Create workspace integrations
 */
async function seedIntegrations(
  workspaceId: string,
  userId: string,
  githubUserSourceId: string,
  vercelUserSourceId: string,
  sentryUserSourceId: string,
  linearUserSourceId: string,
) {
  console.log("\n📦 Creating integrations...");

  // Create workspaceIntegrations
  const integrations = [
    // GitHub Repository
    {
      id: `wi-demo-github-${nanoid(8)}`,
      workspaceId,
      userSourceId: githubUserSourceId,
      connectedBy: userId,
      sourceConfig: {
        version: 1 as const,
        sourceType: "github" as const,
        type: "repository" as const,
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
          events: ["push", "pull_request"],
          autoSync: true,
        },
      },
      providerResourceId: "901234567",
      isActive: true,
      documentCount: 0,
    },
    // Vercel Project
    {
      id: `wi-demo-vercel-${nanoid(8)}`,
      workspaceId,
      userSourceId: vercelUserSourceId,
      connectedBy: userId,
      sourceConfig: {
        version: 1 as const,
        sourceType: "vercel" as const,
        type: "project" as const,
        projectId: "prj_lightfast_console",
        projectName: "lightfast-console",
        teamId: "team_lightfastai",
        teamSlug: "lightfastai",
        configurationId: "icfg_demo123",
        sync: {
          events: [
            "deployment.created",
            "deployment.succeeded",
            "deployment.failed",
          ],
          autoSync: true,
        },
      },
      providerResourceId: "prj_lightfast_console",
      isActive: true,
      documentCount: 0,
    },
    // Sentry Project
    {
      id: `wi-demo-sentry-${nanoid(8)}`,
      workspaceId,
      userSourceId: sentryUserSourceId,
      connectedBy: userId,
      sourceConfig: {
        version: 1 as const,
        sourceType: "sentry" as const,
        type: "project" as const,
        organizationSlug: "lightfast",
        projectSlug: "lightfast-console",
        projectId: "4508288486826115",
        sync: {
          events: [
            "issue.created",
            "issue.resolved",
            "error.created",
            "alert.triggered",
          ],
          autoSync: true,
        },
      },
      providerResourceId: "4508288486826115",
      isActive: true,
      documentCount: 0,
    },
    // Linear Team
    {
      id: `wi-demo-linear-${nanoid(8)}`,
      workspaceId,
      userSourceId: linearUserSourceId,
      connectedBy: userId,
      sourceConfig: {
        version: 1 as const,
        sourceType: "linear" as const,
        type: "team" as const,
        teamId: "team_lightfast_eng",
        teamKey: "LIGHT",
        teamName: "Lightfast",
        sync: {
          events: [
            "issue.created",
            "issue.updated",
            "issue.completed",
            "comment.created",
          ],
          autoSync: true,
        },
      },
      providerResourceId: "team_lightfast_eng",
      isActive: true,
      documentCount: 0,
    },
  ];

  await db.insert(workspaceIntegrations).values(integrations);
  console.log(`  ✓ Created GitHub integration (lightfastai/lightfast)`);
  console.log(`  ✓ Created Vercel integration (lightfast-console)`);
  console.log(`  ✓ Created Sentry integration (lightfast/lightfast-console)`);
  console.log(`  ✓ Created Linear integration (Lightfast team - LIGHT)`);

  return integrations.map((i) => i.id);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const workspaceId = (args.workspace ?? args.w) as string;
  const userId = (args.user ?? args.u) as string;
  const githubUserSourceId = (args["github-source"] ?? args.gh) as string;
  const vercelUserSourceId = (args["vercel-source"] ?? args.v) as string;
  const sentryUserSourceId = (args["sentry-source"] ?? args.s) as string;
  const linearUserSourceId = (args["linear-source"] ?? args.l) as string;

  if (!workspaceId) {
    console.error("❌ Error: --workspace is required");
    showHelp();
    process.exit(1);
  }

  if (!userId) {
    console.error("❌ Error: --user is required");
    showHelp();
    process.exit(1);
  }

  if (!githubUserSourceId) {
    console.error("❌ Error: --github-source is required");
    showHelp();
    process.exit(1);
  }

  if (!vercelUserSourceId) {
    console.error("❌ Error: --vercel-source is required");
    showHelp();
    process.exit(1);
  }

  if (!sentryUserSourceId) {
    console.error("❌ Error: --sentry-source is required");
    showHelp();
    process.exit(1);
  }

  if (!linearUserSourceId) {
    console.error("❌ Error: --linear-source is required");
    showHelp();
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Integration Seeder - Production Demo");
  console.log("=".repeat(60));
  console.log(`  Workspace: ${workspaceId}`);
  console.log(`  User: ${userId}`);
  console.log(`  GitHub UserSource: ${githubUserSourceId}`);
  console.log(`  Vercel UserSource: ${vercelUserSourceId}`);
  console.log(`  Sentry UserSource: ${sentryUserSourceId}`);
  console.log(`  Linear UserSource: ${linearUserSourceId}`);
  console.log();

  try {
    const integrationIds = await seedIntegrations(
      workspaceId,
      userId,
      githubUserSourceId,
      vercelUserSourceId,
      sentryUserSourceId,
      linearUserSourceId,
    );

    console.log("\n" + "=".repeat(60));
    console.log("✅ Integration seeding complete!");
    console.log("=".repeat(60));
    console.log(
      `  Integrations: ${integrationIds.length} (GitHub, Vercel, Sentry, Linear)`,
    );
    console.log();
    console.log("Next step: Run inject CLI to seed observations");
    console.log("  pnpm inject:prod -- -w " + workspaceId);
    console.log();
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
