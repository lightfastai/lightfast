/**
 * Script to seed mock GitHub integration data for development/testing
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-mock-github.ts <workspaceId> <clerkOrgId>
 */

import { db } from "../client";
import { connectedSources } from "../schema";
import { nanoid } from "@repo/lib";

async function seedMockGitHubIntegration() {
  const workspaceId = process.argv[2];
  const clerkOrgId = process.argv[3];

  if (!workspaceId || !clerkOrgId) {
    console.error("Usage: pnpm tsx src/scripts/seed-mock-github.ts <workspaceId> <clerkOrgId>");
    console.error("\nExample:");
    console.error("  pnpm tsx src/scripts/seed-mock-github.ts ws_abc123 org_2abc123");
    process.exit(1);
  }

  console.log("Seeding mock GitHub integration...");
  console.log(`Workspace ID: ${workspaceId}`);
  console.log(`Clerk Org ID: ${clerkOrgId}`);

  // Mock GitHub integration data
  const mockGitHubIntegrations = [
    {
      id: nanoid(),
      clerkOrgId,
      workspaceId,
      sourceType: "github" as const,
      displayName: "lightfastai/lightfast",
      sourceMetadata: {
        repoId: 123456789,
        installationId: 987654321,
        repoFullName: "lightfastai/lightfast",
        defaultBranch: "main",
        repoOwner: "lightfastai",
        repoName: "lightfast",
      },
      isActive: true,
      documentCount: 1247,
      lastIngestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      lastSyncedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      connectedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    },
    {
      id: nanoid(),
      clerkOrgId,
      workspaceId,
      sourceType: "github" as const,
      displayName: "lightfastai/docs",
      sourceMetadata: {
        repoId: 234567890,
        installationId: 987654321,
        repoFullName: "lightfastai/docs",
        defaultBranch: "main",
        repoOwner: "lightfastai",
        repoName: "docs",
      },
      isActive: true,
      documentCount: 342,
      lastIngestedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      lastSyncedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
      connectedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    },
    {
      id: nanoid(),
      clerkOrgId,
      workspaceId,
      sourceType: "github" as const,
      displayName: "acme/frontend",
      sourceMetadata: {
        repoId: 345678901,
        installationId: 987654321,
        repoFullName: "acme/frontend",
        defaultBranch: "develop",
        repoOwner: "acme",
        repoName: "frontend",
      },
      isActive: false, // Inactive example
      documentCount: 856,
      lastIngestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      lastSyncedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      connectedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    },
  ];

  try {
    // Insert mock integrations
    for (const integration of mockGitHubIntegrations) {
      await db.insert(connectedSources).values(integration);
      console.log(`✓ Created mock integration: ${integration.displayName} (${integration.isActive ? "active" : "inactive"})`);
    }

    console.log("\n✅ Successfully seeded mock GitHub integrations!");
    console.log(`\nView them at: http://localhost:4107/<slug>/${workspaceId}/sources`);
  } catch (error) {
    console.error("❌ Error seeding mock data:", error);
    process.exit(1);
  }

  process.exit(0);
}

seedMockGitHubIntegration();
