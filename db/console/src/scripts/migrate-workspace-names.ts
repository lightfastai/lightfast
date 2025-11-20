#!/usr/bin/env tsx
/**
 * Migration Script: Update workspace names to match slugs
 *
 * This script updates existing workspaces to use their slug as their name.
 * This is necessary because we changed the URL structure from using slugs to using names,
 * and old workspaces were created with friendly names like "Friendly Gerbil" while
 * their slugs were "friendly-gerbil".
 *
 * Run with: pnpm tsx db/console/src/scripts/migrate-workspace-names.ts
 */

import { db } from "../client";
import { workspaces } from "../schema";
import { eq } from "drizzle-orm";

async function migrateWorkspaceNames() {
  console.log("🔄 Starting workspace name migration...");

  try {
    // Get all workspaces
    const allWorkspaces = await db.query.workspaces.findMany();

    console.log(`📊 Found ${allWorkspaces.length} workspaces`);

    // Update each workspace to use its slug as its name
    for (const workspace of allWorkspaces) {
      console.log(`\n📝 Workspace: ${workspace.id}`);
      console.log(`   Old name: "${workspace.name}"`);
      console.log(`   Slug: "${workspace.slug}"`);

      if (workspace.name !== workspace.slug) {
        // Update name to match slug
        await db
          .update(workspaces)
          .set({ name: workspace.slug })
          .where(eq(workspaces.id, workspace.id));

        console.log(`   ✅ Updated name to: "${workspace.slug}"`);
      } else {
        console.log(`   ✓ Name already matches slug`);
      }
    }

    console.log("\n✅ Migration complete!");

    // Verify the migration
    const updatedWorkspaces = await db.query.workspaces.findMany();
    console.log("\n📋 Updated workspaces:");
    for (const workspace of updatedWorkspaces) {
      console.log(`   - ${workspace.name} (slug: ${workspace.slug})`);
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the migration
migrateWorkspaceNames();
