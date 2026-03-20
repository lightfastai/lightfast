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

import { db } from "@db/app";
import type { InsertWorkspaceIntegration } from "@db/app/schema";
import {
  gatewayInstallations,
  orgWorkspaces,
  workspaceIntegrations,
} from "@db/app/schema";
import { nanoid } from "@repo/lib";
import { and, eq } from "@vendor/db";

interface SeedOptions {
  userId: string;
  workspaceId: string;
}

interface DemoSource {
  documentCount: number;
  /** Stable externalId used to find/create the gwInstallation for this provider */
  gwExternalId: string;
  providerConfig: InsertWorkspaceIntegration["providerConfig"];
  providerResourceId: string;
}

/**
 * Demo source definitions for all 4 providers.
 * Each entry seeds a gwInstallation + workspaceIntegration.
 */
const DEMO_SOURCES: DemoSource[] = [
  {
    providerConfig: {
      provider: "github",
      type: "repository",
      sync: {
        events: ["push", "pull_request", "issues", "release", "discussion"],
        autoSync: true,
      },
    },
    providerResourceId: "901234567",
    documentCount: 0,
    gwExternalId: "12345678",
  },
  {
    providerConfig: {
      provider: "vercel",
      type: "project",
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
    gwExternalId: "demo-vercel-icfg-001",
  },
  {
    providerConfig: {
      provider: "sentry",
      type: "project",
      sync: {
        events: ["issue", "error", "event_alert", "metric_alert"],
        autoSync: true,
      },
    },
    providerResourceId: "4508288486826115",
    documentCount: 5,
    gwExternalId: "demo-sentry-001",
  },
  {
    providerConfig: {
      provider: "linear",
      type: "team",
      sync: {
        events: ["Issue", "Comment", "Project", "Cycle", "ProjectUpdate"],
        autoSync: true,
      },
    },
    providerResourceId: "team_lightfast_eng",
    documentCount: 13,
    gwExternalId: "demo-linear-001",
  },
];

async function seedIntegrations({ workspaceId, userId }: SeedOptions) {
  console.log(`\nSeeding integrations for workspace: ${workspaceId}`);
  console.log(`  User: ${userId}\n`);

  // Look up the workspace to get clerkOrgId (needed for gatewayInstallations.orgId)
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
    columns: { clerkOrgId: true },
  });

  if (!workspace) {
    console.error(`Error: Workspace not found: ${workspaceId}`);
    process.exit(1);
  }

  const orgId = workspace.clerkOrgId;

  for (const source of DEMO_SOURCES) {
    const provider = source.providerConfig.provider;

    // Find or create gwInstallation for this provider
    let installation = await db.query.gatewayInstallations.findFirst({
      where: and(
        eq(gatewayInstallations.provider, provider),
        eq(gatewayInstallations.externalId, source.gwExternalId),
        eq(gatewayInstallations.orgId, orgId)
      ),
      columns: { id: true },
    });

    if (installation) {
      console.log(`  [skip] ${provider} gwInstallation already exists`);
    } else {
      const [created] = await db
        .insert(gatewayInstallations)
        .values({
          id: `gw-${provider}-${nanoid(8)}`,
          provider,
          externalId: source.gwExternalId,
          connectedBy: userId,
          orgId,
          status: "active",
        })
        .returning({ id: gatewayInstallations.id });
      installation = created;
      console.log(`  [created] ${provider} gwInstallation`);
    }

    if (!installation) {
      console.error(`  [err] Failed to create gwInstallation for ${provider}`);
      continue;
    }

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
      console.log(`  [skip] ${provider} workspace integration already exists`);
      continue;
    }

    await db.insert(workspaceIntegrations).values({
      id: `wi-${provider}-${nanoid(8)}`,
      workspaceId,
      installationId: installation.id,
      provider,
      providerConfig: source.providerConfig,
      providerResourceId: source.providerResourceId,
      status: "active",
      lastSyncStatus: "success",
      documentCount: source.documentCount,
    });
    console.log(`  [created] ${provider} workspace integration`);
  }

  console.log("\nDone! All integrations seeded.");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): SeedOptions {
  const args = process.argv.slice(2);
  const options: SeedOptions = { workspaceId: "", userId: "" };

  // biome-ignore lint/style/useForOf: index manipulation (++i) inside loop body
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-w" || arg === "--workspace") {
      options.workspaceId = args[++i] ?? "";
    } else if (arg === "-u" || arg === "--user") {
      options.userId = args[++i] ?? "";
    } else if (arg === "-h" || arg === "--help") {
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

seedIntegrations(options)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
