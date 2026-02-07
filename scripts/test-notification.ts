#!/usr/bin/env tsx
/**
 * Test script for Knock notification flow
 *
 * This script triggers a test observation.captured event through Inngest,
 * which will flow through the notificationDispatch function and trigger
 * a Knock notification.
 *
 * Prerequisites:
 *   - Dev server running (pnpm dev:app)
 *   - Knock dashboard workflow committed
 *
 * Usage:
 *   pnpm test:notification [clerkOrgId] [workspaceId]
 *
 * Arguments:
 *   clerkOrgId    - Clerk organization ID (defaults to test value)
 *   workspaceId   - Workspace UUID (defaults to test value)
 *
 * The script will trigger a high-significance observation (score 85)
 * which should result in a Knock notification being sent.
 */

import { Inngest } from "inngest";

// Inngest client configured for local dev server
const inngest = new Inngest({
  id: "test-notification-client",
  eventKey: "test",
  // Connect to local Inngest dev server
  inngestBaseUrl: "http://127.0.0.1:8288",
});

interface TestNotificationArgs {
  clerkOrgId: string;
  workspaceId: string;
}

async function triggerTestNotification(args: TestNotificationArgs) {
  const { clerkOrgId, workspaceId } = args;

  console.log("\n🧪 Knock Notification Test");
  console.log("━".repeat(70));
  console.log(`  Org ID:       ${clerkOrgId}`);
  console.log(`  Workspace ID: ${workspaceId}`);
  console.log("━".repeat(70));

  try {
    // Send observation.captured event to Inngest
    // This matches the schema in api/console/src/inngest/client/client.ts
    const result = await inngest.send({
      name: "apps-console/neural/observation.captured",
      data: {
        workspaceId,
        clerkOrgId,
        observationId: `test-obs-${Date.now()}`,
        sourceId: `test-source-${Date.now()}`,
        observationType: "security_vulnerability",
        significanceScore: 85, // Must be >= 70 to trigger notification (threshold in dispatch.ts)
        topics: ["authentication", "security", "api"],
        clusterId: `test-cluster-${Date.now()}`,
      },
    });

    console.log("\n✅ Event sent to Inngest successfully!");
    console.log("━".repeat(70));
    console.log(`  Event IDs: ${result.ids.join(", ")}`);
    console.log("━".repeat(70));

    console.log("\n📊 Expected Flow:");
    console.log("  1. Inngest receives event → notificationDispatch function");
    console.log("  2. Filters by significance (85 >= 70 ✓)");
    console.log("  3. Triggers Knock workflow: observation-captured");
    console.log("  4. Knock delivers to in-app feed channel");
    console.log("  5. Bell icon shows notification badge");

    console.log("\n🔍 Verification Steps:");
    console.log("  → Inngest Dev UI: http://localhost:8288");
    console.log("     Check if notificationDispatch function ran");
    console.log("  → Knock Dashboard: https://dashboard.knock.app");
    console.log("     Check workflow runs for observation-captured");
    console.log("  → Console App: http://localhost:4107");
    console.log("     Log in and check bell icon for notification");

    console.log("\n💡 Debug Commands:");
    console.log("  # Follow Inngest logs");
    console.log("  tail -f /tmp/console-dev.log | grep -E 'inngest|Knock'");
    console.log("\n  # Check if Knock client is configured");
    console.log("  grep KNOCK_API_KEY apps/console/.vercel/.env.development.local");

    return result;
  } catch (error) {
    console.error("\n❌ Failed to send event:");
    console.error(error);
    console.error("\n💡 Troubleshooting:");
    console.error("  • Ensure dev server is running: pnpm dev:app");
    console.error("  • Check Inngest is available: curl http://127.0.0.1:8288/health");
    console.error("  • Verify environment variables are set");
    process.exit(1);
  }
}

// Parse command line arguments or use defaults
const args = process.argv.slice(2);
const clerkOrgId = args[0] || "org_test_notification";
const workspaceId = args[1] || "workspace_test_notification";

// Run the test
triggerTestNotification({ clerkOrgId, workspaceId })
  .then(() => {
    console.log("\n✨ Test event dispatched successfully!");
    console.log("━".repeat(70));
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test failed:");
    console.error(error);
    process.exit(1);
  });
