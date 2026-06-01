/**
 * One-off rollout script for the shared Lightfast namespace registry.
 *
 * Run from api/app after the namespace tables exist in the target environment:
 *   pnpm namespace:backfill
 *
 * Re-run immediately before enabling strict namespace routing in production.
 * Delete this script after production has been backfilled and verified.
 */
import { db } from "@db/app/client";
import { createBackendClerkClient } from "@vendor/clerk/backend";

import {
  backfillClerkNamespaces,
  hasNamespaceBackfillConflicts,
} from "../src/services/namespaces/backfill";

async function main() {
  const clerk = createBackendClerkClient();
  const result = await backfillClerkNamespaces({ clerk, db });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));

  if (hasNamespaceBackfillConflicts(result)) {
    throw new Error("Namespace backfill completed with conflicts.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
