/**
 * Script to list all workspaces for seeding
 *
 * Usage:
 *   pnpm tsx src/scripts/list-workspaces.ts
 */

import { db } from "../client";
import { workspaces } from "../schema";

async function listWorkspaces() {
  console.log("Fetching workspaces...\n");

  try {
    const allWorkspaces = await db.select().from(workspaces);

    if (allWorkspaces.length === 0) {
      console.log("No workspaces found in database.");
      process.exit(0);
    }

    console.log(`Found ${allWorkspaces.length} workspace(s):\n`);

    for (const workspace of allWorkspaces) {
      console.log(`Workspace: ${workspace.slug}`);
      console.log(`  ID: ${workspace.id}`);
      console.log(`  Name: ${workspace.name}`);
      console.log(`  Clerk Org ID: ${workspace.clerkOrgId}`);
      console.log(`  Created: ${workspace.createdAt}`);
      console.log("");
    }

    console.log("To seed mock GitHub data, run:");
    console.log(`  pnpm tsx src/scripts/seed-mock-github.ts <workspaceId> <clerkOrgId>`);
    console.log("\nExample:");
    if (allWorkspaces[0]) {
      console.log(`  pnpm tsx src/scripts/seed-mock-github.ts ${allWorkspaces[0].id} ${allWorkspaces[0].clerkOrgId}`);
    }
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    process.exit(1);
  }

  process.exit(0);
}

listWorkspaces();
